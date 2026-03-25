'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Lock, Loader2, ShieldCheck, WalletMinimal } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { bermudaCheckout, type InspectorStep } from '@/lib/bermuda-client'
import { getAgentWallet } from '@/lib/agentWallet'
import { useX402Inspector } from './X402Inspector'
import { useAgent } from '@/context/AgentContext'

type CheckoutState = 'idle' | 'paying' | 'error'

export function CheckoutButton() {
  const { itemsParam, clearCart, showReceipt } = useCart()
  const { addStep, clearSteps } = useX402Inspector()
  const { agentPhase, statusMessage: agentStatus } = useAgent()

  const [state, setState] = useState<CheckoutState>('idle')
  const [statusLabel, setStatusLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Mirror agent phase into button visual state while the agent runs checkout without clicking.
  useEffect(() => {
    if (agentPhase === 'paying') {
      setState('paying')
      setStatusLabel(agentStatus || 'Paying with x402…')
    } else if (agentPhase === 'confirmed') {
      setState('idle')
      setError(null)
    } else if (agentPhase === 'error') {
      setState('error')
      setError(agentStatus)
    } else if (agentPhase === 'idle') {
      setState('idle')
      setError(null)
    }
  }, [agentPhase, agentStatus])

  useEffect(() => {
    if (state === 'paying' && agentPhase === 'paying' && agentStatus) {
      setStatusLabel(agentStatus)
    }
  }, [agentStatus, agentPhase, state])

  const handleStep = useCallback(
    (step: InspectorStep) => {
      addStep(step)
      switch (step.type) {
        case 'request_sent':
          setStatusLabel('Initiating checkout…')
          break
        case '402_received':
          setStatusLabel('Payment required — signing…')
          break
        case 'account_derived':
          setStatusLabel('Identity derived ✓')
          break
        case 'payload_created':
          setStatusLabel('Proof created ✓')
          break
        case 'payment_sent':
          setStatusLabel('Submitting payment…')
          break
        case 'success':
          setStatusLabel('Confirmed ✓')
          break
        case 'error':
          setStatusLabel(step.message)
          break
      }
    },
    [addStep],
  )

  const handleCheckout = useCallback(async () => {
    const agentWallet = getAgentWallet()
    if (!agentWallet || !itemsParam) return

    clearSteps()
    setState('paying')
    setError(null)
    setStatusLabel('')

    try {
      const result = await bermudaCheckout(
        agentWallet.walletClient,
        itemsParam,
        handleStep,
        agentWallet.publicClient,
      )
      showReceipt(result)
      clearCart()
      setState('idle')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed'
      setError(msg)
      setState('error')
    }
  }, [itemsParam, clearSteps, handleStep, clearCart, showReceipt])

  const agentWallet = getAgentWallet()

  if (!agentWallet) {
    return (
      <div className="w-full py-3.5 rounded-xl bg-bermuda-900/40 border border-bermuda-800/30 text-center px-4">
        <div className="flex items-center justify-center gap-2 text-bermuda-500 text-sm">
          <WalletMinimal className="w-4 h-4" />
          <span>
            Add <code className="text-xs bg-bermuda-900 px-1 rounded">NEXT_PUBLIC_AGENT_PK</code> to enable
            payments
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={state === 'paying'}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-70
            bg-bermuda-600 hover:bg-bermuda-500 disabled:cursor-not-allowed
            shadow-lg shadow-bermuda-900/50
            animate-pulse-glow disabled:[animation:none]"
      >
        {state === 'paying' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{statusLabel || 'Processing…'}</span>
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            <ShieldCheck className="w-4 h-4 -ml-2" />
            <span>Pay Privately with Bermuda</span>
          </>
        )}
      </button>

      {state === 'paying' && statusLabel && (
        <p className="text-center text-bermuda-400 text-xs animate-pulse">{statusLabel}</p>
      )}

      {state === 'error' && error && (
        <p className="text-center text-red-400 text-xs bg-red-900/20 border border-red-800/30 rounded-lg p-2">
          {error}
        </p>
      )}
    </div>
  )
}
