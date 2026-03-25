import { describe, it, expect } from 'vitest'
import { parseIntent } from '../intentParser'
import { PRODUCTS } from '../products'

describe('parseIntent', () => {
  // ── Basic product recognition ────────────────────────────────────────────

  it('recognises "Moët & Chandon" by name', () => {
    const r = parseIntent('Buy Moët & Chandon Impérial')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.product.id).toBe('moet-chandon-imperial')
    expect(r.items[0]!.qty).toBe(1)
  })

  it('recognises "dom" keyword (legacy, maps to Moët slot)', () => {
    const r = parseIntent('buy dom')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.product.id).toBe('moet-chandon-imperial')
  })

  it('recognises "crystal" as Mumm slot (legacy keyword)', () => {
    const r = parseIntent('Buy crystal')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.product.id).toBe('gh-mumm-cordon-rouge')
  })

  it('recognises "krug" (legacy, maps to Veuve slot)', () => {
    const r = parseIntent('one Krug please')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.product.id).toBe('veuve-clicquot-yellow-label')
  })

  it('recognises "rose" as Nicolas Feuillatte (legacy keyword)', () => {
    const r = parseIntent('Buy rose')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.product.id).toBe('nicolas-feuillatte-reserve')
  })

  it('recognises "veuve"', () => {
    const r = parseIntent('Buy Veuve Clicquot')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.product.id).toBe('veuve-clicquot-yellow-label')
  })

  // ── Quantity extraction ──────────────────────────────────────────────────

  it('extracts quantity from word "two"', () => {
    const r = parseIntent('Buy two Moët & Chandon')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.qty).toBe(2)
  })

  it('extracts quantity from word "three"', () => {
    const r = parseIntent('three krug')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.qty).toBe(3)
  })

  it('extracts quantity from digit', () => {
    const r = parseIntent('Buy 4 Cristal')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.qty).toBe(4)
  })

  it('defaults to qty 1 when no number present', () => {
    const r = parseIntent('I want krug')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.qty).toBe(1)
  })

  it('"a" counts as quantity 1', () => {
    const r = parseIntent('Buy a bottle of Moët')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.qty).toBe(1)
  })

  // ── "Everything" shortcut ────────────────────────────────────────────────

  it('"one of everything" returns all 4 products with qty 1', () => {
    const r = parseIntent('Buy one of everything')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toHaveLength(PRODUCTS.length)
    for (const item of r.items) expect(item.qty).toBe(1)
  })

  it('"everything" alone returns all products', () => {
    const r = parseIntent('everything')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toHaveLength(PRODUCTS.length)
  })

  it('"all" returns all products', () => {
    const r = parseIntent('all')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toHaveLength(PRODUCTS.length)
  })

  // ── Failure cases ────────────────────────────────────────────────────────

  it('returns ok:false for empty string', () => {
    const r = parseIntent('')
    expect(r.ok).toBe(false)
  })

  it('returns ok:false for whitespace only', () => {
    const r = parseIntent('   ')
    expect(r.ok).toBe(false)
  })

  it('returns ok:false for unrecognised product', () => {
    const r = parseIntent('Buy a burger')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/recogni/)
  })

  // ── Preset commands ──────────────────────────────────────────────────────

  it('preset "Buy two Moët & Chandon" → qty 2, Moët', () => {
    const r = parseIntent('Buy two Moët & Chandon')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.product.id).toBe('moet-chandon-imperial')
    expect(r.items[0]!.qty).toBe(2)
  })

  it('preset "Buy one Veuve Clicquot" → qty 1', () => {
    const r = parseIntent('Buy one Veuve Clicquot')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.product.id).toBe('veuve-clicquot-yellow-label')
    expect(r.items[0]!.qty).toBe(1)
  })
})
