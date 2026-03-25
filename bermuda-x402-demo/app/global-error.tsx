'use client'

import React, { useEffect } from 'react'

/**
 * Root-level failures (including layout). Must define html + body.
 * Keeps the same teal shell so a catastrophic error is not a blank white page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', backgroundColor: '#042f2e', color: '#f5f5f4' }}>
        <div style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif', maxWidth: '40rem' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Something went wrong</h1>
          <p style={{ opacity: 0.9, marginBottom: '1rem', fontSize: '0.9rem' }}>
            The app failed to load. Check the console, clear <code>bermuda-x402-cart</code> in localStorage if needed,
            then try again.
          </p>
          <pre
            style={{
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'rgba(0,0,0,0.25)',
              padding: '1rem',
              borderRadius: 8,
              marginBottom: '1rem',
            }}
          >
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: '1px solid rgba(45, 212, 191, 0.4)',
              background: 'rgba(13, 148, 136, 0.25)',
              color: '#f5f5f4',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
