'use client'

import React from 'react'
import Image from 'next/image'
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
          <strong className="text-bermuda-400">Checkout —</strong> The shielded pool funds before you pay. When you
          complete a purchase, the agent spends from it — the receipt and inspector panel show the full flow live.
        </li>
        <li>
          <strong className="text-bermuda-400">Transaction link —</strong> After payment, the tx link defaults to Base
          Sepolia Blockscout.
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
      <div className="mx-auto flex max-w-7xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        {/* Dedicated row so the wordmark never shares a flex line with the mobile &quot;How this works&quot; block */}
        <div
          className="flex w-full min-h-[3.25rem] items-center justify-between gap-3 py-2.5 sm:h-16 sm:min-h-0 sm:py-0"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="min-w-0 flex-1 pr-1" style={{ minWidth: 0 }}>
            <div className="flex flex-col gap-2">
              <Link
                href="/"
                className="inline-block w-fit shrink-0 outline-none ring-offset-2 ring-offset-[rgba(4,47,46,0.96)] focus-visible:ring-2 focus-visible:ring-bermuda-400"
              >
                <Image
                  src="/bermuda-logo-wordmark.svg"
                  alt="Bermuda"
                  width={560}
                  height={40}
                  priority
                  className="h-[40px] w-auto max-w-[min(360px,60vw)] object-contain object-left sm:h-[48px] sm:max-w-[400px]"
                />
              </Link>
            </div>
          </div>

          <div
            className="flex shrink-0 items-center gap-1 sm:gap-2"
            style={{ display: 'flex', flexDirection: 'row', flexShrink: 0, alignItems: 'center' }}
          >
            <details className="hidden md:block group relative">
              <summary className="list-none cursor-pointer flex items-center gap-0.5 text-[11px] text-white select-none whitespace-nowrap px-2 py-1.5 rounded-lg hover:bg-white/10">
                How it works
                <ChevronDown className="w-3 h-3 text-white transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-full mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-bermuda-800/60 bg-bermuda-950 backdrop-blur-none shadow-xl p-3 text-[11px] text-bermuda-400 leading-relaxed z-50">
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

        <details className="group w-full border-t border-bermuda-800/50 py-3 md:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium text-white select-none touch-manipulation">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-bermuda-300 transition-transform group-open:rotate-180" />
            <span className="leading-snug">How this demo works</span>
          </summary>
          <div className="mt-3 border-l border-bermuda-700/50 pl-3 text-[11px] leading-relaxed text-bermuda-400">
            <HowItWorksBody />
          </div>
        </details>
      </div>
    </header>
  )
}
