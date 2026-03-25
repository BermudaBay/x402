'use client'

import React, { useState, useCallback } from 'react'
import {
  Mic,
  MicOff,
  RotateCcw,
  Bot,
  Wallet,
  Zap,
  Droplets,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAgent } from '@/context/AgentContext'
import { getAgentWallet, getAgentPkStatus } from '@/lib/agentWallet'
import { PRESET_COMMANDS } from '@/lib/intentParser'
import type { AgentPhase } from '@/context/AgentContext'

// ── Status config per phase ────────────────────────────────────────────────

const PHASE_CONFIG: Record<AgentPhase, { color: string; pulse: boolean; micActive: boolean }> = {
  idle: { color: 'text-bermuda-400', pulse: false, micActive: false },
  listening: { color: 'text-emerald-400', pulse: true, micActive: true },
  parsing: { color: 'text-yellow-400', pulse: true, micActive: false },
  highlighting: { color: 'text-bermuda-300', pulse: true, micActive: false },
  carting: { color: 'text-cyan-400', pulse: true, micActive: false },
  paying: { color: 'text-violet-400', pulse: true, micActive: false },
  confirmed: { color: 'text-emerald-400', pulse: false, micActive: false },
  no_match: { color: 'text-amber-400', pulse: false, micActive: false },
  error: { color: 'text-red-400', pulse: false, micActive: false },
}

const BUSY_PHASES: AgentPhase[] = ['listening', 'parsing', 'highlighting', 'carting', 'paying']

/** Matches drawer width and tab offset (devtools-style seam). */
const DRAWER_W = 'min(22rem,calc(100vw-0.75rem))'

type FaucetState = 'idle' | 'loading' | 'success' | 'error'

