/**
 * Server-side Bermuda x402 checkout.
 *
 * Runs x402BermudaClientScheme on Node.js because the Bermuda SDK uses WASM
 * circuit loading (import.meta.dirname) which is not browser-compatible yet.
 *
 * The agent's private key (NEXT_PUBLIC_AGENT_PK) is accessible server-side
 * because NEXT_PUBLIC_ vars are bundled into the server as well.
 *
 * Flow:
 *   1. Initial GET /api/checkout → 402 Payment Required
 *   2. Create x402BermudaClientScheme with agent wallet
 *   3. Generate Bermuda deposit proof (ZK — may take 10-30s)
 *   4. Retry GET /api/checkout with PAYMENT-SIGNATURE header
 *   5. Return all inspector steps + order confirmation
 *
 * Called by bermuda-client.ts when NEXT_PUBLIC_BERMUDA_SCHEME != "exact".
 *
 * DEMO_TOKEN: set NEXT_PUBLIC_DEMO_TOKEN in .env.local to require X-Demo-Token
 * header on all requests — prevents casual wallet drain from the public URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, hardhat } from 'viem/chains'
import { GET as checkoutRoute } from '@/app/api/checkout/route'

// ── Allow up to 60s for ZK proof generation ─────────────────────────────────
export const maxDuration = 300

// ── Lazy SDK loader ───────────────────────────────────────────────────────────
// bermuda-bay-sdk is ESM with top-level await. Next.js compiles API routes to
// CJS, and webpack transforms import() → require() for known packages unless
// told otherwise. `/* webpackIgnore: true */` leaves the import() call as a
// native dynamic import at runtime, correctly handling ESM + top-level await.

type CoreModule = {
  x402Client: new () => {
    register(network: string, scheme: unknown): unknown
    createPaymentPayload(pr: unknown): Promise<unknown>
  }
  x402HTTPClient: new (c: unknown) => {
    getPaymentRequiredResponse(getH: (n: string) => string | null, body?: unknown): unknown
    encodePaymentSignatureHeader(payload: unknown): Record<string, string>
  }
}
type SDKModule = {
  x402BermudaClientScheme: new (scheme: string, signer?: unknown, spender?: unknown) => unknown
}

let _sdkCache: Promise<CoreModule & SDKModule> | null = null

function loadSDK(): Promise<CoreModule & SDKModule> {
  if (_sdkCache) return _sdkCache
  _sdkCache = Promise.all([
    import(/* webpackIgnore: true */ '@x402/core/client') as Promise<CoreModule>,
    import(/* webpackIgnore: true */ 'bermuda-bay-sdk') as Promise<SDKModule>,
  ]).then(([core, sdk]) => ({ ...core, ...sdk }))
  return _sdkCache
}

// ── Config ──────────────────────────────────────────────────────────────────
const IS_TESTENV   = process.env.NEXT_PUBLIC_NETWORK === 'testenv'
const DEMO_TOKEN   = process.env.NEXT_PUBLIC_DEMO_TOKEN  // optional — if unset, guard is disabled

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Demo token guard — prevents casual wallet drain on public deployments ──
  if (DEMO_TOKEN) {
    const incoming = req.headers.get('x-demo-token')
    if (incoming !== DEMO_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: { items?: string }
  try {
    body = await req.json() as { items?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { items } = body
  if (!items) {
    return NextResponse.json({ error: 'Missing items param' }, { status: 400 })
  }

  const pk = process.env.NEXT_PUBLIC_AGENT_PK
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_AGENT_PK not configured' }, { status: 500 })
  }

  const steps: unknown[] = []
  // Base URL used only for query-param parsing — no network call is made.
  const checkoutUrl = `http://localhost/api/checkout?items=${encodeURIComponent(items)}`

  try {
    // ── Step 1: initial request (direct function call, no network hop) ───────
    steps.push({ type: 'request_sent', url: '/api/checkout', ts: Date.now() })
    const res1 = await checkoutRoute(new NextRequest(checkoutUrl))

    if (res1.status !== 402) {
      if (res1.ok) {
        const data = await res1.json()
        steps.push({ type: 'success', orderId: (data as { orderId: string }).orderId, ts: Date.now() })
        return NextResponse.json({ steps, ...(data as object) })
      }
      const text = await res1.text()
      return NextResponse.json({ steps, error: `Unexpected status ${res1.status}: ${text}` }, { status: 500 })
    }

    // ── Step 2: parse 402 Payment Required ───────────────────────────────────
    let body402: unknown
    try {
      const text = await res1.text()
      if (text) body402 = JSON.parse(text)
    } catch { /* ignore */ }

    const { x402Client, x402HTTPClient, x402BermudaClientScheme } = await loadSDK()

    const xClient = new x402Client()
    const xHttp   = new x402HTTPClient(xClient)
    const paymentRequired = xHttp.getPaymentRequiredResponse(
      (h) => res1.headers.get(h),
      body402
    )
    steps.push({ type: '402_received', paymentRequired, ts: Date.now() })

    // ── Step 3: create Bermuda scheme with agent wallet ───────────────────────
    const chain      = IS_TESTENV ? hardhat : baseSepolia
    const account    = privateKeyToAccount(pk as `0x${string}`)
    const walletClient = createWalletClient({ account, chain, transport: http() })
    const publicClient = createPublicClient({ chain, transport: http() })

    // The Bermuda SDK (ops.js/utils.js) checks signer.address directly and calls
    // signer.readContract(). Merge public actions + explicit address to satisfy both.
    const signer = Object.assign(walletClient, {
      address: account.address,
      readContract: publicClient.readContract.bind(publicClient),
    })

    // bermuda::anyhow → tries private transfer first, falls back to deposit
    const bermudaScheme = new x402BermudaClientScheme('bermuda::anyhow', signer)
    xClient.register('eip155:*', bermudaScheme)

    steps.push({ type: 'account_derived', shieldedAddress: account.address, ts: Date.now() })

    // ── Step 4: create payment payload (ZK proof — may take 10-30s) ──────────
    steps.push({ type: 'proof_generating', ts: Date.now() })
    const paymentPayload = await xClient.createPaymentPayload(paymentRequired)
    steps.push({ type: 'payload_created', scheme: 'bermuda::anyhow', ts: Date.now() })

    // ── Step 5: retry with PAYMENT-SIGNATURE header (direct function call) ───
    const paymentHeaders = xHttp.encodePaymentSignatureHeader(paymentPayload)
    steps.push({ type: 'payment_sent', ts: Date.now() })

    const res2 = await checkoutRoute(
      new NextRequest(checkoutUrl, { headers: paymentHeaders })
    )

    if (!res2.ok) {
      const text = await res2.text()
      const msg  = `Payment rejected (${res2.status}): ${text}`
      steps.push({ type: 'error', message: msg, ts: Date.now() })
      return NextResponse.json({ steps, error: msg }, { status: 500 })
    }

    const result = await res2.json() as { orderId: string; txHash?: string }
    steps.push({ type: 'success', orderId: result.orderId, txHash: result.txHash, ts: Date.now() })

    return NextResponse.json({ steps, ...result, shieldedAddress: account.address })

  } catch (err) {
    const msg = err instanceof Error
      ? `${err.message}${err.cause ? ` | cause: ${err.cause}` : ''}`
      : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[bermuda-checkout] error:', msg, stack)
    steps.push({ type: 'error', message: msg || JSON.stringify(err), ts: Date.now() })
    return NextResponse.json({ steps, error: msg || JSON.stringify(err) }, { status: 500 })
  }
}
