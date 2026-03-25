'use client'

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react'
import { Terminal, ChevronDown, ChevronUp, X, Circle, ExternalLink, Zap } from 'lucide-react'
import type { InspectorStep } from '@/lib/bermuda-client'
import { txExplorerUrl } from '@/lib/explorer'

// ──────────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────────

interface InspectorContextValue {
  steps: InspectorStep[]
  addStep: (step: InspectorStep) => void
  clearSteps: () => void
}

const InspectorContext = createContext<InspectorContextValue | null>(null)

export function InspectorProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps] = useState<InspectorStep[]>([])

  const addStep = useCallback((step: InspectorStep) => {
    setSteps(prev => [...prev, step])
  }, [])

  const clearSteps = useCallback(() => setSteps([]), [])

  return (
    <InspectorContext.Provider value={{ steps, addStep, clearSteps }}>
      {children}
    </InspectorContext.Provider>
  )
}

export function useX402Inspector() {
  const ctx = useContext(InspectorContext)
  if (!ctx) throw new Error('useX402Inspector must be used inside <InspectorProvider>')
  return ctx
}

// ──────────────────────────────────────────────────
// Step rendering helpers
// ──────────────────────────────────────────────────

const STEP_META: Record<
  InspectorStep['type'],
  { label: string; color: string; tag: string; narrative: string }
> = {
  request_sent:    {
    label: 'GET  →',
    color: 'text-blue-400',
    tag: 'HTTP REQUEST',
    narrative: 'Store sent a normal HTTP request',
  },
  '402_received':  {
    label: '402  ←',
    color: 'text-amber-400',
    tag: 'PAYMENT REQUIRED',
    narrative: 'Server: "Payment required — no processor, just HTTP"',
  },
  account_derived: {
    label: 'ID   ⚙',
    color: 'text-violet-400',
    tag: 'IDENTITY',
    narrative: 'Bermuda identity derived from your account',
  },
  payload_created: {
    label: 'SIGN ✓',
    color: 'text-emerald-400',
    tag: 'PROOF CREATED',
    narrative: 'Payment proof signed — no bank, no processor',
  },
  payment_sent:    {
    label: 'PAY  →',
    color: 'text-cyan-400',
    tag: 'PAYMENT SENT',
    narrative: 'HTTP request re-sent with payment header',
  },
  success:         {
    label: '200  ←',
    color: 'text-green-400',
    tag: 'CONFIRMED',
    narrative: 'Server settled payment and returned the order',
  },
  proof_generating: {
    label: 'ZK   ⏳',
    color: 'text-violet-400',
    tag: 'PROVING',
    narrative: 'Generating ZK proof — this takes 10-30s',
  },
  error:           {
    label: 'ERR  ✗',
    color: 'text-red-400',
    tag: 'ERROR',
    narrative: 'Payment failed',
  },
}

