/**
 * Server-side x402 configuration.
 *
 * Default mode: "bermuda" — uses x402BermudaServerScheme with the live
 *   Bermuda privacy pool on Base Sepolia.  Token: real Base Sepolia USDC.
 *   Facilitator: self-hosted at /api/facilitator which forwards to Tilapia relayer.
 *
 * Fallback mode (NEXT_PUBLIC_BERMUDA_SCHEME=exact): ExactEvmScheme with MockUSDC
 *   and self-hosted EIP-3009 facilitator. Useful for testing without ZK overhead.
 *
 * Import this ONLY in API routes / server components.
 */

import { withX402 } from '@x402/next'
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import type { NextRequest, NextResponse } from 'next/server'
import type { Network } from '@x402/core/types'
import { parseItemsParam, calcTotal, formatUSDC } from './products'

// ──────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────

const PAY_TO          = (process.env.NEXT_PUBLIC_PAY_TO       ?? '0x0000000000000000000000000000000000000001').trim()
const FACILITATOR_URL = process.env.FACILITATOR_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/facilitator` : 'http://localhost:3000/api/facilitator')
const IS_TESTENV      = process.env.NEXT_PUBLIC_NETWORK       === 'testenv'
const ACTIVE_NETWORK  = (IS_TESTENV ? 'eip155:31337' : 'eip155:84532') as Network

// Bermuda is the default scheme; set NEXT_PUBLIC_BERMUDA_SCHEME=exact to use ExactEvmScheme
const USE_BERMUDA     = process.env.NEXT_PUBLIC_BERMUDA_SCHEME !== 'exact'

// Used only when NEXT_PUBLIC_BERMUDA_SCHEME=exact (MockUSDC + EIP-3009)
const MOCK_USDC       = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '') as `0x${string}`
const USDC_NAME       = process.env.NEXT_PUBLIC_USDC_NAME    ?? 'USD Coin'
const USDC_VERSION    = process.env.NEXT_PUBLIC_USDC_VERSION ?? '2'

// ──────────────────────────────────────────────────
// Resource server — shared singleton
// ──────────────────────────────────────────────────

let resourceServer: x402ResourceServer

async function getResourceServer(): Promise<x402ResourceServer> {
  if (resourceServer) return resourceServer

  const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL })

  if (USE_BERMUDA) {
    // Bermuda privacy scheme — live on Base Sepolia via Tilapia Labs relayer
    // webpackIgnore: prevents webpack from bundling this ESM-with-top-level-await package
    const { x402BermudaServerScheme } = await import(/* webpackIgnore: true */ 'bermuda-bay-sdk')
    const bermudaScheme = new x402BermudaServerScheme('bermuda::anyhow')
    resourceServer = new x402ResourceServer(facilitator)
      .register('eip155:84532' as Network, bermudaScheme)
      .register('eip155:31337' as Network, bermudaScheme)
  } else {
    // Standard EIP-3009 exact scheme — for MockUSDC testing
    const exactScheme = new ExactEvmScheme()
    resourceServer = new x402ResourceServer(facilitator)
      .register('eip155:84532' as Network, exactScheme)
      .register('eip155:31337' as Network, exactScheme)
  }

  // Explicitly initialize so errors surface with proper logging
  try {
    await resourceServer.initialize()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[server] resourceServer.initialize() failed. FACILITATOR_URL=${FACILITATOR_URL} error=${msg}`)
    throw err
  }

  return resourceServer
}

// ──────────────────────────────────────────────────
// withBermudaPayment
// ──────────────────────────────────────────────────

/**
 * Wraps a Next.js route handler with x402 payment protection.
 * Dynamic price is resolved from `?items=id:qty,id:qty` query params.
 */
export function withBermudaPayment(
  handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const server = await getResourceServer()
    const scheme = USE_BERMUDA ? 'bermuda::anyhow' : 'exact'

    const wrapped = withX402(
      handler,
      {
        accepts: {
          scheme,
          payTo:   PAY_TO,
          network: ACTIVE_NETWORK,
          // In exact mode, include MockUSDC address + EIP-712 domain for EIP-3009 signing
          ...(!USE_BERMUDA && MOCK_USDC ? {
            asset: MOCK_USDC,
            extra: { name: USDC_NAME, version: USDC_VERSION },
          } : {}),
          price: (ctx) => {
            const getParam = ctx.adapter.getQueryParam?.bind(ctx.adapter)
            const itemsParam = getParam ? getParam('items') : undefined
            const raw = Array.isArray(itemsParam) ? (itemsParam[0] ?? '') : (itemsParam ?? '')
            const items = parseItemsParam(raw)
            if (!items) return '$1.00'
            return `$${formatUSDC(calcTotal(items))}`
          },
        },
        description: 'Bermuda private champagne checkout',
      },
      server,
      undefined, // paywallConfig
      undefined, // paywall
      false      // syncFacilitatorOnStart=false — initialize lazily on first request
    )

    return wrapped(req)
  }
}
