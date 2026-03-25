'use client'

import React, { useState, useRef, useLayoutEffect, useEffect, useId } from 'react'
import { ShoppingCart, Star, Package } from 'lucide-react'
import type { Product, ProductBadge } from '@/lib/products'
import { formatUSDC } from '@/lib/products'
import { useCart } from '@/context/CartContext'

interface ProductCardProps {
  product: Product
  highlighted?: boolean
}

const BADGE_STYLES: Record<ProductBadge, string> = {
  'Best Seller': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Limited: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
}

export function ProductCard({ product, highlighted = false }: ProductCardProps) {
  const { addItem } = useCart()
  const [imageFailed, setImageFailed] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [descriptionCanToggle, setDescriptionCanToggle] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const descriptionId = useId()

  useLayoutEffect(() => {
    const el = descriptionRef.current
    if (!el) return
    if (descriptionExpanded) {
      setDescriptionCanToggle(true)
      return
    }
    setDescriptionCanToggle(el.scrollHeight > el.clientHeight + 2)
  }, [product.description, descriptionExpanded])

  useEffect(() => {
    const onResize = () => {
      const el = descriptionRef.current
      if (!el || descriptionExpanded) return
      setDescriptionCanToggle(el.scrollHeight > el.clientHeight + 2)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [descriptionExpanded, product.description])

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '1rem',
        backgroundColor: '#042f2e',
        border:
          highlighted
            ? '1px solid rgba(45, 212, 191, 0.65)'
            : '1px solid rgba(17, 94, 89, 0.45)',
      }}
      className={`group transition-all duration-300 hover:shadow-lg hover:shadow-bermuda-900/50
      ${highlighted
        ? 'shadow-xl shadow-bermuda-600/30 ring-2 ring-bermuda-400/40 scale-[1.02]'
        : 'hover:border-bermuda-600/50'
      }`}
    >
      {/* Agent selection badge */}
      {highlighted && (
        <div
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 20 }}
          className="flex items-center gap-1 rounded-full border border-bermuda-400/40 bg-bermuda-500/20 px-2 py-1 text-xs font-semibold text-bermuda-300 animate-pulse"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-bermuda-400 inline-block" />
          Agent
        </div>
      )}

      {/* Product badge — only Best Seller | Limited (see ProductBadge) */}
      {product.badge && (
        <div
          style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${BADGE_STYLES[product.badge]}`}
        >
          {product.badge}
        </div>
      )}

      {/* Bottle image — inline box + img sizing survives missing Tailwind; utilities still polish when loaded */}
      <div
        style={{ position: 'relative', height: '16rem', width: '100%', overflow: 'hidden' }}
        className="bg-gradient-to-b from-bermuda-900/30 to-bermuda-950"
      >
        <div
          style={{ position: 'absolute', inset: 0, opacity: 0.1 }}
          className="bg-[radial-gradient(ellipse_at_center,#14b8a6,transparent)]"
        />
        {!imageFailed && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '0.75rem 0.5rem 0.375rem',
            }}
            className="min-h-0 min-w-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.name}
              style={{
                display: 'block',
                maxHeight: '100%',
                width: 'auto',
                maxWidth: '100%',
                objectFit: 'contain',
                objectPosition: 'bottom',
                clipPath: 'inset(2.4%)',
              }}
              className="h-auto min-h-0 min-w-0 transition-opacity duration-300 group-hover:opacity-95"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        {imageFailed && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package className="w-20 h-20 text-bermuda-700" aria-hidden />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '1.25rem' }} className="p-5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-white font-semibold text-lg leading-snug">{product.name}</h3>
          <span className="text-gold-400 font-bold text-lg whitespace-nowrap">
            ${formatUSDC(product.price)}
          </span>
        </div>

        <p className="text-bermuda-400 text-xs mb-2 flex items-center gap-1">
          <Star className="w-3 h-3 fill-gold-400 text-gold-400" />
          {product.origin} · {product.vintage}
        </p>

        <div className="mb-4">
          <p
            id={descriptionId}
            ref={descriptionRef}
            className={`text-bermuda-300 text-sm leading-relaxed ${descriptionExpanded ? '' : 'line-clamp-3'}`}
          >
            {product.description}
          </p>
          {descriptionCanToggle && (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-bermuda-400 transition-colors hover:text-teal-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bermuda-400 rounded-sm"
              aria-expanded={descriptionExpanded}
              aria-controls={descriptionId}
              onClick={() => setDescriptionExpanded(e => !e)}
            >
              {descriptionExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Grapes — only field that differs per bottle here */}
        <div className="mb-4 bg-bermuda-900/40 rounded-lg px-2.5 py-1.5">
          <p className="text-bermuda-500 text-[10px] uppercase tracking-wider capitalize">grapes</p>
          <p className="text-bermuda-200 text-xs font-medium">{product.details.grapes}</p>
        </div>

        {/* Add to cart */}
        <button
          type="button"
          onClick={() => addItem(product)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            border: '1px solid rgba(13, 148, 136, 0.45)',
            backgroundColor: 'rgba(13, 148, 136, 0.22)',
            color: '#e7e5e4',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
          className="transition-all duration-200 hover:border-bermuda-400 hover:bg-bermuda-500/40 hover:text-white group/btn"
        >
          <ShoppingCart className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
          Add to Cart
        </button>
      </div>
    </div>
  )
}
