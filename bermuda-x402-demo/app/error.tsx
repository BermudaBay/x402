'use client'

import React, { useEffect } from 'react'

/** App Router segment error UI — avoids the default bright error shell on recoverable failures. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/error]', error)
  }, [error])

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-12 text-center"
      style={{ backgroundColor: '#042f2e', color: '#f5f5f4' }}
    >
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm opacity-90">
        Try again or hard-refresh. If the problem persists, check the browser console and restart{' '}
        <code className="rounded bg-black/25 px-1 text-xs">npm run dev</code>.
      </p>
      <pre
        className="max-w-xl overflow-x-auto rounded-lg p-4 text-left text-xs"
        style={{ background: 'rgba(0,0,0,0.25)', color: '#ccfbf5' }}
      >
        {error.message}
      </pre>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg border px-4 py-2 text-sm font-medium transition"
        style={{
          borderColor: 'rgba(45, 212, 191, 0.4)',
          background: 'rgba(13, 148, 136, 0.25)',
          color: '#f5f5f4',
        }}
      >
        Try again
      </button>
    </div>
  )
}
