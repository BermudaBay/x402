'use client'

import React from 'react'
import { CartProvider } from '@/context/CartContext'
import { ClientRootErrorBoundary } from '@/components/ClientRootErrorBoundary'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClientRootErrorBoundary>
      <CartProvider>{children}</CartProvider>
    </ClientRootErrorBoundary>
  )
}
