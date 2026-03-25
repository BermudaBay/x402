'use client'

/**
 * AgentContext — voice-controlled puppet that drives the store UI autonomously.
 *
 * State machine:
 *
 *   idle ──▶ listening ──▶ parsing ──▶ highlighting ──▶ carting ──▶ paying ──▶ confirmed
 *     ▲                        │                                         │         │
 *     │                        ▼                                         ▼         │
 *     └──────────────── no_match (auto-resets)                         error ──────┘
 *
 * All async side effects (bermudaCheckout, balance fetch) are triggered by
 * useEffect hooks watching state transitions — the reducer stays pure.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import { parseIntent } from '@/lib/intentParser'
import type { ParsedItem } from '@/lib/intentParser'
import { getAgentWallet } from '@/lib/agentWallet'
import { bermudaCheckout } from '@/lib/bermuda-client'
import type { InspectorStep, CheckoutResult } from '@/lib/bermuda-client'
import { useCart } from '@/context/CartContext'
import { useX402Inspector } from '@/components/X402Inspector'

// ── State machine types ────────────────────────────────────────────────────

export type AgentPhase =
  | 'idle'
  | 'listening'
  | 'parsing'
  | 'highlighting'
  | 'carting'
  | 'paying'
  | 'confirmed'
  | 'no_match'
  | 'error'

interface AgentState {
  phase: AgentPhase
  transcript: string
  highlightedProductIds: string[]
  pendingItems: ParsedItem[]
  statusMessage: string
  errorMessage: string | null
  orderId: string | null
  confirmedOrder: CheckoutResult | null
  balance: string | null
  configured: boolean  // NEXT_PUBLIC_AGENT_PK is set and valid
}

type AgentAction =
  | { type: 'START_LISTENING' }
  | { type: 'TRANSCRIPT'; text: string }
  | { type: 'PARSE_OK'; items: ParsedItem[] }
  | { type: 'PARSE_FAIL'; message: string }
  | { type: 'START_CARTING' }
  | { type: 'START_PAYING' }
  | { type: 'PAY_STATUS'; message: string }
  | { type: 'CONFIRMED'; order: CheckoutResult }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' }
  | { type: 'BALANCE'; balance: string }

const INITIAL_STATE: AgentState = {
  phase: 'idle',
  transcript: '',
  highlightedProductIds: [],
  pendingItems: [],
  statusMessage: '',
  errorMessage: null,
  orderId: null,
  confirmedOrder: null,
  balance: null,
  configured: false,
}

function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case 'START_LISTENING':
      return { ...state, phase: 'listening', transcript: '', statusMessage: 'Listening…', errorMessage: null }

    case 'TRANSCRIPT':
      return { ...state, phase: 'parsing', transcript: action.text, statusMessage: 'Parsing command…' }

    case 'PARSE_OK':
      return {
        ...state,
        phase: 'highlighting',
        pendingItems: action.items,
        highlightedProductIds: action.items.map(i => i.product.id),
        statusMessage: action.items.length === 1
          ? `Found: ${action.items[0]!.product.name} ×${action.items[0]!.qty}`
          : `Found ${action.items.length} items`,
      }

    case 'PARSE_FAIL':
      return { ...state, phase: 'no_match', statusMessage: action.message, errorMessage: action.message }

    case 'START_CARTING':
      return { ...state, phase: 'carting', statusMessage: 'Adding to cart…' }

    case 'START_PAYING':
      return { ...state, phase: 'paying', highlightedProductIds: [], statusMessage: 'Initiating checkout…' }

    case 'PAY_STATUS':
      return { ...state, statusMessage: action.message }

    case 'CONFIRMED':
      return {
        ...state,
        phase: 'confirmed',
        orderId: action.order.orderId,
        confirmedOrder: action.order,
        statusMessage: 'Payment confirmed ✓',
        pendingItems: [],
      }

    case 'ERROR':
      return {
        ...state,
        phase: 'error',
        errorMessage: action.message,
        statusMessage: action.message,
        highlightedProductIds: [],
        pendingItems: [],
      }

    case 'RESET':
      return {
        ...INITIAL_STATE,
        balance: state.balance,
        configured: state.configured,
        confirmedOrder: null,
      }

    case 'BALANCE':
      return { ...state, balance: action.balance, configured: true }

    default:
      return state
  }
}

// ── Context ────────────────────────────────────────────────────────────────

interface AgentContextValue {
  agentPhase: AgentPhase
  transcript: string
  highlightedProductIds: string[]
  statusMessage: string
  errorMessage: string | null
  orderId: string | null
  confirmedOrder: CheckoutResult | null
  balance: string | null
  configured: boolean
  startVoice: () => void
  runCommand: (text: string) => void
  reset: () => void
  refreshBalance: () => void
}

const AgentContext = createContext<AgentContextValue | null>(null)

export function useAgent() {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgent must be used inside <AgentProvider>')
  return ctx
}

// ── Provider ───────────────────────────────────────────────────────────────

// Delay (ms) between puppet steps — long enough for audience to follow
const HIGHLIGHT_MS = 900
const CART_MS      = 700

// Cooldown between purchases
const COOLDOWN_MS  = 15_000
const lastRunRef   = { current: 0 }

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(agentReducer, INITIAL_STATE)
  const { addItem, clearCart, closeCart, openCart } = useCart()
  const { addStep, clearSteps } = useX402Inspector()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // ── Initialise: check wallet config + fetch balance ──────────────────────
  useEffect(() => {
    const wallet = getAgentWallet()
    if (!wallet) return
    dispatch({ type: 'BALANCE', balance: '…' })
    wallet.getUsdcBalance().then(b => dispatch({ type: 'BALANCE', balance: b }))
  }, [])

  // ── Web Speech API setup ─────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const startVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SpeechRecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      dispatch({ type: 'ERROR', message: 'Browser does not support voice input — use preset commands' })
      return
    }

    if (state.phase !== 'idle') return

    stopListening()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SpeechRecognitionCtor()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 3  // request multiple alternatives for better matching

    // Provide grammar hints so the recognizer biases toward champagne names
    // (SpeechGrammarList is supported in Chrome; gracefully ignored elsewhere)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GrammarList = (window as any).SpeechGrammarList ?? (window as any).webkitSpeechGrammarList
      if (GrammarList) {
        const grammar = '#JSGF V1.0; grammar champagne; public <champagne> = ' +
          'moet chandon | moët chandon | veuve clicquot | yellow label | ' +
          'nicolas feuillatte | mumm | cordon rouge | g.h. mumm | ' +
          'one | two | three | buy | order | get | bottle | bottles ;'
        const list = new GrammarList()
        list.addFromString(grammar, 1)
        rec.grammars = list
      }
    } catch { /* ignore */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // Try all alternatives in order — take the first one that parses successfully,
      // fall back to the top result if none match
      const result = e.results[0]
      let best: string = result?.[0]?.transcript ?? ''
      for (let i = 0; i < (result?.length ?? 0); i++) {
        const alt: string = result[i]?.transcript ?? ''
        const parsed = parseIntent(alt)
        if (parsed.ok) { best = alt; break }
      }
      dispatch({ type: 'TRANSCRIPT', text: best })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') {
        dispatch({ type: 'RESET' })
      } else if (e.error === 'not-allowed') {
        dispatch({ type: 'ERROR', message: 'Mic blocked — use preset commands below' })
      } else {
        dispatch({ type: 'ERROR', message: `Voice error: ${e.error}` })
      }
    }

    rec.onend = () => { recognitionRef.current = null }

    recognitionRef.current = rec
    rec.start()
    dispatch({ type: 'START_LISTENING' })
  }, [state.phase, stopListening])

  const runCommand = useCallback((text: string) => {
    if (state.phase !== 'idle') return
    dispatch({ type: 'TRANSCRIPT', text })
  }, [state.phase])

  // ── State machine side effects ───────────────────────────────────────────

  // parsing → highlight or no_match
  useEffect(() => {
    if (state.phase !== 'parsing') return
    const result = parseIntent(state.transcript)
    if (result.ok) {
      dispatch({ type: 'PARSE_OK', items: result.items })
    } else {
      dispatch({ type: 'PARSE_FAIL', message: result.error })
    }
  }, [state.phase, state.transcript])

  // highlighting → carting (after delay)
  useEffect(() => {
    if (state.phase !== 'highlighting') return
    const t = setTimeout(() => dispatch({ type: 'START_CARTING' }), HIGHLIGHT_MS)
    return () => clearTimeout(t)
  }, [state.phase])

  // carting → populate cart → paying (after delay)
  useEffect(() => {
    if (state.phase !== 'carting' || !state.pendingItems.length) return
    clearCart()
    for (const { product, qty } of state.pendingItems) {
      for (let i = 0; i < qty; i++) addItem(product)
    }
    openCart()
    const t = setTimeout(() => dispatch({ type: 'START_PAYING' }), CART_MS)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  // paying → run x402 checkout with agent wallet
  useEffect(() => {
    if (state.phase !== 'paying') return

    // Cooldown guard
    const now = Date.now()
    if (now - lastRunRef.current < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastRunRef.current)) / 1000)
      dispatch({ type: 'ERROR', message: `Demo cooldown — wait ${remaining}s` })
      return
    }

    const wallet = getAgentWallet()
    if (!wallet) {
      dispatch({ type: 'ERROR', message: 'Agent wallet not configured — add NEXT_PUBLIC_AGENT_PK' })
      return
    }

    const checkoutParam = state.pendingItems
      .map(({ product, qty }) => `${product.id}:${qty}`)
      .join(',')
    if (!checkoutParam) {
      dispatch({ type: 'ERROR', message: 'Cart is empty — try a preset or voice again' })
      return
    }
    const itemsForSpeech = [...state.pendingItems]

    lastRunRef.current = now
    clearSteps()
    stopListening()

    const onStep = (step: InspectorStep) => {
      addStep(step)
      // Keep button label in sync with payment progress
      const labels: Partial<Record<InspectorStep['type'], string>> = {
        request_sent:    'Initiating checkout…',
        '402_received':  'Payment required — signing…',
        account_derived: 'Deriving identity…',
        proof_generating:'Generating ZK proof…',
        payload_created: 'Proof ready ✓',
        payment_sent:    'Submitting payment…',
        success:         'Confirmed ✓',
      }
      const label = labels[step.type as keyof typeof labels]
      if (label) dispatch({ type: 'PAY_STATUS', message: label })
    }

    bermudaCheckout(wallet.walletClient, checkoutParam, onStep, wallet.publicClient)
      .then(result => {
        clearCart()
        closeCart()
        dispatch({ type: 'CONFIRMED', order: result })
        wallet.getUsdcBalance().then(b => dispatch({ type: 'BALANCE', balance: b }))
        speakConfirmation(itemsForSpeech)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Payment failed'
        dispatch({ type: 'ERROR', message: msg })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  // no_match → auto-reset after 4s
  useEffect(() => {
    if (state.phase !== 'no_match') return
    const t = setTimeout(() => dispatch({ type: 'RESET' }), 4000)
    return () => clearTimeout(t)
  }, [state.phase])

  // confirmed → auto-reset after 6s
  useEffect(() => {
    if (state.phase !== 'confirmed') return
    const t = setTimeout(() => dispatch({ type: 'RESET' }), 6000)
    return () => clearTimeout(t)
  }, [state.phase])

  const reset = useCallback(() => {
    stopListening()
    clearCart()
    clearSteps()
    dispatch({ type: 'RESET' })
  }, [stopListening, clearCart, clearSteps])

  const refreshBalance = useCallback(() => {
    const wallet = getAgentWallet()
    if (!wallet) return
    wallet.getUsdcBalance().then(b => dispatch({ type: 'BALANCE', balance: b }))
  }, [])

  return (
    <AgentContext.Provider value={{
      agentPhase: state.phase,
      transcript: state.transcript,
      highlightedProductIds: state.highlightedProductIds,
      statusMessage: state.statusMessage,
      errorMessage: state.errorMessage,
      orderId: state.orderId,
      confirmedOrder: state.confirmedOrder,
      balance: state.balance,
      configured: state.configured,
      startVoice,
      runCommand,
      reset,
      refreshBalance,
    }}>
      {children}
    </AgentContext.Provider>
  )
}

// ── TTS helper ─────────────────────────────────────────────────────────────

// Phonetic English fallback for when no French voice is available
const FRENCH_PHONETIC: Record<string, string> = {
  'Moët & Chandon Impérial':     'mo ay ay and shan don im pay ree ahl',
  'Veuve Clicquot Yellow Label': 'vuv klee koh yellow label',
  'Nicolas Feuillatte Réserve':  'nee koh lah foy yat ray zairv',
  'G.H. Mumm Cordon Rouge':      'gay ahsh moom kor don roozh',
}

function speakConfirmation(items: ParsedItem[]) {
  if (!window.speechSynthesis) return
  const synth = window.speechSynthesis
  synth.cancel()

  const doSpeak = (voices: SpeechSynthesisVoice[]) => {
    const frVoice = voices.find(v => v.lang.startsWith('fr')) ?? null
    const enVoice = voices.find(v => v.lang.startsWith('en-')) ?? null

    const single = items.length === 1 ? items[0]! : null
    const qty    = single?.qty ?? 0
    const name   = single?.product.name ?? null

    if (frVoice && name) {
      // Three-part utterance: English intro → French name → English outro
      const say = (text: string, voice: SpeechSynthesisVoice | null, lang?: string) => {
        const u = new SpeechSynthesisUtterance(text)
        if (voice) u.voice = voice
        if (lang)  u.lang  = lang
        u.rate  = 0.9
        u.pitch = 1.0
        synth.speak(u)
      }
      say(`Order confirmed. ${qty} ${qty === 1 ? 'bottle' : 'bottles'} of`, enVoice)
      say(name, frVoice, frVoice.lang)
      say('Paid privately via Bermuda x402.', enVoice)
    } else {
      // Phonetic fallback — substitutes tricky French words for the English synth
      const spokenName = name
        ? (FRENCH_PHONETIC[name] ?? name)
        : `${items.length} items`
      const summary = name
        ? `${qty} ${qty === 1 ? 'bottle' : 'bottles'} of ${spokenName}`
        : spokenName
      const u = new SpeechSynthesisUtterance(`Order confirmed. ${summary}. Paid privately via Bermuda x402.`)
      u.rate  = 0.95
      u.pitch = 1.05
      synth.speak(u)
    }
  }

  // getVoices() may be empty on first call in Chrome — wait for voiceschanged if needed
  const voices = synth.getVoices()
  if (voices.length > 0) {
    doSpeak(voices)
  } else {
    synth.addEventListener('voiceschanged', () => doSpeak(synth.getVoices()), { once: true })
  }
}
