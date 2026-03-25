# Bermuda Cellars — x402 Private Champagne Demo

A conference demo showing [x402](https://x402.org) — the HTTP-native payment protocol — integrated with [Bermuda Protocol](https://github.com/BermudaBay)'s private payment scheme.

Users browse champagne, add to cart, and pay through an **embedded agent wallet** (no browser wallet connect in the default conference flow). The **x402 Inspector** shows each HTTP step live; the receipt links out to **Base Sepolia Blockscout** by default.

### Conference demo (ECC / public URL)

- **Chain:** Base Sepolia (`NEXT_PUBLIC_NETWORK=baseSepolia`). Aligning with other internal deployments (e.g. Basopolia) is optional for later.
- **SDK:** This app vendors `bermuda-bay-sdk` for the Bermuda x402 path. The demo may **circumvent compliance** in the HTTP checkout path so it runs on testnet without a full compliance proof — fine for a **non-released** demo; shipping a cookbook or public SDK example may need a different configuration.
- **Faucet:** `FAUCET_PK` must hold **Base Sepolia ETH** (gas for `mint`). Top up the **agent** (`NEXT_PUBLIC_AGENT_PK`) before events; rate limits apply per address on `/api/faucet`.
- **Abuse caps:** Cart and `/api/checkout` enforce a **max bottle count** (`lib/demo-limits.ts`) so one session cannot drain the agent.
- **Block explorer:** Defaults to `https://base-sepolia.blockscout.com`. Set `NEXT_PUBLIC_EXPLORER_TX_URL` (no trailing slash) to use Basescan or another explorer.

## Architecture

```
Browser                    Next.js API              Facilitator
──────────────────────────────────────────────────────────────
GET /api/checkout?items=…  ──▶  402 Payment Required
                           ◀──  (scheme: exact / bermuda::anyhow)

wallet.signAuth()          [EIP-3009 or ZK permit]
wrapFetchWithPayment()     ──▶  GET + PAYMENT-SIGNATURE header
                           ──▶  Verify + Settle ──▶ x402.org / Bermuda facilitator
                           ◀──  200 + Order confirmation
```

## Quick Start

```bash
cd bermuda-x402-demo
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_PAY_TO to your address
npm run dev
```

Open http://localhost:3000

## Modes

### Standard x402 (default — no testenv needed)

Works out of the box against Base Sepolia using https://x402.org/facilitator.

1. Get test USDC from [Circle Faucet](https://faucet.circle.com) (use the Faucet button in the app)
2. Connect MetaMask (switch to Base Sepolia)
3. Add champagne to cart and click **Pay Privately with Bermuda**

### Full Bermuda Privacy Mode (requires testenv)

For the complete Bermuda ZK privacy experience, run testenv locally.

**Prerequisites:** Docker, Node.js 20+, `gh` CLI authenticated to `BermudaBay`.

```bash
# 1. Clone and start testenv (branch: x402)
gh repo clone BermudaBay/testenv testenv
cd testenv
git checkout x402

# 2. Enable Otterscan block explorer
echo 'OTTERSCAN_ENABLED=true' >> .env

# 3. Start all services
docker compose up -d

# Services started:
#   :8545  — Hardhat chain (testenv)
#   :4190  — MPT prover
#   :4191  — Bermuda relayer / x402 facilitator
#   :4194  — Otterscan block explorer (if OTTERSCAN_ENABLED=true)
#   :4195  — Compliance manager

# 4. Configure demo for testenv
cd ../bermuda-x402-demo
cat >> .env.local << EOF
NEXT_PUBLIC_NETWORK=testenv
NEXT_PUBLIC_BERMUDA_SCHEME=bermuda
FACILITATOR_URL=http://localhost:4191
FAUCET_URL=http://localhost:3001/faucet
EOF

npm run dev
```

In Bermuda mode the checkout uses `x402BermudaServerScheme('bermuda::anyhow')` on the server
and (once the browser-compatible SDK build ships) `x402BermudaClientScheme` on the client
for full ZK proof generation in the browser.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_NETWORK` | `baseSepolia` | `baseSepolia` or `testenv` |
| `NEXT_PUBLIC_BERMUDA_SCHEME` | `exact` | `exact` (EIP-3009) or `bermuda` (full ZK) |
| `NEXT_PUBLIC_PAY_TO` | `0x000…001` | Address / Bermuda shielded address to receive payments |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | `demo` | WalletConnect project ID |
| `FACILITATOR_URL` | `https://x402.org/facilitator` | x402 facilitator endpoint |
| `FAUCET_URL` | — | Testenv faucet endpoint (testenv only) |
| `NEXT_PUBLIC_EXPLORER_TX_URL` | Blockscout Base Sepolia | Base URL for `/tx/{hash}` links |
| `ORDER_SECRET` | `change-me` | HMAC secret for order signatures |

## File Structure

```
bermuda-x402-demo/
├── app/
│   ├── layout.tsx              # Root layout — Wagmi + RainbowKit + CartContext
│   ├── page.tsx                # Shop page
│   └── api/
│       ├── checkout/route.ts   # x402-protected checkout (dynamic price)
│       ├── products/route.ts   # Public product catalog
│       └── faucet/route.ts     # Test token faucet (proxies testenv or Circle)
├── components/
│   ├── Providers.tsx           # WagmiProvider + QueryClient + CartProvider
│   ├── Header.tsx              # Nav: logo, wallet button, cart icon, faucet
│   ├── HeroBanner.tsx          # Hero with x402 + Bermuda story
│   ├── ProductGrid.tsx         # 4-column champagne catalog
│   ├── ProductCard.tsx         # Individual product card
│   ├── CartDrawer.tsx          # Slide-out cart with checkout button
│   ├── CheckoutButton.tsx      # x402 payment flow — instrumented
│   ├── CartReceiptPanel.tsx    # In-drawer private receipt after checkout
│   ├── FaucetModal.tsx         # Test USDC request modal
│   └── X402Inspector.tsx       # Live x402 protocol debug panel
├── context/
│   └── CartContext.tsx         # Cart state (useReducer + localStorage)
└── lib/
    ├── bermuda-client.ts       # Client x402 flow — ExactEvmScheme (swap for Bermuda)
    ├── products.ts             # Static champagne catalog
    ├── server.ts               # Server x402 config — dynamic scheme selection
    └── wagmi.ts                # Wagmi chain + connector config
```

## x402 Inspector Panel

The **x402 Inspector** (bottom of the page) shows the live payment protocol steps:

| Step | Label | Description |
|---|---|---|
| 1 | `REQUEST` | Initial GET to `/api/checkout` |
| 2 | `PAYMENT-REQUIRED` | Server returns 402 with payment requirements |
| 3 | `BERMUDA-ACCOUNT` | Bermuda shielded address derived (or wallet addr in exact mode) |
| 4 | `PROOF-CREATED` | ZK proof generated (or EIP-3009 auth signed in exact mode) |
| 5 | `PAYMENT-SIGNATURE` | Retry with `PAYMENT-SIGNATURE` header |
| 6 | `ORDER-CONFIRMED` | 200 + signed order returned |

Click any step to expand and view the raw JSON payload.

## Adding Bermuda Branding

To add the real Bermuda logos, drop PNG files into `public/`:

```
public/
├── bermuda-logo.svg       # Bermuda wordmark (used in header)
└── bottles/
    ├── moet-chandon.png
    ├── veuve-clicquot.png
    ├── nicolas-feuillatte.png
    └── gh-mumm.png
```

## Full Bermuda SDK Integration

The client flow in `lib/bermuda-client.ts` currently uses `ExactEvmScheme`. Swap it for the
full Bermuda privacy scheme when `@bermuda/sdk` ships a browser-WASM compatible build:

```typescript
// In bermudaCheckout(), replace the ExactEvmScheme block with:
import { x402BermudaClientScheme, getAccount } from 'bermuda-bay-sdk'

const keyPair = await getAccount({ signer: walletClient })
const scheme = new x402BermudaClientScheme('bermuda::anyhow', walletClient, keyPair)
xClient.register('eip155:*', scheme)
```