function StepRow({ step, index }: { step: InspectorStep; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const meta = STEP_META[step.type] ?? {
    label: 'INFO ',
    color: 'text-bermuda-400',
    tag: step.type.toUpperCase(),
    narrative: '',
  }
  const ts = new Date(step.ts).toISOString().split('T')[1]?.replace('Z', '') ?? ''

  const detail: Record<string, unknown> = (() => {
    switch (step.type) {
      case 'request_sent':    return { url: step.url }
      case '402_received':    return { paymentRequired: step.paymentRequired }
      case 'account_derived': return { shieldedAddress: step.shieldedAddress }
      case 'payload_created': return { scheme: step.scheme }
      case 'success':         return { orderId: step.orderId, txHash: step.txHash }
      case 'error':           return { message: step.message }
      default:                return {}
    }
  })()

  const hasDetail = Object.keys(detail).length > 0

  return (
    <div className="border-b border-bermuda-800/30 last:border-0">
      <button
        onClick={() => hasDetail && setExpanded(e => !e)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bermuda-900/30 transition-colors ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="text-bermuda-600 font-mono text-[10px] w-4 shrink-0">{index + 1}</span>
        <span className={`font-mono text-xs font-bold w-14 shrink-0 ${meta.color}`}>{meta.label}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-semibold ${meta.color}`}
              style={{ background: 'rgba(currentColor, 0.08)', border: '1px solid currentColor', borderColor: 'rgba(currentColor, 0.2)' }}>
              {meta.tag}
            </span>
          </div>
          <p className="text-bermuda-400 text-[10px] mt-0.5 truncate">{meta.narrative}</p>
        </div>
        <span className="text-bermuda-600 font-mono text-[10px] shrink-0 ml-2">{ts}</span>
        {hasDetail && (
          expanded
            ? <ChevronUp className="w-3 h-3 text-bermuda-600 shrink-0" />
            : <ChevronDown className="w-3 h-3 text-bermuda-600 shrink-0" />
        )}
      </button>

      {step.type === 'success' && step.txHash && (
        <div className="px-3 pb-1.5 -mt-0.5">
          <a
            href={txExplorerUrl(step.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400/90 hover:text-cyan-300"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            Settlement tx (explorer)
          </a>
        </div>
      )}

      {expanded && hasDetail && (
        <div className="px-3 pb-3 space-y-2">
          {step.type === 'success' && step.txHash && (
            <a
              href={txExplorerUrl(step.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300"
            >
              <ExternalLink className="w-3 h-3" />
              Open tx in explorer
            </a>
          )}
          <pre className="text-[10px] font-mono text-bermuda-300 bg-bermuda-900/50 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────
// Inspector panel
// ──────────────────────────────────────────────────

export function X402Inspector() {
  const { steps, clearSteps } = useX402Inspector()
  /** Whole panel hidden behind a corner tab until the visitor opens it (luxury default). */
  const [drawerOpen, setDrawerOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest step while the drawer is open
  useEffect(() => {
    if (drawerOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [steps, drawerOpen])

  const isActive  = steps.length > 0
  const lastStep  = steps.at(-1)
  const isSuccess = lastStep?.type === 'success'
  const isError   = lastStep?.type === 'error'
  const isPending = isActive && !isSuccess && !isError

  const borderColor = isSuccess ? 'border-emerald-700/50'
    : isError   ? 'border-red-700/50'
    : isPending ? 'border-bermuda-600/50'
    :             'border-bermuda-800/40'

  const tabId = 'x402-inspector-tab'
  const panelId = 'x402-inspector-panel'

  return (
    <div
      className="fixed bottom-5 left-3 z-[60] flex flex-col items-start gap-0 pb-[max(0px,env(safe-area-inset-bottom))] pointer-events-none sm:bottom-6 sm:left-4"
    >
      {/* Drawer expands upward; tab docked bottom-left (keeps right side clear for cart / modals) */}
      <div
        id={panelId}
        role="region"
        aria-label="x402 protocol inspector"
        aria-hidden={!drawerOpen}
        className={`pointer-events-auto mb-2 w-[min(100vw-1.5rem,20rem)] origin-bottom transition-all duration-300 ease-out ${
          drawerOpen
            ? 'max-h-[min(70vh,26rem)] translate-y-0 opacity-100'
            : 'max-h-0 translate-y-2 opacity-0 pointer-events-none overflow-hidden mb-0'
        }`}
      >
        <div
          className={`flex max-h-[min(70vh,26rem)] flex-col overflow-hidden rounded-xl border bg-bermuda-950/97 shadow-2xl backdrop-blur-md transition-shadow duration-200 ${borderColor} ${isPending ? 'animate-pulse-glow' : ''}`}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-bermuda-800/40 px-3 py-2">
            <Terminal className="h-3.5 w-3.5 shrink-0 text-bermuda-400" />
            <span className="font-mono text-[11px] font-semibold tracking-wide text-bermuda-300">x402 Inspector</span>

            {isActive && (
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Circle
                  className={`h-2 w-2 fill-current ${isSuccess ? 'text-emerald-400' : isError ? 'text-red-400' : 'animate-pulse text-amber-400'}`}
                />
                <span className={isSuccess ? 'text-emerald-400' : isError ? 'text-red-400' : 'text-amber-400'}>
                  {isSuccess ? 'DONE' : isError ? 'ERR' : 'LIVE'}
                </span>
              </span>
            )}

            <span className="ml-auto font-mono text-[10px] text-bermuda-700">
              {steps.length > 0 ? `${steps.length} step${steps.length !== 1 ? 's' : ''}` : 'waiting'}
            </span>

            {steps.length > 0 && (
              <button
                type="button"
                onClick={clearSteps}
                title="Clear log"
                className="ml-1 text-bermuda-700 transition-colors hover:text-bermuda-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              title="Close inspector"
              className="ml-1 text-bermuda-500 transition-colors hover:text-bermuda-200"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Close inspector</span>
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 max-h-56 flex-1 overflow-y-auto overscroll-contain">
            {steps.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="mb-1 text-[11px] font-medium text-bermuda-600">No payment yet</p>
                <p className="text-[10px] leading-relaxed text-bermuda-700">
                  Run a checkout to watch each x402 HTTP step appear here live.
                </p>
              </div>
            ) : (
              <>
                {steps.map((step, i) => (
                  <StepRow key={i} step={step} index={i} />
                ))}
                {isSuccess && (
                  <p className="border-t border-bermuda-800/30 px-3 py-2 text-center text-[10px] text-bermuda-600">
                    No processor. No webhooks. The HTTP request paid for itself.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        id={tabId}
        aria-expanded={drawerOpen}
        aria-controls={panelId}
        onClick={() => setDrawerOpen(o => !o)}
        className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-left text-xs font-medium shadow-lg backdrop-blur-md transition-colors sm:text-[13px] ${
          drawerOpen
            ? 'border-bermuda-600/50 bg-bermuda-900/95 text-bermuda-200 hover:bg-bermuda-800/95'
            : 'border-bermuda-700/45 bg-bermuda-950/90 text-bermuda-200/95 hover:border-bermuda-600/55 hover:bg-bermuda-900/90'
        }`}
      >
        <Zap className="h-3.5 w-3.5 shrink-0 text-bermuda-400" strokeWidth={1.75} aria-hidden />
        {drawerOpen ? (
          <>
            <span className="whitespace-nowrap">Hide inspector</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          </>
        ) : (
          <span className="whitespace-nowrap">Watch x402 live</span>
        )}
      </button>
    </div>
  )
}
