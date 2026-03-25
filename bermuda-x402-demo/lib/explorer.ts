/**
 * Transaction URLs for the demo — defaults to Base Sepolia Blockscout (per team feedback).
 * Override with NEXT_PUBLIC_EXPLORER_TX_URL (full base, no trailing slash), e.g. https://sepolia.basescan.org
 */

export function txExplorerUrl(txHash: string): string {
  const envBase = process.env.NEXT_PUBLIC_EXPLORER_TX_URL?.replace(/\/$/, '')
  if (envBase) return `${envBase}/tx/${txHash}`

  const isTestenv = process.env.NEXT_PUBLIC_NETWORK === 'testenv'
  const fallback = isTestenv ? 'http://localhost:4194' : 'https://base-sepolia.blockscout.com'
  return `${fallback}/tx/${txHash}`
}