export function AgentVoiceBar() {
  const {
    agentPhase,
    transcript,
    statusMessage,
    balance,
    configured,
    refreshBalance,
    startVoice,
    runCommand,
    reset,
  } = useAgent()

  const [panelOpen, setPanelOpen] = useState(false)
  const [faucetState, setFaucetState] = useState<FaucetState>('idle')
  const [faucetMsg, setFaucetMsg] = useState('')

  const pkStatus = getAgentPkStatus()

  const cfg = PHASE_CONFIG[agentPhase]
  const isBusy = BUSY_PHASES.includes(agentPhase)
  const isIdle = agentPhase === 'idle'
  const isConfirmed = agentPhase === 'confirmed'
  const isError = agentPhase === 'error'
  const isNoMatch = agentPhase === 'no_match'

  const borderColor = isConfirmed
    ? 'border-emerald-700/60'
    : isError || isNoMatch
      ? 'border-red-800/50'
      : isBusy
        ? 'border-bermuda-600/60'
        : 'border-bermuda-800/40'

  const handleTopUp = useCallback(async () => {
    const wallet = getAgentWallet()
    if (!wallet || faucetState === 'loading') return

    setFaucetState('loading')
    setFaucetMsg('')

    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wallet.address }),
      })
      const data = (await res.json()) as {
        success?: boolean
        message?: string
        redirect?: string
        error?: string
        txHash?: string
      }

      if (res.ok && data.success) {
        if (data.redirect) {
          window.open(data.redirect, '_blank')
          setFaucetMsg('Opening faucet…')
        } else {
          setFaucetMsg(`200 USDC sent`)
          setTimeout(() => refreshBalance(), 3000)
        }
        setFaucetState('success')
      } else if (res.status === 429) {
        setFaucetMsg('Already topped up recently')
        setFaucetState('error')
      } else {
        setFaucetMsg(data.error ?? 'Faucet failed')
        setFaucetState('error')
      }
    } catch {
      setFaucetMsg('Network error')
      setFaucetState('error')
    }

    setTimeout(() => {
      setFaucetState('idle')
      setFaucetMsg('')
    }, 5000)
  }, [faucetState, refreshBalance])

  const balanceLow = balance !== null && balance !== '?' && parseFloat(balance) < 10

  const pkHelp =
    pkStatus === 'malformed' ? (
      <span className="text-amber-400/90">
        <code className="rounded bg-bermuda-900 px-1 text-[10px]">NEXT_PUBLIC_AGENT_PK</code> must be{' '}
        <code className="text-[10px]">0x</code> + 64 hex chars (no quotes). Restart{' '}
        <code className="text-[10px]">next dev</code> after editing <code className="text-[10px]">.env.local</code>.
      </span>
    ) : (
      <span className="text-amber-500/80">
        Set <code className="rounded bg-bermuda-900 px-1 text-xs">NEXT_PUBLIC_AGENT_PK</code> in{' '}
        <code className="text-[10px]">.env.local</code> (not <code className="text-[10px]">FAUCET_PK</code> — that is
        server-only). Restart the dev server after saving.
      </span>
    )

  return (
    <>
      {/* Slide-in from the left — keeps the right side clear for cart / checkout modals */}
      <aside
        id="agent-voice-panel"
        aria-hidden={!panelOpen}
        className={`fixed top-0 left-0 z-[43] h-full max-h-[100dvh] border-r border-bermuda-700/50 bg-bermuda-950/98 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out ${borderColor} border-r-2 pt-[env(safe-area-inset-top,0px)] ${panelOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}`}
        style={{ width: DRAWER_W }}
      >
        <div className="flex h-full max-h-[100dvh] flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-bermuda-800/40 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
                  isBusy ? 'border-bermuda-500/50 bg-bermuda-600/30' : 'border-bermuda-800/40 bg-bermuda-900/60'
                }`}
              >
                <Bot className={`h-4 w-4 transition-colors ${cfg.color}`} />
                {isBusy && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-bermuda-300">
                  Voice agent
                </p>
                <p className="text-[9px] text-bermuda-600">Bermuda × x402 demo</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="shrink-0 rounded-lg p-2 text-bermuda-500 transition-colors hover:bg-bermuda-800/50 hover:text-white"
              aria-label="Close agent panel"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {/* Balance */}
            {configured && balance !== null && (
              <div className="mb-4 rounded-xl border border-bermuda-800/40 bg-bermuda-900/30 px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-bermuda-600">Shielded USDC (pool)</p>
                <p
                  className={`mt-0.5 font-mono text-sm transition-all duration-500 ${
                    balanceLow ? 'text-amber-400' : balance === '?' ? 'text-bermuda-600' : 'text-emerald-400'
                  }`}
                >
                  <Wallet className="mr-1 inline h-3.5 w-3.5 shrink-0" aria-hidden />${balance} USDC
                </p>
              </div>
            )}

            {/* Status */}
            <div className="mb-4 min-h-[3rem]">
              {faucetState !== 'idle' && faucetMsg ? (
                <p
                  className={`flex items-start gap-2 text-sm font-medium ${
                    faucetState === 'success' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {faucetState === 'success' ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  {faucetMsg}
                </p>
              ) : transcript && agentPhase !== 'idle' ? (
                <div>
                  <p className="mb-1 text-[10px] text-bermuda-500">Heard</p>
                  <p className="text-sm font-medium leading-snug text-bermuda-200">&ldquo;{transcript}&rdquo;</p>
                </div>
              ) : statusMessage ? (
                <p className={`text-sm font-medium ${cfg.color} ${cfg.pulse ? 'animate-pulse' : ''}`}>{statusMessage}</p>
              ) : (
                <p className="text-sm leading-relaxed text-bermuda-600">
                  {configured ? (
                    balanceLow ? (
                      <span className="text-amber-400/80">Low balance — top up before the demo.</span>
                    ) : (
                      'Say a command or pick a preset below.'
                    )
                  ) : (
                    pkHelp
                  )}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {configured && isIdle && (
                <button
                  type="button"
                  onClick={handleTopUp}
                  disabled={faucetState === 'loading'}
                  title="Faucet: mints test USDC to the agent (keep FAUCET_PK funded with Base Sepolia ETH)"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-bermuda-800/40 px-3 py-2 text-xs text-bermuda-400 transition-colors hover:border-emerald-700/40 hover:bg-emerald-900/20 hover:text-emerald-300 disabled:opacity-50"
                >
                  <Droplets className={`h-3.5 w-3.5 ${faucetState === 'loading' ? 'animate-pulse' : ''}`} />
                  Top up
                </button>
              )}

              {!isIdle && (
                <button
                  type="button"
                  onClick={reset}
                  title="Reset demo"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-bermuda-800/40 px-3 py-2 text-xs text-bermuda-400 transition-colors hover:bg-bermuda-800/50 hover:text-bermuda-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              )}

              {configured && (
                <button
                  type="button"
                  onClick={startVoice}
                  disabled={!isIdle}
                  title={cfg.micActive ? 'Listening…' : 'Start voice command'}
                  className={`relative ml-auto flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200 ${
                    cfg.micActive
                      ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                      : isIdle
                        ? 'border-bermuda-600/40 bg-bermuda-600/20 text-bermuda-300 hover:border-bermuda-500/60 hover:bg-bermuda-600/40 hover:text-white'
                        : 'cursor-not-allowed border-bermuda-800/30 bg-bermuda-900/40 text-bermuda-600'
                  }`}
                >
                  {cfg.micActive ? (
                    <Mic className="h-5 w-5 animate-pulse" />
                  ) : isIdle ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <MicOff className="h-4 w-4" />
                  )}
                  {cfg.micActive && (
                    <span className="absolute inset-0 animate-ping rounded-xl border-2 border-emerald-400/40" />
                  )}
                </button>
              )}
            </div>

            {/* Presets */}
            {isIdle && configured && (
              <div className="border-t border-bermuda-800/30 pt-4">
                <p className="mb-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-bermuda-600">
                  <Zap className="h-3 w-3" aria-hidden />
                  Quick commands
                </p>
                <div className="flex flex-col gap-2">
                  {PRESET_COMMANDS.map(cmd => (
                    <button
                      key={cmd.text}
                      type="button"
                      onClick={() => runCommand(cmd.text)}
                      className="rounded-lg border border-bermuda-700/40 bg-bermuda-900/60 px-3 py-2 text-left text-xs font-medium text-bermuda-300 transition-all duration-150 hover:border-bermuda-500/50 hover:bg-bermuda-700/50 hover:text-bermuda-100"
                    >
                      {cmd.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Toggle tab — left edge; opens rightward like a secondary tools rail */}
      <button
        type="button"
        id="agent-voice-tab"
        aria-expanded={panelOpen}
        aria-controls="agent-voice-panel"
        onClick={() => setPanelOpen(o => !o)}
        className={`fixed top-1/2 z-[44] flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-r-xl border border-bermuda-600/50 border-l-0 bg-bermuda-950/95 py-3 pl-1.5 pr-1 shadow-lg backdrop-blur-sm transition-[left] duration-300 ease-out hover:bg-bermuda-900/95 ${
          panelOpen ? '' : 'shadow-bermuda-950/80'
        }`}
        style={{ left: panelOpen ? DRAWER_W : 0 }}
        title={panelOpen ? 'Hide agent panel' : 'Open voice agent'}
      >
        <Bot className="h-4 w-4 shrink-0 text-bermuda-400" aria-hidden />
        <span
          className="select-none font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-bermuda-500 [writing-mode:vertical-rl] [text-orientation:mixed]"
          style={{ transform: 'rotate(180deg)' }}
        >
          Agent
        </span>
        {panelOpen ? (
          <ChevronLeft className="h-3 w-3 shrink-0 text-bermuda-500" aria-hidden />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-bermuda-500" aria-hidden />
        )}
        <span className="sr-only">{panelOpen ? 'Close agent panel' : 'Open agent panel'}</span>
      </button>
    </>
  )
}
