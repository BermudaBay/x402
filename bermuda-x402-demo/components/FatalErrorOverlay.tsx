'use client'

import React, { useEffect, useRef, useState } from 'react'

const CART_KEY = 'bermuda-x402-cart'

function isBenignWindowError(event: ErrorEvent): boolean {
  const f = event.filename ?? ''
  if (
    f.includes('chrome-extension://') ||
    f.includes('moz-extension://') ||
    f.includes('safari-web-extension://')
  ) {
    return true
  }
  const msg = (event.message || '').toLowerCase()
  if (msg.includes('resizeobserver')) return true
  return false
}

function formatReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message || reason.name
  if (typeof reason === 'string') return reason
  try {
    return JSON.stringify(reason)
  } catch {
    return String(reason)
  }
}

/**
 * Sits outside the main error boundary so it still mounts if a child boundary
 * catches a render error. Listens for uncaught JS and unhandled promise
 * rejections (common causes of a “white screen” with no React UI).
 */
export function FatalErrorOverlay() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const show = (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setMessage(text)
        setOpen(true)
      }, 0)
    }

    const onError = (event: ErrorEvent) => {
      if (isBenignWindowError(event)) return
      // Avoid overlay for generic resource / script load noise — require a real Error instance
      const err = event.error
      if (err instanceof Error) show(err.message || 'Uncaught error')
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      show(formatReason(event.reason))
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!open) return null

  const clearCartAndReload = () => {
    try {
      localStorage.removeItem(CART_KEY)
    } catch {
      /* ignore */
    }
    window.location.reload()
  }

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-4 overflow-auto px-6 py-10 text-center"
      style={{ backgroundColor: '#042f2e', color: '#f5f5f4', fontFamily: 'system-ui, sans-serif' }}
    >
      <h1 className="text-lg font-semibold">This tab hit an uncaught error</h1>
      <p className="max-w-md text-sm opacity-90">
        The app stopped before React could show its normal error screen. Use the buttons below or check the browser
        console (⌥⌘J / F12).
      </p>
      <pre
        className="max-w-2xl overflow-x-auto rounded-lg p-4 text-left text-xs"
        style={{ background: 'rgba(0,0,0,0.35)', color: '#99f6eb' }}
      >
        {message}
      </pre>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
          style={{
            borderColor: 'rgba(45, 212, 191, 0.45)',
            background: 'rgba(13, 148, 136, 0.35)',
            color: '#f5f5f4',
          }}
        >
          Reload page
        </button>
        <button
          type="button"
          onClick={clearCartAndReload}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
          style={{
            borderColor: 'rgba(251, 191, 36, 0.35)',
            background: 'rgba(120, 53, 15, 0.25)',
            color: '#fde68a',
          }}
        >
          Clear cart & reload
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm underline decoration-white/30 underline-offset-2 opacity-80 hover:opacity-100"
        >
          Dismiss (page may still be broken)
        </button>
      </div>
    </div>
  )
}
