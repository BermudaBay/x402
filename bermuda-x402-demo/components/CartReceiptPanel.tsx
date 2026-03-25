'use client'

import React, { useState, useEffect } from 'react'
import { Check, ShieldCheck, ExternalLink, Copy, Check as CheckIcon } from 'lucide-react'
import type { CheckoutResult } from '@/lib/bermuda-client'
import { formatUSDC, getProduct } from '@/lib/products'
import { txExplorerUrl } from '@/lib/explorer'

type Phase = 'celebrating' | 'receipt'

function lineSubtitle(productId: string): string {
  const p = getProduct(productId)
  if (!p) return ''
  const place = p.origin.split(',')[0]?.trim() ?? p.origin
  return `${place} ${p.vintage}`
}

export function CartReceiptPanel({
  order,
  onContinue,
}: {
  order: CheckoutResult
  onContinue: () => void
}) {
  const [phase, setPhase] = useState<Phase>('celebrating')
  const [showNoTraces, setShowNoTraces] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setPhase('receipt'), 1000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (phase !== 'receipt') return
    const t = setTimeout(() => setShowNoTraces(true), 400)
    return () => clearTimeout(t)
  }, [phase])

  const handleCopyTx = async () => {
    if (!order.txHash) return
    try {
      await navigator.clipboard.writeText(order.txHash)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const explorerUrl = order.txHash ? txExplorerUrl(order.txHash) : null

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {phase === 'celebrating' && (
        <div className="relative flex flex-1 flex-col items-center justify-center min-h-[220px] overflow-hidden px-6 py-8">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0">
            {[10, 26, 44, 62, 78, 92].map((left, i) => (
              <span
                key={i}
                className="absolute bottom-10 h-2 w-2 rounded-full border border-white/20 bg-white/[0.08] shadow-[0_0_10px_rgba(255,255,255,0.12)] animate-bubble-rise"
                style={{ left: `${left}%`, animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
          <div
            className="relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-gold-400/35 bg-bermuda-900/60 animate-gold-pulse-shield"
            aria-hidden
          >
            <ShieldCheck className="h-10 w-10 text-gold-400/95" strokeWidth={1.25} />
          </div>
        </div>
      )}

      {phase === 'receipt' && (
        <div className="flex flex-1 flex-col min-h-0 animate-receipt-reveal">
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-5">
            <div className="flex items-start gap-3 pt-1">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-600/40 bg-emerald-950/40">
                <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white font-semibold tracking-tight">Paid privately</p>
                <p className="text-bermuda-500 text-[11px] font-mono uppercase tracking-widest mt-0.5">
                  Receipt
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={`${item.id}-${item.qty}`} className="space-y-1">
                  <p className="text-bermuda-100 font-medium text-sm leading-snug">
                    {item.name}
                    {item.qty > 1 ? (
                      <span className="text-bermuda-500 font-normal"> ×{item.qty}</span>
                    ) : null}
                  </p>
                  <p className="text-bermuda-400 text-xs">
                    ${formatUSDC(item.subtotal)} USDC · {lineSubtitle(item.id)}
                  </p>
                </div>
              ))}
            </div>

            <div
              className={`rounded-xl border border-bermuda-700/35 bg-bermuda-900/35 px-4 py-3 transition-opacity duration-700 ease-out ${
                showNoTraces ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <p className="text-bermuda-200 text-sm">
                <span className="mr-1.5" aria-hidden>
                  🔒
                </span>
                <span className="font-medium">Shielded</span>
                <span className="text-bermuda-500"> · </span>
                <span className="text-bermuda-100">No traces left.</span>
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gold-400/95 hover:text-gold-300 transition-colors w-fit"
                >
                  <span className="text-xs" aria-hidden>
                    ↗
                  </span>
                  View transaction proof
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </a>
              ) : (
                <p className="text-bermuda-500 text-xs">Transaction proof will appear when a tx hash is returned.</p>
              )}
              {order.txHash ? (
                <button
                  type="button"
                  onClick={handleCopyTx}
                  className="inline-flex items-center gap-2 text-left text-xs text-bermuda-400 hover:text-bermuda-200 transition-colors w-fit font-mono"
                >
                  {copiedHash ? (
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {copiedHash ? 'Copied' : 'Copy tx hash'}
                </button>
              ) : null}
            </div>

            <div className="border-t border-bermuda-800/60 pt-4">
              <p className="text-bermuda-600 text-[11px] text-center tracking-wide">
                Powered by Bermuda × x402
              </p>
            </div>
          </div>

          <div className="shrink-0 border-t border-bermuda-800/50 px-5 py-4 space-y-2.5 bg-bermuda-950/80">
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 py-3 rounded-xl border border-bermuda-600/40 text-bermuda-100 text-sm font-medium hover:bg-bermuda-900/50 transition-colors"
              >
                <span aria-hidden>↗</span>
                View on Blockscout
              </a>
            ) : null}
            <button
              type="button"
              onClick={onContinue}
              className="w-full py-3 rounded-xl bg-bermuda-600 hover:bg-bermuda-500 text-white text-sm font-semibold transition-colors"
            >
              Continue shopping
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
