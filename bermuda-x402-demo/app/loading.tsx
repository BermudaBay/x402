import React from 'react'

/** Visible shell while the route segment loads — avoids a bare white screen during slow networks / dev compile. */
export default function Loading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6"
      style={{ backgroundColor: '#042f2e', color: '#f5f5f4' }}
    >
      <div
        className="h-10 w-10 animate-pulse rounded-full border-2 border-bermuda-600/50 border-t-bermuda-300"
        aria-hidden
      />
      <p className="text-sm font-medium text-bermuda-300">Loading Pop the cork…</p>
    </div>
  )
}
