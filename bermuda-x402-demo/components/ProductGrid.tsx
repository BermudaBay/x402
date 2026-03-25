'use client'

import React from 'react'
import { PRODUCTS } from '@/lib/products'
import { ProductCard } from './ProductCard'
import { useAgent } from '@/context/AgentContext'

export function ProductGrid() {
  const { highlightedProductIds } = useAgent()

  return (
    <section
      id="bermuda-collection"
      className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:scroll-mt-28 lg:px-8"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white">Bermuda Collection</h2>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {PRODUCTS.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            highlighted={highlightedProductIds.includes(product.id)}
          />
        ))}
      </div>
    </section>
  )
}
