import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Feather, Shield, Wine, Zap } from 'lucide-react'

/** Inline layout so the hero never covers the whole viewport if Tailwind/CSS fails to load.
 *  (next/image `fill` is position:absolute; without a positioned ancestor it anchors to the viewport.)
 */
const heroMinHeight = 'min(72vh, 36rem)'

const shellStyle: React.CSSProperties = {
  position: 'relative',
  minHeight: heroMinHeight,
  overflow: 'hidden',
}

const bgSlotStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
}

const contentStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 10,
  minHeight: heroMinHeight,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
}

export function HeroBanner() {
  return (
    <div
      style={shellStyle}
      className="border-b border-bermuda-800/30 bg-bermuda-950"
    >
      <div style={bgSlotStyle} className="pointer-events-none" aria-hidden>
        <Image
          src="/hero-champagne.png"
          alt=""
          fill
          className="origin-center scale-[0.85] object-cover object-center sm:object-[center_42%]"
          priority
          sizes="100vw"
        />
        {/* Readability: even vignette + darker center so type stays legible over foil + bubbles */}
        <div
          style={bgSlotStyle}
          className="bg-gradient-to-r from-bermuda-950/75 via-transparent to-bermuda-950/75"
        />
        <div
          style={bgSlotStyle}
          className="bg-gradient-to-b from-bermuda-950/50 via-transparent to-bermuda-950/70"
        />
        <div
          style={bgSlotStyle}
          className="bg-[radial-gradient(ellipse_85%_70%_at_50%_48%,rgba(4,47,46,0.2)_0%,rgba(4,47,46,0.55)_45%,rgba(4,47,46,0.82)_100%)]"
        />
      </div>

      <div
        style={contentStyle}
        className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-10"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-bermuda-500/30 bg-bermuda-950/70 px-3 py-1.5 text-xs font-medium text-bermuda-200 shadow-lg shadow-black/30 backdrop-blur-sm sm:mb-5">
          <Zap className="h-3.5 w-3.5 text-bermuda-400" />
          Powered by Bermuda Protocol × x402
        </div>

        <h1 className="mb-6 w-full max-w-2xl px-1 text-3xl font-bold tracking-tight [text-shadow:0_2px_28px_rgba(0,0,0,0.75)] sm:mb-8 sm:text-5xl md:text-6xl">
          <span className="block text-white">Pop the cork.</span>
          <span className="mt-1 block text-bermuda-300 [text-shadow:0_2px_24px_rgba(0,0,0,0.8)] sm:mt-1.5 md:mt-2">
            Not your privacy
          </span>
        </h1>

        <div className="flex flex-col items-center gap-5">
          <Link
            href="#bermuda-collection"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#F0CA4A] via-[#E8B422] to-[#D4920E] px-10 py-3.5 text-base font-semibold text-bermuda-950 shadow-md shadow-black/25 transition hover:from-[#F5D65C] hover:via-[#EDBF2E] hover:to-[#E0A010] hover:shadow-lg hover:shadow-black/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
          >
            Shop the Collection
          </Link>

          <div
            className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-x-10 md:gap-x-14 sm:gap-y-2"
            aria-label="Key features"
          >
            <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
              <Shield className="h-4 w-4 shrink-0 text-bermuda-300" strokeWidth={1.25} aria-hidden />
              <span className="text-white/80 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
                Shielded transactions
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
              <Feather className="h-4 w-4 shrink-0 text-bermuda-300" strokeWidth={1.25} aria-hidden />
              <span className="text-white/80 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">Complete discretion</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
              <Wine className="h-4 w-4 shrink-0 text-bermuda-300" strokeWidth={1.25} aria-hidden />
              <span className="text-white/80 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">Effortless checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
