'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react'
import { PRODUCTS, type Product } from '@/lib/products'
import { MAX_CART_UNITS } from '@/lib/demo-limits'
import type { CheckoutResult } from '@/lib/bermuda-client'

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────

export interface CartItem {
  product: Product
  qty: number
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
}

type CartAction =
  | { type: 'ADD'; product: Product }
  | { type: 'REMOVE'; productId: string }
  | { type: 'INCREMENT'; productId: string }
  | { type: 'DECREMENT'; productId: string }
  | { type: 'CLEAR' }
  | { type: 'SET_OPEN'; open: boolean }

// ──────────────────────────────────────────────────
// Reducer
// ──────────────────────────────────────────────────

export { MAX_CART_UNITS } from '@/lib/demo-limits'

function cartTotalUnits(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.qty, 0)
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      if (cartTotalUnits(state.items) >= MAX_CART_UNITS) return state
      const existing = state.items.find(i => i.product.id === action.product.id)
      return {
        ...state,
        isOpen: true,
        items: existing
          ? state.items.map(i =>
              i.product.id === action.product.id ? { ...i, qty: i.qty + 1 } : i
            )
          : [...state.items, { product: action.product, qty: 1 }],
      }
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter(i => i.product.id !== action.productId) }
    case 'INCREMENT': {
      if (cartTotalUnits(state.items) >= MAX_CART_UNITS) return state
      return {
        ...state,
        items: state.items.map(i =>
          i.product.id === action.productId ? { ...i, qty: i.qty + 1 } : i
        ),
      }
    }
    case 'DECREMENT':
      return {
        ...state,
        items: state.items.flatMap(i =>
          i.product.id === action.productId
            ? i.qty <= 1
              ? []
              : [{ ...i, qty: i.qty - 1 }]
            : [i]
        ),
      }
    case 'CLEAR':
      return { ...state, items: [] }
    case 'SET_OPEN':
      return { ...state, isOpen: action.open }
    default:
      return state
  }
}

// ──────────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────────

interface CartContextValue {
  items: CartItem[]
  isOpen: boolean
  totalItems: number
  totalPrice: number
  itemsParam: string
  /** After a successful x402 checkout — drawer shows receipt until dismissed. */
  activeReceipt: CheckoutResult | null
  showReceipt: (order: CheckoutResult) => void
  dismissReceipt: () => void
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  increment: (productId: string) => void
  decrement: (productId: string) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'bermuda-x402-cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false })
  const [activeReceipt, setActiveReceipt] = useState<CheckoutResult | null>(null)

  const showReceipt = useCallback((order: CheckoutResult) => {
    setActiveReceipt(order)
    dispatch({ type: 'SET_OPEN', open: true })
  }, [])

  const dismissReceipt = useCallback(() => {
    setActiveReceipt(null)
  }, [])

  // Hydrate from localStorage once on mount (must match catalog — corrupt data can crash CartDrawer)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed: unknown = JSON.parse(stored)
      if (!Array.isArray(parsed)) return

      const byId = new Map(PRODUCTS.map(p => [p.id, p]))

      for (const row of parsed) {
        if (!row || typeof row !== 'object' || !('product' in row)) continue
        const r = row as { product?: { id?: string }; qty?: number }
        const id = r.product?.id
        if (!id || typeof id !== 'string') continue
        const product = byId.get(id)
        if (!product) continue
        const qty = Math.min(Math.max(1, Math.floor(Number(r.qty) || 1)), MAX_CART_UNITS)
        for (let i = 0; i < qty; i++) {
          dispatch({ type: 'ADD', product })
        }
      }
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
  }, [state.items])

  const totalItems = state.items.reduce((sum, i) => sum + i.qty, 0)
  const totalPrice = state.items.reduce((sum, i) => sum + i.product.price * i.qty, 0)
  const itemsParam = state.items.map(i => `${i.product.id}:${i.qty}`).join(',')

  const addItem = useCallback((product: Product) => dispatch({ type: 'ADD', product }), [])
  const removeItem = useCallback((productId: string) => dispatch({ type: 'REMOVE', productId }), [])
  const increment = useCallback((productId: string) => dispatch({ type: 'INCREMENT', productId }), [])
  const decrement = useCallback((productId: string) => dispatch({ type: 'DECREMENT', productId }), [])
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), [])
  const openCart = useCallback(() => dispatch({ type: 'SET_OPEN', open: true }), [])
  const closeCart = useCallback(() => dispatch({ type: 'SET_OPEN', open: false }), [])

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        isOpen: state.isOpen,
        totalItems,
        totalPrice,
        itemsParam,
        activeReceipt,
        showReceipt,
        dismissReceipt,
        addItem,
        removeItem,
        increment,
        decrement,
        clearCart,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
