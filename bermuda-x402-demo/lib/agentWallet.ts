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
// Use ReturnType to avoid type conflicts when multiple viem versions are present
type WalletClient = ReturnType<typeof createWalletClient>
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, hardhat } from 'viem/chains'

// In Bermuda mode: Base Sepolia USDC (hardcoded — same address the Bermuda SDK uses internally).
// In exact mode: MockUSDC address from NEXT_PUBLIC_USDC_ADDRESS.
const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`
const USDC_ADDRESS: `0x${string}` =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined) ?? BASE_SEPOLIA_USDC

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
  const rpcUrl = isTestenv ? 'http://localhost:8545' : undefined

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  })

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  const getUsdcBalance = async (): Promise<string> => {
    try {
      const raw = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      })
      return parseFloat(formatUnits(raw, 6)).toFixed(2)
    } catch {
      return '?'
    }
  }

  _cached = { walletClient, publicClient, address: account.address, getUsdcBalance }
  return _cached
}

/** True if the agent wallet is configured and ready */
export function agentWalletReady(): boolean {
  return !!getAgentWallet()
}
