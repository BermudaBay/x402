import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'
import { InspectorProvider } from '@/components/X402Inspector'
import { AgentProvider } from '@/context/AgentContext'

// Never prerender — Privy and wallet providers require client-side hydration
export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  themeColor: '#0c0a09',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Bermuda Cellars — Private Champagne',
  description: 'Demo store showing x402 private payments powered by Bermuda Protocol',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ backgroundColor: '#042f2e' }} suppressHydrationWarning>
      <body
        className="min-h-screen bg-bermuda-950 antialiased"
        style={{ margin: 0, minHeight: '100vh', backgroundColor: '#042f2e', color: '#f5f5f4' }}
        suppressHydrationWarning
      >
        <Providers>
          <InspectorProvider>
            <AgentProvider>
              {children}
            </AgentProvider>
          </InspectorProvider>
        </Providers>
      </body>
    </html>
  )
}
