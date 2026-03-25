'use client'

/**
 * Client-side x402 payment integration.
 *
 * Two modes selected by NEXT_PUBLIC_BERMUDA_SCHEME:
 *
 *   "bermuda" (default):
 *     Routes to POST /api/bermuda-checkout — server-side Node.js runs
 *     x402BermudaClientScheme (ZK proof generation, bb.js WASM).
 *     Uses the Bermuda privacy pool on Base Sepolia.
 *     Token: real Base Sepolia USDC (0x036CbD...)
 *
 *   "exact":
 *     Runs ExactEvmScheme directly in the browser (EIP-3009 / Permit2).
 *     Uses MockUSDC with self-hosted facilitator.
 *     Useful for testing without ZK proof overhead.
 *
 * Every step is emitted to the Inspector panel regardless of mode.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type InspectorStep =
  | { type: 'request_sent'; url: string; ts: number }
  | { type: '402_received'; paymentRequired: unknown; ts: number }
  | { type: 'account_derived'; shieldedAddress: string; ts: number }
  | { type: 'payload_created'; scheme: string; ts: number }
  | { type: 'proof_generating'; ts: number }
  | { type: 'payment_sent'; ts: number }
  | { type: 'success'; orderId: string; txHash?: string; ts: number }
  | { type: 'error'; message: string; ts: number }

export interface CheckoutLineItem {
  id: string
  name: string
  qty: number
  price: number
  subtotal: number
}

export interface CheckoutResult {
  orderId: string
  items: CheckoutLineItem[]
  total: number
  txHash?: string
  shieldedAddress: string
}

const USE_BERMUDA = process.env.NEXT_PUBLIC_BERMUDA_SCHEME !== 'exact'

// ── Main checkout function ─────────────────────────────────────────────────

/**
 * Full x402 checkout flow with per-step callbacks for the Inspector panel.
 *
 * In Bermuda mode: delegates to /api/bermuda-checkout (server-side SDK).
 * In exact mode: runs ExactEvmScheme directly in browser (EIP-3009).
 */
export async function bermudaCheckout(
  walletClient: unknown,         // Used only in exact mode
  itemsParam: string,
  onStep: (step: InspectorStep) => void,
  publicClient?: unknown         // Used only in exact mode
): Promise<CheckoutResult> {
  if (USE_BERMUDA) {
    return bermudaServerCheckout(itemsParam, onStep)
  }
  return exactEvmCheckout(walletClient, itemsParam, onStep, publicClient)
}

// ── Bermuda mode: server-side ──────────────────────────────────────────────

async function bermudaServerCheckout(
  itemsParam: string,
  onStep: (step: InspectorStep) => void,
): Promise<CheckoutResult> {
  onStep({ type: 'request_sent', url: '/api/bermuda-checkout', ts: Date.now() })

  const demoToken = process.env.NEXT_PUBLIC_DEMO_TOKEN
  const res = await fetch('/api/bermuda-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(demoToken ? { 'X-Demo-Token': demoToken } : {}),
    },
    body: JSON.stringify({ items: itemsParam }),
  })

  type ServerResponse = {
    steps?: InspectorStep[]
    error?: string
    orderId?: string
    items?: CheckoutLineItem[]
    total?: number
    txHash?: string
    shieldedAddress?: string
  }

  const data = await res.json() as ServerResponse

  // Replay all steps from the server into the inspector
  if (data.steps) {
    for (const step of data.steps) {
      // Skip request_sent — we already emitted it above
      if ((step as InspectorStep).type !== 'request_sent') {
        onStep(step as InspectorStep)
      }
    }
  }

  if (!res.ok || data.error) {
    const msg = data.error ?? `Server checkout failed (${res.status})`
    onStep({ type: 'error', message: msg, ts: Date.now() })
    throw new Error(msg)
  }

  return {
    orderId:         data.orderId         ?? '',
    items:           data.items           ?? [],
    total:           data.total           ?? 0,
    txHash:          data.txHash,
    shieldedAddress: data.shieldedAddress ?? '',
  }
}

// ── Exact mode: browser-side EIP-3009 ─────────────────────────────────────

async function exactEvmCheckout(
  walletClient: unknown,
  itemsParam: string,
  onStep: (step: InspectorStep) => void,
  publicClient?: unknown
): Promise<CheckoutResult> {
  const [
    { x402Client, x402HTTPClient },
    { ExactEvmScheme, toClientEvmSigner },
  ] = await Promise.all([
    import('@x402/core/client') as Promise<{
      x402Client: new () => {
        register(network: string, scheme: unknown): unknown
        createPaymentPayload(pr: unknown): Promise<unknown>
      }
      x402HTTPClient: new (c: unknown) => {
        getPaymentRequiredResponse(getH: (n: string) => string | null, body?: unknown): unknown
        encodePaymentSignatureHeader(payload: unknown): Record<string, string>
      }
    }>,
    import('@x402/evm') as Promise<{
      ExactEvmScheme: new (signer?: unknown) => unknown
      toClientEvmSigner: (wc: unknown) => unknown
    }>,
  ])

  const url = `/api/checkout?items=${encodeURIComponent(itemsParam)}`

  onStep({ type: 'request_sent', url, ts: Date.now() })
  const res1 = await fetch(url)

  if (res1.status !== 402) {
    if (res1.ok) {
      const data = await res1.json() as CheckoutResult
      onStep({ type: 'success', orderId: data.orderId, ts: Date.now() })
      return { ...data, shieldedAddress: '' }
    }
    const text = await res1.text()
    throw new Error(`Unexpected status ${res1.status}: ${text}`)
  }

  let body: unknown
  try {
    const text = await res1.text()
    if (text) body = JSON.parse(text)
  } catch { /* ignore */ }

  const xClient = new x402Client()
  const xHttp   = new x402HTTPClient(xClient)
  const paymentRequired = xHttp.getPaymentRequiredResponse((h) => res1.headers.get(h), body)
  onStep({ type: '402_received', paymentRequired, ts: Date.now() })

  const evmSigner = (toClientEvmSigner as (...args: unknown[]) => unknown)(walletClient, publicClient)
  const scheme    = new ExactEvmScheme(evmSigner)
  xClient.register('eip155:*', scheme)

  const addr = (walletClient as { account?: { address: string } })?.account?.address ?? ''
  onStep({ type: 'account_derived', shieldedAddress: addr, ts: Date.now() })

  const paymentPayload = await xClient.createPaymentPayload(paymentRequired)
  const prScheme = (paymentRequired as { scheme?: string }).scheme ?? 'exact'
  onStep({ type: 'payload_created', scheme: prScheme, ts: Date.now() })

  const paymentHeaders = xHttp.encodePaymentSignatureHeader(paymentPayload)
  onStep({ type: 'payment_sent', ts: Date.now() })

  const res2 = await fetch(url, { headers: paymentHeaders })

  if (!res2.ok) {
    const text = await res2.text()
    const msg  = `Payment rejected (${res2.status}): ${text}`
    onStep({ type: 'error', message: msg, ts: Date.now() })
    throw new Error(msg)
  }

  const result = await res2.json() as CheckoutResult
  onStep({ type: 'success', orderId: result.orderId, txHash: result.txHash, ts: Date.now() })
  return { ...result, shieldedAddress: addr }
}
