import React from 'react'
import { Header } from '@/components/Header'
import { HeroBanner } from '@/components/HeroBanner'
import { ProductGrid } from '@/components/ProductGrid'
import { CartDrawer } from '@/components/CartDrawer'
import { X402Inspector } from '@/components/X402Inspector'
import { AgentVoiceBar } from '@/components/AgentVoiceBar'

export default function Home() {
  return (
    <div className="min-h-screen pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-10">
      <Header />
      <HeroBanner />
      <ProductGrid />
      <CartDrawer />
      <AgentVoiceBar />
      <X402Inspector />
    </div>
  )
}
