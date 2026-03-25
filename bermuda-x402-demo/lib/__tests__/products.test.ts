import { describe, it, expect } from 'vitest'
import { parseItemsParam, calcTotal, formatUSDC, PRODUCTS } from '../products'

// ── parseItemsParam ──────────────────────────────────────────────────────────

describe('parseItemsParam', () => {
  it('parses a single item with qty 1', () => {
    const result = parseItemsParam('moet-chandon-imperial:1')
    expect(result).not.toBeNull()
    expect(result![0]!.product.id).toBe('moet-chandon-imperial')
    expect(result![0]!.qty).toBe(1)
  })

  it('parses multiple items', () => {
    const result = parseItemsParam('moet-chandon-imperial:2,veuve-clicquot-yellow-label:1')
    expect(result).toHaveLength(2)
    expect(result![0]!.qty).toBe(2)
    expect(result![1]!.qty).toBe(1)
  })

  it('defaults qty to 1 when omitted', () => {
    const result = parseItemsParam('moet-chandon-imperial')
    expect(result).not.toBeNull()
    expect(result![0]!.qty).toBe(1)
  })

  it('returns null for unknown product id', () => {
    expect(parseItemsParam('fake-product:1')).toBeNull()
  })

  it('returns null for qty = 0', () => {
    expect(parseItemsParam('moet-chandon-imperial:0')).toBeNull()
  })

  it('returns null for negative qty', () => {
    expect(parseItemsParam('moet-chandon-imperial:-1')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseItemsParam('')).toBeNull()
  })

  it('returns null for malformed entry', () => {
    expect(parseItemsParam('moet-chandon-imperial:abc')).toBeNull()
  })

  it('all four products are parseable', () => {
    for (const product of PRODUCTS) {
      const result = parseItemsParam(`${product.id}:1`)
      expect(result).not.toBeNull()
      expect(result![0]!.product.id).toBe(product.id)
    }
  })
})

// ── calcTotal ────────────────────────────────────────────────────────────────

describe('calcTotal', () => {
  it('calculates total for a single item', () => {
    const items = parseItemsParam('moet-chandon-imperial:1')!
    expect(calcTotal(items)).toBeCloseTo(0.001)
  })

  it('calculates total for multiple qty', () => {
    const items = parseItemsParam('moet-chandon-imperial:3')!
    expect(calcTotal(items)).toBeCloseTo(0.003)
  })

  it('sums across multiple products', () => {
    const items = parseItemsParam('moet-chandon-imperial:1,veuve-clicquot-yellow-label:1')!
    expect(calcTotal(items)).toBeCloseTo(0.002)
  })

  it('returns 0 for empty items array', () => {
    expect(calcTotal([])).toBe(0)
  })
})

// ── formatUSDC ───────────────────────────────────────────────────────────────

describe('formatUSDC', () => {
  it('uses 4 decimals for values < 0.01', () => {
    expect(formatUSDC(0.001)).toBe('0.0010')
    expect(formatUSDC(0.0001)).toBe('0.0001')
  })

  it('uses 3 decimals for values between 0.01 and 1', () => {
    expect(formatUSDC(0.5)).toBe('0.500')
    expect(formatUSDC(0.01)).toBe('0.010')
  })

  it('uses 2 decimals for values >= 1', () => {
    expect(formatUSDC(1)).toBe('1.00')
    expect(formatUSDC(25)).toBe('25.00')
    expect(formatUSDC(1250.5)).toBe('1250.50')
  })

  it('handles zero', () => {
    expect(formatUSDC(0)).toBe('0.0000')
  })
})
