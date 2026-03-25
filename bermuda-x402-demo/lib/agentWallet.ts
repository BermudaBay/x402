'use client'

/**
 * Agent wallet — a pre-funded viem WalletClient backed by a raw private key.
 *
 * The private key is loaded from NEXT_PUBLIC_AGENT_PK (testnet only — the key
 * controls worthless test tokens and is intentionally client-exposed for the demo).
 *
 * For any mainnet or production use, move signing server-side.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
} from 'viem'
import { formatUSDC } from '@/lib/products'
// Use ReturnType to avoid type conflicts when multiple viem versions are present
type WalletClient = ReturnType<typeof createWalletClient>
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, hardhat } from 'viem/chains'

// In Bermuda mode: always use real Base Sepolia USDC regardless of NEXT_PUBLIC_USDC_ADDRESS.
// In exact mode: use MockUSDC from NEXT_PUBLIC_USDC_ADDRESS.
const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`
const IS_EXACT_MODE = process.env.NEXT_PUBLIC_BERMUDA_SCHEME === 'exact'
const USDC_ADDRESS: `0x${string}` = IS_EXACT_MODE
  ? ((process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined) ?? BASE_SEPOLIA_USDC)
  : BASE_SEPOLIA_USDC

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export interface AgentWallet {
  walletClient: WalletClient
  publicClient: unknown   // bermudaCheckout accepts unknown; avoids viem version conflicts
  address: `0x${string}`
  getUsdcBalance: () => Promise<string>
}

let _cached: AgentWallet | null = null

/** Why the agent wallet is unavailable (for clearer UI than “no pk”). */
export type AgentPkStatus = 'ok' | 'missing' | 'malformed'

function parseAgentPk(): { ok: true; pk: `0x${string}` } | { ok: false; reason: 'missing' | 'malformed' } {
  const raw = process.env.NEXT_PUBLIC_AGENT_PK?.trim()
  if (!raw) return { ok: false, reason: 'missing' }
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) return { ok: false, reason: 'malformed' }
  return { ok: true, pk: raw as `0x${string}` }
}

/** Client-side: must be `NEXT_PUBLIC_AGENT_PK` in `.env.local` (not `FAUCET_PK`). Restart `next dev` after changing env. */
export function getAgentPkStatus(): AgentPkStatus {
  const p = parseAgentPk()
  return p.ok ? 'ok' : p.reason
}

export function getAgentWallet(): AgentWallet | null {
  if (_cached) return _cached

  const parsed = parseAgentPk()
  if (!parsed.ok) {
    if (parsed.reason === 'malformed') {
      console.error('[AgentWallet] NEXT_PUBLIC_AGENT_PK is set but malformed — expected 0x + 64 hex chars (no quotes)')
    }
    return null
  }

  let account: ReturnType<typeof privateKeyToAccount>
  try {
    account = privateKeyToAccount(parsed.pk)
  } catch (e) {
    console.error('[AgentWallet] Invalid private key:', e)
    return null
  }

  const isTestenv = process.env.NEXT_PUBLIC_NETWORK === 'testenv'
  const chain = isTestenv ? hardhat : baseSepolia
  const envRpc = process.env.NEXT_PUBLIC_RPC_URL?.trim()
  const rpcUrl = isTestenv ? 'http://localhost:8545' : envRpc || undefined

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  })

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

  const getUsdcBalance = async (): Promise<string> => {
    // Read the ERC-20 USDC balance. In Bermuda mode this is the real Base Sepolia USDC.
    // After a payment the agent's USDC moves into the shielded pool; the next payment
    // auto-uses the pool via bermuda::anyhow, so this balance correctly reflects what's
    // available to spend (wallet balance feeds the pool on-demand).
    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const raw = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [account.address],
        })
        return formatUSDC(parseFloat(formatUnits(raw, 6)))
      } catch (e) {
        lastErr = e
        if (attempt < 2) await sleep(350 * (attempt + 1))
      }
    }
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[AgentWallet] USDC balanceOf failed after retries:', lastErr)
    }
    return '?'
  }

  _cached = { walletClient, publicClient, address: account.address, getUsdcBalance }
  return _cached
}

/** True if the agent wallet is configured and ready */
export function agentWalletReady(): boolean {
  return !!getAgentWallet()
}
