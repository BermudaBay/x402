'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(typeof error === 'string' ? error : 'Unknown error')
}

/** Catches render errors in the client tree so a hydration/runtime crash does not leave a blank page. */
export class ClientRootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: normalizeError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ClientRootErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const message = this.state.error.message
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: '1.5rem',
            backgroundColor: '#042f2e',
            color: '#f5f5f4',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Something went wrong</h1>
          <p style={{ opacity: 0.9, marginBottom: '1rem', maxWidth: '40rem' }}>
            The UI hit a client error. Check the browser console for the full stack. After fixing code, hard-refresh
            or restart <code style={{ opacity: 0.85 }}>npm run dev</code>. If this appeared after a bad cart state,
            try clearing site data for localhost or click Try again after clearing{' '}
            <code style={{ opacity: 0.85 }}>localStorage</code> key{' '}
            <code style={{ opacity: 0.85 }}>bermuda-x402-cart</code>.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              marginBottom: '1rem',
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
          <pre
            style={{
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'rgba(0,0,0,0.25)',
              padding: '1rem',
              borderRadius: 8,
              maxWidth: '56rem',
            }}
          >
            {message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
