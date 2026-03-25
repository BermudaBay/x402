/** Retail-style tags — only these two are shown in the UI. */
export type ProductBadge = 'Best Seller' | 'Limited'

export interface Product {
  id: string
  name: string
  origin: string
  vintage: number
  description: string
  price: number // in USD
  image: string
  badge?: ProductBadge
  details: {
    grapes: string
  }
}

export const PRODUCTS: Product[] = [
  {
    id: 'moet-chandon-imperial',
    name: 'Moët & Chandon Impérial',
    origin: 'Épernay, Champagne',
    vintage: 2024,
    description:
      'The house flagship brut: bright apple, citrus, and white flowers with a creamy mousse. Gold foil, black ribbon — the bottle your guests know on sight.',
    price: 0.001,
    image: '/bottles/moet-chandon.png',
    // Moët & Chandon: typically the highest-volume prestige NV worldwide among these four.
    badge: 'Best Seller',
    details: {
      grapes: 'Pinot Noir, Pinot Meunier, Chardonnay',
    },
  },
  {
    id: 'veuve-clicquot-yellow-label',
    name: 'Veuve Clicquot Yellow Label',
    origin: 'Reims, Champagne',
    vintage: 2024,
    description:
      'Iconic yellow label, pinot-noir–led body: ripe pear, brioche, and a hint of vanilla. Glamour lighting and condensation — party-ready energy.',
    price: 0.001,
    image: '/bottles/veuve-clicquot.png',
    // Yellow Label is also a mass bestseller; "Limited" here is the secondary shelf tag for the demo.
    badge: 'Limited',
    details: {
      grapes: 'Pinot Noir, Chardonnay, Pinot Meunier',
    },
  },
  {
    id: 'nicolas-feuillatte-reserve',
    name: 'Nicolas Feuillatte Réserve',
    origin: 'Chouilly, Champagne',
    vintage: 2023,
    description:
      'Cooperative finesse in a sleek gold-and-black dress: lemon zest, almond, and a clean mineral finish. Shot on cool turquoise marble with ice.',
    price: 0.001,
    image: '/bottles/nicolas-feuillatte.png',
    details: {
      grapes: 'Chardonnay, Pinot Noir, Pinot Meunier',
    },
  },
  {
    id: 'gh-mumm-cordon-rouge',
    name: 'G.H. Mumm Cordon Rouge',
    origin: 'Reims, Champagne',
    vintage: 2024,
    description:
      'The red-sash classic: structured pinot fruit, crisp acidity, and a long, toasty close. Pictured with a flute of rising bubbles — instant celebration.',
    price: 0.001,
    image: '/bottles/gh-mumm.png',
    details: {
      grapes: 'Pinot Noir, Chardonnay, Pinot Meunier',
    },
  },
]

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find(p => p.id === id)
}

export function parseItemsParam(param: string): Array<{ product: Product; qty: number }> | null {
  try {
    const entries = param.split(',')
    const items: Array<{ product: Product; qty: number }> = []
    for (const entry of entries) {
      const [id, qtyStr] = entry.split(':')
      const qty = parseInt(qtyStr ?? '1', 10)
      const product = getProduct(id!)
      if (!product || isNaN(qty) || qty < 1) return null
      items.push({ product, qty })
    }
    return items.length > 0 ? items : null
  } catch {
    return null
  }
}

export function calcTotal(items: Array<{ product: Product; qty: number }>): number {
  return items.reduce((sum, { product, qty }) => sum + product.price * qty, 0)
}

/**
 * Format a USDC amount for display, using enough decimal places to represent
 * sub-cent prices (e.g. 0.001 USDC for conference demos).
 */
export function formatUSDC(value: number): string {
  if (value < 0.01) return value.toFixed(4)
  if (value < 1)    return value.toFixed(3)
  return value.toFixed(2)
}
