'use client'

import React from 'react'
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { useCart, MAX_CART_UNITS } from '@/context/CartContext'
import { formatUSDC } from '@/lib/products'
import { CheckoutButton } from './CheckoutButton'

export function CartDrawer() {
  const { items, isOpen, totalPrice, totalItems, closeCart, increment, decrement, removeItem } = useCart()
  const atDemoCap = totalItems >= MAX_CART_UNITS

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-bermuda-950 border-l border-bermuda-800/50 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bermuda-800/50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-bermuda-400" />
            <h2 className="text-white font-semibold text-lg">Your Order</h2>
            {items.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-bermuda-700/50 text-bermuda-300 text-xs font-medium">
                {items.reduce((s, i) => s + i.qty, 0)} items
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="text-bermuda-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <ShoppingBag className="w-12 h-12 text-bermuda-700 mb-4" />
              <p className="text-bermuda-400 font-medium">Your cart is empty</p>
              <p className="text-bermuda-600 text-sm mt-1">Add a champagne to get started</p>
            </div>
          ) : (
            items.map(({ product, qty }) => (
              <div
                key={product.id}
                className="flex items-center gap-4 p-4 bg-bermuda-900/40 rounded-xl border border-bermuda-800/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{product.name}</p>
                  <p className="text-bermuda-400 text-xs">{product.origin} · {product.vintage}</p>
                  <p className="text-gold-400 font-semibold text-sm mt-1">${formatUSDC(product.price * qty)}</p>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => decrement(product.id)}
                    className="w-7 h-7 rounded-lg bg-bermuda-800/50 hover:bg-bermuda-700/70 flex items-center justify-center text-bermuda-300 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-white text-sm font-semibold">{qty}</span>
                  <button
                    onClick={() => increment(product.id)}
                    disabled={atDemoCap}
                    title={atDemoCap ? `Demo limit: ${MAX_CART_UNITS} bottles total` : 'Add one'}
                    className="w-7 h-7 rounded-lg bg-bermuda-800/50 hover:bg-bermuda-700/70 flex items-center justify-center text-bermuda-300 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeItem(product.id)}
                    className="w-7 h-7 rounded-lg hover:bg-red-900/30 flex items-center justify-center text-bermuda-600 hover:text-red-400 transition-colors ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-5 border-t border-bermuda-800/50 space-y-4">
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-bermuda-400 font-medium">Total</span>
              <div className="text-right">
                <span className="text-white font-bold text-xl">${formatUSDC(totalPrice)}</span>
                <span className="text-bermuda-500 text-xs ml-1.5">USDC</span>
              </div>
            </div>

            {atDemoCap && (
              <p className="text-amber-400/90 text-[11px] text-center">
                Demo cart cap ({MAX_CART_UNITS} bottles) — protects shared test funds.
              </p>
            )}

            {/* x402 privacy note */}
            <div className="bg-bermuda-900/40 border border-bermuda-700/30 rounded-xl p-3">
              <p className="text-bermuda-400 text-xs leading-relaxed">
                <span className="text-bermuda-300 font-medium">🛡 Private payment</span> — powered by Bermuda x402.
                Your transaction will be routed through Bermuda's shielded pool, keeping your balance private.
              </p>
            </div>

            <CheckoutButton onSuccess={closeCart} />
          </div>
        )}
      </div>
    </>
  )
}
