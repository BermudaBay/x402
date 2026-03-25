/**
 * Facilitator route tests.
 *
 * Tests both the Bermuda path (structure check only) and the EIP-3009 path
 * (full signature verification + settlement).
 *
 * The EIP-3009 settlement test stubs out viem's walletClient.writeContract to
 * avoid needing a live RPC. The Bermuda settle test stubs global fetch to
 * simulate the Tilapia relayer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Stub viem before importing the route ─────────────────────────────────────
// The facilitator imports viem at the top level. We only need to stub the parts
// that would make real network calls during tests.

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    // verifyTypedData: return true for tests that pass a "valid" sig token
    verifyTypedData: vi.fn(async ({ signature }: { signature: string }) => {
      return signature === '0xVALID_SIG'
    }),
    createWalletClient: vi.fn(() => ({
      writeContract: vi.fn(async () => '0xTX_HASH'),
    })),
    createPublicClient: vi.fn(() => ({
      waitForTransactionReceipt: vi.fn(async () => ({ gasUsed: 21000n })),
    })),
  }
})

// Set required env vars before importing the route
process.env.NEXT_PUBLIC_USDC_ADDRESS = '0x2710A5ec13b27d708b462Cae52Ea00627eb4c59E'
process.env.NEXT_PUBLIC_USDC_NAME    = 'USD Coin'
process.env.NEXT_PUBLIC_USDC_VERSION = '2'
process.env.FACILITATOR_PK          = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
process.env.BERMUDA_RELAYER_URL      = 'https://mock-relayer.example.com/relay'

// Import route AFTER env + mocks are set up
const { POST } = await import('../facilitator/[action]/route')

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(action: string, body: object) {
  const url = `http://localhost/api/facilitator/${action}`
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const now = Math.floor(Date.now() / 1000)

const VALID_EIP3009_BODY = {
  x402Version: 1,
  paymentPayload: {
    payload: {
      authorization: {
        from:        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        to:          '0x7f0ac507e19B1150cf928A9CC30Cab7dAB445751',
        value:       '1000',
        validAfter:  String(now - 60),
        validBefore: String(now + 300),
        nonce:       '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      },
      signature: '0xVALID_SIG',
    },
  },
  paymentRequirements: {
    payTo:              '0x7f0ac507e19B1150cf928A9CC30Cab7dAB445751',
    amount:             '1000',
    maxTimeoutSeconds:  300,
  },
}

const VALID_BERMUDA_BODY = {
  x402Version: 1,
  paymentPayload: {
    payload: {
      chainId: 84532,
      to:      '0xBermudaPool',
      data:    '0xdeadbeef',
    },
  },
  paymentRequirements: {
    payTo: '0x7f0ac507e19B1150cf928A9CC30Cab7dAB445751',
    amount: '1000',
  },
}

// ── EIP-3009 path ─────────────────────────────────────────────────────────────

describe('EIP-3009 facilitator', () => {
  it('verify: returns isValid true for valid signature', async () => {
    const req = makeRequest('verify', VALID_EIP3009_BODY)
    const res = await POST(req, { params: Promise.resolve({ action: 'verify' }) })
    const data = await res.json() as { isValid: boolean }
    expect(res.status).toBe(200)
    expect(data.isValid).toBe(true)
  })

  it('verify: returns isValid false for expired authorization', async () => {
    const expired = {
      ...VALID_EIP3009_BODY,
      paymentPayload: {
        payload: {
          ...VALID_EIP3009_BODY.paymentPayload.payload,
          authorization: {
            ...VALID_EIP3009_BODY.paymentPayload.payload.authorization,
            validBefore: String(now - 1), // already expired
          },
        },
      },
    }
    const req = makeRequest('verify', expired)
    const res = await POST(req, { params: Promise.resolve({ action: 'verify' }) })
    const data = await res.json() as { isValid: boolean; invalidReason: string }
    expect(data.isValid).toBe(false)
    expect(data.invalidReason).toBe('expired')
  })

  it('verify: returns isValid false for invalid signature', async () => {
    const invalidSig = {
      ...VALID_EIP3009_BODY,
      paymentPayload: {
        payload: {
          ...VALID_EIP3009_BODY.paymentPayload.payload,
          signature: '0xBAD_SIG',
        },
      },
    }
    const req = makeRequest('verify', invalidSig)
    const res = await POST(req, { params: Promise.resolve({ action: 'verify' }) })
    const data = await res.json() as { isValid: boolean; invalidReason: string }
    expect(data.isValid).toBe(false)
    expect(data.invalidReason).toBe('invalid_signature')
  })

  it('settle: returns success with txHash for valid payload', async () => {
    const req = makeRequest('settle', VALID_EIP3009_BODY)
    const res = await POST(req, { params: Promise.resolve({ action: 'settle' }) })
    const data = await res.json() as { success: boolean; transaction: string }
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.transaction).toBe('0xTX_HASH')
  })

  it('returns 400 for missing payload', async () => {
    const req = makeRequest('verify', { x402Version: 1 })
    const res = await POST(req, { params: Promise.resolve({ action: 'verify' }) })
    expect(res.status).toBe(400)
  })
})

// ── Bermuda path ──────────────────────────────────────────────────────────────

describe('Bermuda facilitator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('verify: returns isValid true for well-formed payload', async () => {
    const req = makeRequest('verify', VALID_BERMUDA_BODY)
    const res = await POST(req, { params: Promise.resolve({ action: 'verify' }) })
    const data = await res.json() as { isValid: boolean; payer: string }
    expect(res.status).toBe(200)
    expect(data.isValid).toBe(true)
    expect(data.payer).toBe('bermuda-shielded')
  })

  it('verify: returns non-200 when required fields are missing', async () => {
    // Payload has chainId but no `to` or `data` — fails the Bermuda type guard,
    // falls through to the catch-all 400 response.
    const incomplete = {
      ...VALID_BERMUDA_BODY,
      paymentPayload: {
        payload: { chainId: 84532 }, // missing to + data → isBermudaPayload returns false
      },
    }
    const req = makeRequest('verify', incomplete)
    const res = await POST(req, { params: Promise.resolve({ action: 'verify' }) })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('settle: demo mock returns success without calling Tilapia relayer', async () => {
    const mockFetch = vi.fn() as unknown as typeof fetch
    vi.stubGlobal('fetch', mockFetch)

    const req = makeRequest('settle', VALID_BERMUDA_BODY)
    const res = await POST(req, { params: Promise.resolve({ action: 'settle' }) })
    const data = await res.json() as { success: boolean; transaction: string; network: string; gasUsed: string }

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.transaction).toMatch(/^0x0{62}[0-9a-f]{2}$/)
    expect(data.network).toBe('eip155:84532')
    expect(data.gasUsed).toBe('0')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('settle: demo mock still succeeds when global fetch would fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      text: async () => 'Service unavailable',
    })))

    const req = makeRequest('settle', VALID_BERMUDA_BODY)
    const res = await POST(req, { params: Promise.resolve({ action: 'settle' }) })
    const data = await res.json() as { success: boolean; transaction: string }

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.transaction).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
