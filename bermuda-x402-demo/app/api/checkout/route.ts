import { NextRequest, NextResponse } from 'next/server'
import { withBermudaPayment } from '@/lib/server'
import { parseItemsParam, calcTotal } from '@/lib/products'
import { MAX_CART_UNITS } from '@/lib/demo-limits'
import { v4 as uuidv4 } from 'uuid'
import { createHmac } from 'crypto'

const ORDER_SECRET = process.env.ORDER_SECRET ?? 'demo-secret'

/**
 * GET /api/checkout?items=id:qty,id:qty
 *
 * Protected by x402 Bermuda payment scheme.
 * Returns a signed order confirmation on success.
 */
async function checkoutHandler(req: NextRequest) {
  const itemsParam = req.nextUrl.searchParams.get('items') ?? ''
  const items = parseItemsParam(itemsParam)

  if (!items) {
    return NextResponse.json(
      { error: 'Invalid items parameter. Expected format: productId:qty,...' },
      { status: 400 }
    )
  }

  const unitSum = items.reduce((s, i) => s + i.qty, 0)
  if (unitSum > MAX_CART_UNITS) {
    return NextResponse.json(
      { error: `Demo limit: at most ${MAX_CART_UNITS} bottles per order` },
      { status: 400 },
    )
  }

  const total = calcTotal(items)
  const orderId = uuidv4()
  const ts = Date.now()

  // Sign the order so the confirmation modal can verify integrity
  const payload = `${orderId}:${ts}:${total}`
  const sig = createHmac('sha256', ORDER_SECRET).update(payload).digest('hex').slice(0, 16)

  const lineItems = items.map(({ product, qty }) => ({
    id: product.id,
    name: product.name,
    qty,
    price: product.price,
    subtotal: product.price * qty,
  }))

  return NextResponse.json({
    orderId,
    sig,
    ts,
    items: lineItems,
    total,
    currency: 'USDC',
    status: 'confirmed',
  })
}

const _wrapped = withBermudaPayment(checkoutHandler as (req: NextRequest) => Promise<NextResponse>)

export async function GET(req: NextRequest) {
  try {
    return await _wrapped(req)
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.message}${err.cause ? ` | cause: ${err.cause}` : ''}` : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[checkout] error:', msg, stack)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
