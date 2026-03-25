import { PRODUCTS, type Product } from './products'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ParsedItem {
  product: Product
  qty: number
}

export type IntentResult =
  | { ok: true;  items: ParsedItem[] }
  | { ok: false; error: string }

// ── Number words ───────────────────────────────────────────────────────────

const WORD_NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

function extractQty(text: string): number {
  const lower = text.toLowerCase()
  for (const [word, num] of Object.entries(WORD_NUM)) {
    // match whole words only
    if (new RegExp(`\\b${word}\\b`).test(lower)) return num
  }
  const digits = lower.match(/\b(\d+)\b/)
  if (digits) {
    const n = parseInt(digits[1]!, 10)
    if (n > 0 && n <= 20) return n
  }
  return 1
}

// ── Product keyword index ──────────────────────────────────────────────────

// Maps lowercase keywords → product id.
// English ASR mangling of French names is extensive — we cover every realistic
// phonetic variant so voice commands work even with heavy English pronunciation.
const KEYWORD_MAP: Record<string, string> = {
  // ── Moët & Chandon Impérial ──────────────────────────────────────────────
  'moet':              'moet-chandon-imperial',
  'moët':              'moet-chandon-imperial',
  'chandon':           'moet-chandon-imperial',
  'imperial':          'moet-chandon-imperial',
  'impérial':          'moet-chandon-imperial',
  'moet chandon':      'moet-chandon-imperial',
  'moët chandon':      'moet-chandon-imperial',
  'moët & chandon':    'moet-chandon-imperial',
  'moet & chandon':    'moet-chandon-imperial',
  'moet imperial':     'moet-chandon-imperial',
  // legacy / loose matches
  'dom':               'moet-chandon-imperial',
  'perignon':          'moet-chandon-imperial',
  'pérignon':          'moet-chandon-imperial',
  'perrignon':         'moet-chandon-imperial',
  'dom perignon':      'moet-chandon-imperial',
  'dom pérignon':      'moet-chandon-imperial',

  // ── Veuve Clicquot Yellow Label ──────────────────────────────────────────
  'veuve':             'veuve-clicquot-yellow-label',
  'clicquot':          'veuve-clicquot-yellow-label',
  'clicquot yellow':   'veuve-clicquot-yellow-label',
  'veuve clicquot':    'veuve-clicquot-yellow-label',
  'yellow label':      'veuve-clicquot-yellow-label',
  'yellow':            'veuve-clicquot-yellow-label',
  // legacy
  'krug':              'veuve-clicquot-yellow-label',
  'grande':            'veuve-clicquot-yellow-label',
  'cuvée':             'veuve-clicquot-yellow-label',
  'cuvee':             'veuve-clicquot-yellow-label',
  'krug grande':       'veuve-clicquot-yellow-label',

  // ── Nicolas Feuillatte Réserve ─────────────────────────────────────────────
  'nicolas':           'nicolas-feuillatte-reserve',
  'feuillatte':        'nicolas-feuillatte-reserve',
  'feuilatte':         'nicolas-feuillatte-reserve',
  'feuillate':         'nicolas-feuillatte-reserve',
  'nicolas feuillatte':'nicolas-feuillatte-reserve',
  // legacy
  'billecart':         'nicolas-feuillatte-reserve',
  'bilecart':          'nicolas-feuillatte-reserve',
  'salmon':            'nicolas-feuillatte-reserve',
  'rosé':              'nicolas-feuillatte-reserve',
  'rose':              'nicolas-feuillatte-reserve',
  'pink':              'nicolas-feuillatte-reserve',

  // ── G.H. Mumm Cordon Rouge ─────────────────────────────────────────────────
  'mumm':              'gh-mumm-cordon-rouge',
  'gh mumm':           'gh-mumm-cordon-rouge',
  'g.h. mumm':         'gh-mumm-cordon-rouge',
  'cordon':            'gh-mumm-cordon-rouge',
  'rouge':             'gh-mumm-cordon-rouge',
  'cordon rouge':      'gh-mumm-cordon-rouge',
  'mumm cordon':       'gh-mumm-cordon-rouge',
  // legacy
  'cristal':           'gh-mumm-cordon-rouge',
  'crystal':           'gh-mumm-cordon-rouge',
  'krystal':           'gh-mumm-cordon-rouge',
  'roederer':          'gh-mumm-cordon-rouge',
  'louis':             'gh-mumm-cordon-rouge',
  'lewis':             'gh-mumm-cordon-rouge',
  'louis roederer':    'gh-mumm-cordon-rouge',
}

function matchProduct(text: string): Product | null {
  const lower = text.toLowerCase()

  // Full product name check first
  for (const product of PRODUCTS) {
    if (lower.includes(product.name.toLowerCase())) return product
  }

  // Multi-word keyword check (longest match wins)
  const multiWordKeys = Object.keys(KEYWORD_MAP).filter(k => k.includes(' ')).sort((a, b) => b.length - a.length)
  for (const kw of multiWordKeys) {
    if (lower.includes(kw)) {
      const id = KEYWORD_MAP[kw]!
      return PRODUCTS.find(p => p.id === id) ?? null
    }
  }

  // Single-word keyword check
  const words = lower.split(/[\s,.-]+/)
  for (const word of words) {
    const id = KEYWORD_MAP[word]
    if (id) return PRODUCTS.find(p => p.id === id) ?? null
  }

  return null
}

// ── Main parser ────────────────────────────────────────────────────────────

export function parseIntent(text: string): IntentResult {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'No speech detected' }

  const lower = trimmed.toLowerCase()

  // "one of everything" / "all" / "everything"
  if (
    lower.includes('everything') ||
    lower.includes('all of them') ||
    lower.includes('all the') ||
    lower === 'all'
  ) {
    return { ok: true, items: PRODUCTS.map(p => ({ product: p, qty: 1 })) }
  }

  const product = matchProduct(trimmed)
  if (!product) {
    return {
      ok: false,
      error: `Didn't recognise that. Try: "Buy two Moët & Chandon" or "Buy one Veuve Clicquot"`,
    }
  }

  const qty = extractQty(trimmed)
  return { ok: true, items: [{ product, qty }] }
}

// ── Preset commands (for the quick-launch buttons) ─────────────────────────

export const PRESET_COMMANDS = [
  { label: 'Moët & Chandon',   text: 'Buy two Moët & Chandon' },
  { label: 'Veuve Clicquot',   text: 'Buy one Veuve Clicquot' },
  { label: 'One of everything', text: 'Buy one of everything' },
] as const
