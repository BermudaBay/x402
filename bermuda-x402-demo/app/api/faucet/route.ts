/**
 * Token faucet — drips MockUSDC by calling mint() directly.
 *
 * No pre-funded wallet needed: MockUSDC.mint() is permissionless.
 * The faucet wallet only needs Base Sepolia ETH for gas.
 *
 * Rate limiting: uses Upstash Redis (survives serverless cold starts).
 * Falls back to an in-memory Map if UPSTASH_REDIS_REST_URL is not set.
 *
 * Note: this endpoint is only meaningful in exact mode (NEXT_PUBLIC_BERMUDA_SCHEME=exact).
 * In Bermuda mode, the agent uses real Base Sepolia USDC — top up via faucet.circle.com.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, hardhat } from 'viem/chains'

const FAUCET_PK      = process.env.FAUCET_PK
const USDC_ADDRESS   = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined
const IS_TESTENV     = process.env.NEXT_PUBLIC_NETWORK === 'testenv'
const DRIP_AMOUNT    = '200' // MockUSDC (6 decimals)
const DRIP_COOLDOWN  = 5 * 60 // 5 minutes in seconds

const MOCK_USDC_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',     type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

// ── Rate limiter ─────────────────────────────────────────────────────────────
// Uses Upstash Redis when configured — survives serverless cold starts.
// Falls back to in-memory Map for local dev.

async function isRateLimited(address: string): Promise<{ limited: boolean; retryAfterSecs?: number }> {
  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (upstashUrl && upstashToken) {
    // Upstash Redis HTTP API — works in serverless/edge
    const key = `faucet:${address}`
    const setRes = await fetch(`${upstashUrl}/set/${key}/1/EX/${DRIP_COOLDOWN}/NX`, {
      headers: { Authorization: `Bearer ${upstashToken}` },
    })
    const { result } = await setRes.json() as { result: string | null }
    if (result === null) {
      // Key already exists — get TTL to report retry-after
      const ttlRes = await fetch(`${upstashUrl}/ttl/${key}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      })
      const { result: ttl } = await ttlRes.json() as { result: number }
      return { limited: true, retryAfterSecs: Math.max(ttl, 1) }
    }
    return { limited: false }
  }

  // In-memory fallback (dev only — resets on cold start)
  const now     = Date.now()
  const lastDrip = memoryLimiter.get(address) ?? 0
  const elapsed  = (now - lastDrip) / 1000
  if (elapsed < DRIP_COOLDOWN) {
    return { limited: true, retryAfterSecs: Math.ceil(DRIP_COOLDOWN - elapsed) }
  }
  memoryLimiter.set(address, now)
  return { limited: false }
}

const memoryLimiter = new Map<string, number>()

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { address?: string }
  try {
    body = await req.json() as { address?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const address = body.address?.toLowerCase()
  if (!address || !/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  if (!USDC_ADDRESS) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_USDC_ADDRESS is not configured — deploy MockUSDC first' },
      { status: 500 }
    )
  }

  if (!FAUCET_PK) {
    return NextResponse.json(
      { error: 'FAUCET_PK is not configured — add a wallet with Base Sepolia ETH for gas' },
      { status: 500 }
    )
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(FAUCET_PK)) {
    return NextResponse.json({ error: 'FAUCET_PK is malformed' }, { status: 500 })
  }

  const { limited, retryAfterSecs } = await isRateLimited(address)
  if (limited) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${retryAfterSecs}s.` },
      { status: 429 }
    )
  }

  const chain = IS_TESTENV ? hardhat : baseSepolia

  try {
    const account      = privateKeyToAccount(FAUCET_PK as `0x${string}`)
    const walletClient = createWalletClient({ account, chain, transport: http() })

    const hash = await walletClient.writeContract({
      address:      USDC_ADDRESS,
      abi:          MOCK_USDC_ABI,
      functionName: 'mint',
      args:         [address as `0x${string}`, parseUnits(DRIP_AMOUNT, 6)],
    })

    return NextResponse.json({
      success: true,
      message: `${DRIP_AMOUNT} USDC minted`,
      txHash:  hash,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Mint failed', detail: String(err) },
      { status: 500 }
    )
  }
}
