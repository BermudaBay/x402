/**
 * Returns the agent's shielded USDC balance from the Bermuda pool.
 *
 * The regular ERC-20 balanceOf drops to 0 after USDC is deposited into the pool.
 * The real spendable balance lives as UTXOs inside the pool contract.
 * This endpoint scans for unspent UTXOs and sums their amounts.
 */
import { NextResponse } from 'next/server'
import { formatUnits } from 'viem'

export const maxDuration = 30

type SDKModule = {
  default: (opts: string) => Promise<{
    findUtxos: (args: {
      keypair: unknown
      tokens: string[]
      excludeSpent?: boolean
    }) => Promise<Record<string, Array<{ amount: bigint }>>>
    sumAmounts: (utxos?: Array<{ amount: bigint }>) => bigint
  }>
  KeyPair: {
    fromSeed: (seed: string) => unknown
  }
}

let _sdkCache: Promise<SDKModule> | null = null
function loadSDK(): Promise<SDKModule> {
  if (_sdkCache) return _sdkCache
  _sdkCache = import(/* webpackIgnore: true */ 'bermuda-bay-sdk') as unknown as Promise<SDKModule>
  return _sdkCache
}

const IS_TESTENV    = process.env.NEXT_PUBLIC_NETWORK === 'testenv'
const IS_EXACT_MODE = process.env.NEXT_PUBLIC_BERMUDA_SCHEME === 'exact'
// Always use real Base Sepolia USDC in Bermuda mode; MockUSDC only in exact mode
const USDC_ADDRESS  = (IS_EXACT_MODE
  ? (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e')
  : '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
).toLowerCase()

export async function GET() {
  const pk = process.env.NEXT_PUBLIC_AGENT_PK
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    return NextResponse.json({ error: 'Agent PK not configured' }, { status: 400 })
  }

  try {
    const { default: initSDK, KeyPair } = await loadSDK()
    const network = IS_TESTENV ? 'testenv' : 'base-sepolia'
    const sdk = await initSDK(network)
    const keypair = KeyPair.fromSeed(pk)

    const utxosByToken = await sdk.findUtxos({
      keypair,
      tokens: [USDC_ADDRESS],
      excludeSpent: true,
    })

    const utxos = utxosByToken[USDC_ADDRESS] ?? []
    const totalAtoms = sdk.sumAmounts(utxos)
    const balance = parseFloat(formatUnits(totalAtoms, 6))

    return NextResponse.json({ balance })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[shielded-balance]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
