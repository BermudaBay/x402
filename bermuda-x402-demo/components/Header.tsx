'use client'

import React from 'react'
import Link from 'next/link'
import { ShoppingCart, ChevronDown } from 'lucide-react'
import { useCart } from '@/context/CartContext'

function HowItWorksBody() {
  return (
    <>
      <p className="mb-2 text-bermuda-300 font-medium leading-snug">
        This demo runs like a real store — browse, add to cart, pay. No wallet popups. The x402 protocol handles
        everything silently in the background.
      </p>
      <ul className="space-y-1.5 list-disc pl-3.5 marker:text-bermuda-600">
        <li>
          <strong className="text-bermuda-400">Agent wallet —</strong> A server-side wallet holds the test USDC you see
          displayed. That balance reflects the agent&apos;s shielded pool, not a connected browser wallet.
        </li>
        <li>
          <strong className="text-bermuda-400">Faucet —</strong> Hit &quot;Top Up&quot; to mint mock USDC into the
          agent. Make sure <code className="text-bermuda-500">FAUCET_PK</code> stays funded with Base Sepolia ETH or
          mints will fail during live demos.
        </li>
        <li>
          <strong className="text-bermuda-400">Checkout —</strong> The shielded pool funds before you pay. When you
          complete a purchase, the agent spends from it — the receipt and inspector panel show the full flow live.
        </li>
        <li>
          <strong className="text-bermuda-400">Transaction link —</strong> After payment, the tx link defaults to Base
          Sepolia Blockscout. Override with <code className="text-bermuda-500">NEXT_PUBLIC_EXPLORER_TX_URL</code> to
          point elsewhere.
        </li>
        <li>
          <strong className="text-bermuda-400">No mic? —</strong> Use the quick preset buttons. Same flow, same result
          — just without voice.
        </li>
      </ul>
    </>
  )
}

export function Header() {
  const { totalItems, openCart } = useCart()

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backgroundColor: 'rgba(4, 47, 46, 0.96)',
        borderBottom: '1px solid rgba(17, 94, 89, 0.5)',
      }}
      className="backdrop-blur-sm"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '3.5rem',
            gap: '0.5rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
          }}
          className="sm:h-16 sm:py-0"
        >
          <div className="flex min-w-0 flex-1 items-center">
            <Link
              href="/"
              className="shrink-0 flex flex-col gap-0.5 rounded-md outline-none ring-offset-2 ring-offset-[rgba(4,47,46,0.96)] focus-visible:ring-2 focus-visible:ring-bermuda-400 min-w-0"
            >
              {/* Wordmark + tagline split from public/bermuda-logo-white.svg */}
              <img
                src="/bermuda-logo-wordmark.svg"
                alt="Bermuda Cellars"
                width={1775}
                height={122}
                decoding="async"
                fetchPriority="high"
                className="h-6 w-auto max-w-[200px] object-contain object-left sm:h-7 sm:max-w-[240px] md:h-8 md:max-w-[280px]"
              />
              <img
                src="/bermuda-tagline.svg"
                alt="Seamless, Compliant and Composable Privacy"
                width={935}
                height={56}
                decoding="async"
                className="hidden sm:block h-2 w-auto max-w-[min(100%,240px)] object-contain object-left opacity-90 md:max-w-[280px] md:h-2.5"
              />
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <details className="hidden md:block group relative">
              <summary className="list-none cursor-pointer flex items-center gap-0.5 text-[11px] text-white select-none whitespace-nowrap px-2 py-1.5 rounded-lg hover:bg-white/10">
                How it works
                <ChevronDown className="w-3 h-3 text-white transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-full mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-bermuda-800/60 bg-bermuda-950/98 backdrop-blur-md shadow-xl p-3 text-[11px] text-bermuda-400 leading-relaxed z-50">
                <HowItWorksBody />
              </div>
            </details>

            <button
              onClick={openCart}
              className="relative flex items-center justify-center w-11 h-11 sm:w-10 sm:h-10 rounded-xl bg-bermuda-800/50 hover:bg-bermuda-700/60 border border-white/50 hover:border-white transition-colors touch-manipulation"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-5 h-5 text-white" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-bermuda-500 text-white text-xs font-bold">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        <details className="md:hidden border-t border-bermuda-800/40 py-2 group">
          <summary className="list-none flex items-center gap-1 text-[11px] text-white font-medium cursor-pointer select-none touch-manipulation">
            <ChevronDown className="w-3.5 h-3.5 text-white transition-transform group-open:rotate-180 shrink-0" />
            How this demo works
          </summary>
          <div className="mt-2 pl-0.5 text-[11px] text-bermuda-400 leading-relaxed pb-1">
            <HowItWorksBody />
          </div>
        </details>
      </div>
    </header>
  )
}
