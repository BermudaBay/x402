'use client'

import React, { useCallback, useState } from 'react'
import { X, CheckCircle, ShieldCheck, ExternalLink, Package, Copy, Check } from 'lucide-react'
import type { CheckoutResult } from '@/lib/bermuda-client'
import { formatUSDC } from '@/lib/products'
import { txExplorerUrl } from '@/lib/explorer'

interface ConfirmationModalProps {
  order: CheckoutResult
  onClose: () => void
}

function receiptText(order: CheckoutResult): string {
  const lines = [
    'Bermuda Cellars — receipt',
    `Order #${order.orderId.slice(0, 8).toUpperCase()}`,
    ...order.items.map(i => `  ${i.name} ×${i.qty}  $${i.subtotal?.toFixed(2) ?? ''}`),
    `Total: $${formatUSDC(order.total)} USDC`,
    order.txHash ? `Tx: ${order.txHash}` : '',
    `Shielded: ${order.shieldedAddress}`,
  ]
  return lines.filter(Boolean).join('\n')
}

export function ConfirmationModal({ order, onClose }: ConfirmationModalProps) {
  const [copied, setCopied] = useState(false)
  const handleCopyReceipt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(receiptText(order))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [order])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-bermuda-950 border border-emerald-700/40 rounded-2xl shadow-2xl p-6 animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-bermuda-500 hover:text-bermuda-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-900/30 border-2 border-emerald-700/40 mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-bermuda-500 text-[10px] font-mono uppercase tracking-widest mb-1">Receipt</p>
          <h2 className="text-white font-bold text-xl mb-1">Order Confirmed!</h2>
          <p className="text-bermuda-400 text-sm">
            Your champagne is on its way — paid privately via Bermuda x402
          </p>
        </div>

        {/* Privacy badge */}
        <div className="flex items-center gap-2.5 bg-bermuda-900/40 border border-bermuda-700/30 rounded-xl p-3 mb-5">
          <ShieldCheck className="w-5 h-5 text-bermuda-400 shrink-0" />
          <div>
            <p className="text-bermuda-200 text-sm font-medium">Shielded payment complete</p>
            <p className="text-bermuda-500 text-xs mt-0.5">
              Funds were already in the agent&apos;s shielded balance; checkout spent from that pool — your on-chain footprint stays minimal.
            </p>
          </div>
        </div>

        {/* Order details */}
        <div className="space-y-3 mb-5">
          {/* Items */}
          <div className="bg-bermuda-900/40 rounded-xl border border-bermuda-800/40 overflow-hidden">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-bermuda-800/30 last:border-0">
                <Package className="w-4 h-4 text-bermuda-500 shrink-0" />
                <span className="text-bermuda-200 text-sm flex-1">{item.name}</span>
                <span className="text-bermuda-500 text-xs">×{item.qty}</span>
                <span className="text-gold-400 font-semibold text-sm">${item.subtotal?.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-bermuda-900/60">
              <span className="text-bermuda-300 font-medium text-sm">Total paid</span>
              <span className="text-white font-bold">${formatUSDC(order.total)} USDC</span>
            </div>
          </div>

          {/* Bermuda shielded address */}
          <div className="bg-bermuda-900/30 rounded-xl px-4 py-3 border border-bermuda-800/30">
            <p className="text-bermuda-500 text-[10px] uppercase tracking-wider mb-1">Bermuda Shielded Address</p>
            <p className="font-mono text-[11px] text-bermuda-300 break-all">{order.shieldedAddress}</p>
          </div>

          {/* Tx hash if available */}
          {order.txHash && (
            <a
              href={txExplorerUrl(order.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-bermuda-400 hover:text-bermuda-200 text-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View transaction on explorer
            </a>
          )}

          <button
            type="button"
            onClick={handleCopyReceipt}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-bermuda-300 hover:text-white border border-bermuda-700/40 hover:border-bermuda-500/40 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy receipt'}
          </button>

          {/* Order ID */}
          <p className="text-bermuda-700 text-[10px] font-mono text-center">
            Order #{order.orderId.slice(0, 8).toUpperCase()}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-bermuda-600 hover:bg-bermuda-500 text-white font-semibold transition-colors"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  )
}
