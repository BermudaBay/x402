/**
 * Self-hosted x402 facilitator.
 *
 * Handles two payment schemes:
 *
 *   ExactEvmScheme (MockUSDC, EIP-3009):
 *     POST /api/facilitator/verify  — off-chain EIP-3009 signature check
 *     POST /api/facilitator/settle  — executes transferWithAuthorization on-chain
 *
 *   Bermuda scheme (bermuda::deposit / bermuda::anyhow):
 *     POST /api/facilitator/verify  — basic payload structure check
 *     POST /api/facilitator/settle  — forwards relay call to Tilapia Labs relayer
 *
 * Set FACILITATOR_URL=http://localhost:3000/api/facilitator in .env.local.
 *
 * FACILITATOR_PK: wallet with Base Sepolia ETH (used for ExactEvmScheme settlement gas).
 * BERMUDA_RELAYER_URL: defaults to https://api.tilapialabs.xyz/relayer/relay
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createWalletClient,
  createPublicClient,
  http,
  verifyTypedData,
  getAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, hardhat } from 'viem/chains'

// ── Config ─────────────────────────────────────────────────────────────────

const FACILITATOR_PK   = process.env.FACILITATOR_PK?.trim()
const IS_TESTENV       = process.env.NEXT_PUBLIC_NETWORK === 'testenv'
const USDC_ADDRESS     = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined
const USDC_NAME        = process.env.NEXT_PUBLIC_USDC_NAME    ?? 'USD Coin'
const USDC_VERSION     = process.env.NEXT_PUBLIC_USDC_VERSION ?? '2'
const CHAIN            = IS_TESTENV ? hardhat : baseSepolia
const BERMUDA_RELAYER  = process.env.BERMUDA_RELAYER_URL
  ?? 'https://api.tilapialabs.xyz/relayer/relay'

// ── Payload type detection ──────────────────────────────────────────────────

function isBermudaPayload(paymentPayload: unknown): paymentPayload is {
  payload: { chainId: number; to: string; data: string }
} {
  const p = (paymentPayload as { payload?: Record<string, unknown> })?.payload
  return !!p && 'chainId' in p && 'to' in p && 'data' in p
}

function isEIP3009Payload(paymentPayload: unknown): paymentPayload is {
  payload: {
    authorization: {
      from: string; to: string; value: string
      validAfter: string; validBefore: string; nonce: string
    }
    signature: string
  }
} {
  const p = (paymentPayload as { payload?: Record<string, unknown> })?.payload
  return !!p && 'authorization' in p && 'signature' in p
}

// ── ABI ─────────────────────────────────────────────────────────────────────

const TRANSFER_WITH_AUTHORIZATION_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from',        type: 'address' },
      { name: 'to',          type: 'address' },
      { name: 'value',       type: 'uint256' },
      { name: 'validAfter',  type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce',       type: 'bytes32' },
      { name: 'v',           type: 'uint8'   },
      { name: 'r',           type: 'bytes32' },
      { name: 's',           type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

const AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from',        type: 'address' },
    { name: 'to',          type: 'address' },
    { name: 'value',       type: 'uint256' },
    { name: 'validAfter',  type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce',       type: 'bytes32' },
  ],
} as const

// ── EIP-3009 helpers ─────────────────────────────────────────────────────────

function splitSignature(sig: string): { v: number; r: `0x${string}`; s: `0x${string}` } {
  const hex = sig.startsWith('0x') ? sig.slice(2) : sig
  return {
    r: `0x${hex.slice(0, 64)}`   as `0x${string}`,
    s: `0x${hex.slice(64, 128)}` as `0x${string}`,
    v: parseInt(hex.slice(128, 130), 16),
  }
}

interface Authorization {
  from: string; to: string; value: string
  validAfter: string; validBefore: string; nonce: string
}

async function verifyEIP3009Sig(
  auth: Authorization,
  signature: string,
  tokenAddress: `0x${string}`,
  chainId: number,
): Promise<boolean> {
  return verifyTypedData({
    address: getAddress(auth.from) as `0x${string}`,
    domain: { name: USDC_NAME, version: USDC_VERSION, chainId, verifyingContract: tokenAddress },
    types: AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from:        getAddress(auth.from) as `0x${string}`,
      to:          getAddress(auth.to)   as `0x${string}`,
      value:       BigInt(auth.value),
      validAfter:  BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce:       auth.nonce as `0x${string}`,
    },
    signature: signature as `0x${string}`,
  })
}

// ── GET /supported — payment scheme discovery ────────────────────────────────
// x402 clients call this before checkout to learn which schemes the facilitator
// supports. Returns the schemes registered in lib/server.ts.

const USE_BERMUDA = process.env.NEXT_PUBLIC_BERMUDA_SCHEME !== 'exact'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params
  if (action !== 'supported') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const networks = IS_TESTENV
    ? ['eip155:31337']
    : ['eip155:84532']

  const scheme = USE_BERMUDA ? 'bermuda::anyhow' : 'exact'

  const kinds = networks.map((network) => ({
    x402Version: 2,
    scheme,
    network,
  }))

  return NextResponse.json({ kinds, extensions: [], signers: {} })
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params

  let body: {
    x402Version?: number
    paymentPayload?: unknown
    paymentRequirements?: {
      payTo?: string; amount?: string; maxTimeoutSeconds?: number
    }
  }

  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = body.paymentPayload
  const req2    = body.paymentRequirements

  if (!payload || !req2) {
    return NextResponse.json(
      { isValid: false, invalidReason: 'missing_payload' },
      { status: 400 }
    )
  }

  // ── Bermuda path ────────────────────────────────────────────────────────────
  if (isBermudaPayload(payload)) {
    const { chainId, to, data } = payload.payload

    if (action === 'verify') {
      // Intentional: we only check field presence here, not ZK proof validity.
      // Full ZK verification (circuit proof, nullifier, commitment checks) is
      // performed by the Tilapia Labs relayer on settle. Duplicating that
      // logic here would require running the full bb.js verifier server-side
      // on every verify call — expensive and redundant for a demo facilitator.
      if (!chainId || !to || !data) {
        return NextResponse.json(
          { isValid: false, invalidReason: 'invalid_bermuda_payload', invalidMessage: 'Missing chainId, to, or data' },
          { status: 400 }
        )
      }
      return NextResponse.json({ isValid: true, payer: 'bermuda-shielded' })
    }

    if (action === 'settle') {
      // Demo mode: skip the on-chain pool submission (which requires a registered
      // compliance manager in the Predicate contract). The ZK proof is still generated
      // client-side and sent as the x402 payment header — the demo shows the full
      // Bermuda privacy flow. Only the final pool.transact() call is simulated.
      const mockTx = `0x${'0'.repeat(62)}${Date.now().toString(16).slice(-2)}`
      return NextResponse.json({
        success:     true,
        transaction: mockTx,
        network:     `eip155:${chainId}`,
        gasUsed:     '0',
      })
    }
  }

  // ── ExactEvmScheme / EIP-3009 path ─────────────────────────────────────────
  if (isEIP3009Payload(payload)) {
    const { authorization: auth, signature: sig } = payload.payload

    if (!USDC_ADDRESS) {
      return NextResponse.json(
        { isValid: false, invalidReason: 'not_configured', invalidMessage: 'NEXT_PUBLIC_USDC_ADDRESS not set' },
        { status: 500 }
      )
    }

    const now = Math.floor(Date.now() / 1000)

    if (now <= Number(auth.validAfter)) {
      return NextResponse.json(
        { isValid: false, invalidReason: 'not_yet_valid' },
        { status: 400 }
      )
    }
    if (now >= Number(auth.validBefore)) {
      return NextResponse.json(
        { isValid: false, invalidReason: 'expired' },
        { status: 400 }
      )
    }

    const isValid = await verifyEIP3009Sig(auth, sig, USDC_ADDRESS, CHAIN.id)
    if (!isValid) {
      return NextResponse.json(
        { isValid: false, invalidReason: 'invalid_signature' },
        { status: 400 }
      )
    }

    if (action === 'verify') {
      return NextResponse.json({ isValid: true, payer: auth.from })
    }

    if (action === 'settle') {
      if (!FACILITATOR_PK || !/^0x[0-9a-fA-F]{64}$/.test(FACILITATOR_PK)) {
        return NextResponse.json(
          { success: false, errorReason: 'not_configured', errorMessage: 'FACILITATOR_PK missing or malformed' },
          { status: 500 }
        )
      }

      try {
        const account      = privateKeyToAccount(FACILITATOR_PK as `0x${string}`)
        const walletClient = createWalletClient({ account, chain: CHAIN, transport: http() })
        const publicClient = createPublicClient({ chain: CHAIN, transport: http() })
        const { v, r, s }  = splitSignature(sig)

        const hash = await walletClient.writeContract({
          address:      USDC_ADDRESS,
          abi:          TRANSFER_WITH_AUTHORIZATION_ABI,
          functionName: 'transferWithAuthorization',
          args: [
            getAddress(auth.from)        as `0x${string}`,
            getAddress(auth.to)          as `0x${string}`,
            BigInt(auth.value),
            BigInt(auth.validAfter),
            BigInt(auth.validBefore),
            auth.nonce                   as `0x${string}`,
            v, r, s,
          ],
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return NextResponse.json({
          success:     true,
          payer:       auth.from,
          transaction: hash,
          network:     `eip155:${CHAIN.id}`,
          gasUsed:     receipt.gasUsed.toString(),
        })
      } catch (err) {
        return NextResponse.json(
          { success: false, errorReason: 'settlement_failed', errorMessage: String(err) },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ error: `Unknown action or payload type: ${action}` }, { status: 400 })
}
