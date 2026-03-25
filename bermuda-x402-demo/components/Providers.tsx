'use client'

import React from 'react'
import { CartProvider } from '@/context/CartContext'
import { ClientRootErrorBoundary } from '@/components/ClientRootErrorBoundary'
import { FatalErrorOverlay } from '@/components/FatalErrorOverlay'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Outside ClientRootErrorBoundary so it mounts even when an inner tree throws before paint */}
      <FatalErrorOverlay />
      <ClientRootErrorBoundary>
        <CartProvider>{children}</CartProvider>
      </ClientRootErrorBoundary>
    </>
  )
}
