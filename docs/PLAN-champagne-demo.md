# Bermuda x402 Champagne Demo — Implementation Plan

**Goal:** A crypto conference demo that showcases Bermuda's privacy implementation of x402 through a Shopify-like champagne store. Users buy champagne with their wallet; the flow feels like a normal e-commerce checkout while clearly demonstrating how x402 + Bermuda privacy work together.

---

## 1. Executive Summary

| Aspect | Approach |
|--------|----------|
| **User story** | Browse champagne → add to cart → checkout → pay with wallet → receive confirmation |
| **Privacy angle** | Payments use Bermuda shielded transfer/withdrawal scheme; transaction graph is obfuscated |
| **x402 role** | HTTP 402 paywall on checkout API; `wrapFetchWithPayment` + Bermuda client scheme auto-handles payment |
| **UX bar** | Must feel like a normal Shopify purchase — no crypto jargon, minimal steps |
| **Dev experience** | Clear, valuable demo of x402 in the flow; optional "developer view" to show protocol steps |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHAMPAGNE STORE (Frontend)                          │
│  • Product catalog (champagne)                                               │
│  • Cart + checkout UI (Shopify-like)                                         │
│  • Faucet entry point ("Get test tokens")                                    │
│  • x402-wrapped fetch for checkout API                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ fetchWithPayment("/api/checkout", { cart, ... })
                                    │ (auto 402 → Bermuda signer → retry with PAYMENT-SIGNATURE)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHECKOUT API (Express + x402 middleware)                  │
│  • paymentMiddlewareFromHTTPServer(httpServer)                              │
│  • Routes: POST /api/checkout (paywalled), GET /api/products (public)       │
│  • Bermuda facilitator + scheme (transfer/withdrawal)                        │
│  • Optional: payment-identifier for idempotency, facilitator-fee extension  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ verify/settle via facilitator
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BERMUDA FACILITATOR                                 │
│  • Runs in testenv (Docker)                                                 │
│  • Verifies/settles shielded transfers                                      │
│  • Testnet (e.g. Base Sepolia or Bermuda testnet)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phased Implementation Plan

### Phase 0: Prerequisites & Environment (Week 1)

**0.1 Testenv setup**
- Clone `BermudaBay/testenv`, checkout branch `x402`, ensure PR #89 (or equivalent) is applied
- Run testenv locally with Docker per [dev README](https://github.com/BermudaBay/testenv/tree/x402#dev)
- Add `otterscan` to `.env` for block explorer at `:4194`
- Verify: facilitator, chain, faucet, and explorer are reachable

**0.2 Bermuda SDK integration**
- Ensure `@bermuda/sdk` (or equivalent) is available with:
  - `getAccount()` — derives Bermuda account from connected wallet for transfer/withdrawal
  - Bermuda client scheme compatible with x402 `SchemeNetworkClient`
- If SDK lacks x402 integration: implement a Bermuda x402 client scheme that uses `getAccount()` for signing

**0.3 Faucet**
- Use testenv faucet or add a dedicated faucet endpoint
- Faucet UI: "Get test USDC" (or testnet token) — one-click, address from connected wallet
- Ensure sufficient balance for 2–3 champagne purchases per user

---

### Phase 1: Server & x402 Backend (Week 2)

**1.1 Express server with x402**
- Create `demo-server/` (or integrate into testenv)
- Use `paymentMiddlewareFromHTTPServer(httpServer)` pattern from [payment-identifier example](examples/typescript/servers/payment-identifier/index.ts)
- Configure `x402ResourceServer` + `x402HTTPResourceServer` with:
  - Bermuda facilitator URL (from testenv)
  - Bermuda transfer/withdrawal scheme (not vanilla ExactEvmScheme)

**1.2 Route configuration**
```typescript
// Pseudocode
const routes = {
  "POST /api/checkout": {
    accepts: [{ scheme: "bermuda-transfer", price: "$X.XX", network: "eip155:...", payTo: "..." }],
    description: "Complete champagne purchase",
    mimeType: "application/json",
    extensions: {
      [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension(false), // idempotency
      // facilitator-fee when SDK supports it
    },
  },
};
```

**1.3 SDK abstractions (parallel track)**
- Abstract server config into reusable helpers (e.g. `createBermudaX402Server(config)`)
- Add facilitator-fee extension support per [Bermuda SDK x402.ts](https://github.com/BermudaBay/sdk/blob/14d8c125fa773d2e7e9fe48d8cfd09438e8e21b3/src/x402.ts#L79)
- Add payment-identifier extension for session/idempotency (see [payment-identifier example](examples/typescript/servers/payment-identifier))

---

### Phase 2: Custom Paywall UI (Week 2–3)

**2.1 Paywall customization**
- Use `paymentMiddlewareFromHTTPServer(..., paywallConfig, customPaywall)` with a custom paywall provider
- Custom paywall: Bermuda branding, "Pay with Bermuda" messaging
- On wallet connect: derive Bermuda account via `getAccount()` for transfer/withdrawal scheme

**2.2 Wallet connection flow**
1. User sees paywall (402) when hitting checkout
2. Connect wallet (MetaMask, Coinbase Wallet, etc.)
3. `getAccount(connectedAddress)` → Bermuda account used for payment
4. Sign payment → request retried with `PAYMENT-SIGNATURE` → 200 + order confirmation

**2.3 UX polish**
- No "402" or "Payment Required" raw copy — use "Complete payment" / "Pay with wallet"
- Show price clearly, balance check before payment
- Loading states, error handling, success confirmation

---

### Phase 3: Champagne Store Frontend (Week 3)

**3.1 Product catalog**
- Static or simple API: 3–5 champagne products with name, image, price
- Public `GET /api/products` (no payment)

**3.2 Cart & checkout**
- Add to cart, quantity, total
- Checkout button → `fetchWithPayment("/api/checkout", { method: "POST", body: JSON.stringify({ cart }) })`
- Client uses `wrapFetchWithPayment(fetch, bermudaX402Client)` where `bermudaX402Client` uses Bermuda signer from `getAccount()`

**3.3 Faucet entry**
- Prominent "Get test tokens" near checkout or in header
- On click: call faucet API with `address` from wallet, show success toast

**3.4 Developer view (optional)**
- Toggle: "Show x402 flow" — highlights 402 → payment → 200 steps, or a small timeline
- Helps conference attendees understand where x402 and Bermuda privacy fit

---

### Phase 4: End-to-End & Demo Hardening (Week 4)

**4.1 E2E testing**
- Full flow: faucet → add to cart → checkout → payment → confirmation
- Test with multiple wallets, insufficient balance, network switch

**4.2 Demo script**
- 2–3 minute walkthrough for booth/conference
- Emphasize: "Same as Shopify" + "Payments are private via Bermuda"

**4.3 Fallbacks**
- Offline/fallback mode if testenv is down
- Clear error messages for network/faucet issues

---

## 4. Technical Integration Points

### 4.1 Client: x402 + Bermuda

```typescript
// Conceptual — adapt to actual Bermuda SDK API
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { getAccount } from "@bermuda/sdk"; // or equivalent

// After wallet connect
const bermudaAccount = await getAccount(connectedAddress);
const client = new x402Client();
client.register("eip155:*", new BermudaTransferScheme(bermudaAccount)); // Bermuda scheme
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const res = await fetchWithPayment("/api/checkout", {
  method: "POST",
  body: JSON.stringify({ cart: [...] }),
});
```

### 4.2 Server: Express + x402 middleware

```typescript
// Conceptual
import { paymentMiddlewareFromHTTPServer, x402ResourceServer, x402HTTPResourceServer } from "@x402/express";
import { BermudaFacilitatorClient } from "@bermuda/sdk"; // or equivalent

const resourceServer = new x402ResourceServer(bermudaFacilitator)
  .register("eip155:*", new BermudaTransferSchemeServer());

const httpServer = new x402HTTPResourceServer(resourceServer, routes)
  .onProtectedRequest(/* optional idempotency hook */);

app.use(paymentMiddlewareFromHTTPServer(httpServer, paywallConfig, bermudaPaywall));
```

### 4.3 Paywall customization

- Extend or replace `@x402/paywall` EVM template with Bermuda-specific UI
- Pass `getAccount()`-derived signer into the payment flow
- Ensure "Bermuda" / "Private payment" is visible without overwhelming the user

---

## 5. Privacy Value Proposition (Demo Narrative)

| Moment | What user sees | What’s private |
|-------|----------------|----------------|
| Browse | Champagne catalog | — |
| Add to cart | Cart updates | — |
| Checkout | "Pay with wallet" | — |
| Connect wallet | Wallet connect modal | — |
| Pay | One signature, confirmation | **Bermuda shielded transfer** — payment graph is obfuscated |
| Done | Order confirmation | Recipient/amount not linkable on public chain |

**Talking point:** "You just bought champagne like on Shopify. Under the hood, your payment used Bermuda’s privacy layer — the merchant gets paid, but the transaction graph stays private."

---

## 6. File Structure (Proposed)

```
bermuda-x402-demo/
├── server/                 # Express + x402 middleware
│   ├── index.ts
│   ├── routes.ts
│   └── bermuda-x402.ts     # Server config abstraction
├── client/                 # Next.js or Vite SPA
│   ├── app/
│   │   ├── page.tsx        # Store frontend
│   │   ├── checkout/       # Checkout flow
│   │   └── api/            # Optional BFF
│   └── lib/
│       ├── x402-client.ts  # Bermuda x402 client setup
│       └── faucet.ts
├── paywall/                # Custom Bermuda paywall (if separate package)
│   └── BermudaPaywall.tsx
├── docker-compose.yml      # Or use testenv's
└── README.md               # Dev setup, demo script
```

---

## 7. Dependencies & Ordering

```
testenv (Docker) ──────────────────────────────────────────────┐
     │                                                           │
     ├── facilitator, chain, faucet, explorer                    │
     │                                                           │
Bermuda SDK ───────────────────────────────────────────────────┤
     │                                                           │
     ├── getAccount(), Bermuda x402 scheme (client + server)     │
     │                                                           │
     ▼                                                           ▼
Server (Express + x402) ◄──────────────────────────────────────┘
     │
     ├── paymentMiddlewareFromHTTPServer
     ├── Bermuda scheme, facilitator-fee, payment-identifier
     │
     ▼
Custom Paywall (Bermuda branding, getAccount flow)
     │
     ▼
Store Frontend (catalog, cart, checkout, faucet)
     │
     └── wrapFetchWithPayment + Bermuda client
```

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| testenv/PR not ready | Use mock facilitator or fallback to standard ExactEvmScheme for demo |
| Bermuda scheme not x402-ready | Implement thin adapter: Bermuda signer → x402 SchemeNetworkClient |
| Faucet rate limits | Pre-fund a few demo wallets; use as backup |
| Network congestion at conference | Run on local/testnet; consider offline-capable flow |
| Paywall UX feels "crypto" | A/B test copy; prioritize "Pay" over "Sign" |

---

## 9. Success Criteria

- [ ] User can get test tokens from faucet in &lt; 30 seconds
- [ ] User can complete checkout in &lt; 60 seconds (after tokens)
- [ ] Payment uses Bermuda shielded transfer (verifiable on explorer or logs)
- [ ] No raw "402" or protocol jargon in main UI
- [ ] Developer view (optional) clearly shows x402 steps
- [ ] Demo runs reliably on testenv for 2+ hours at conference

---

## 10. References

- **x402 flow:** [x402 README](README.md) — 402 → PaymentRequired → PAYMENT-SIGNATURE → 200
- **Client:** `wrapFetchWithPayment` — [typescript/packages/http/fetch](typescript/packages/http/fetch)
- **Server:** `paymentMiddlewareFromHTTPServer` — [typescript/packages/http/express](typescript/packages/http/express)
- **Paywall:** [typescript/packages/http/paywall](typescript/packages/http/paywall) — customize for Bermuda
- **Payment-identifier:** [examples/typescript/servers/payment-identifier](examples/typescript/servers/payment-identifier)
- **Bermuda SDK x402:** facilitator-fee extension at `BermudaBay/sdk/src/x402.ts`
- **Testenv:** `BermudaBay/testenv` branch `x402`, PR #89, add `otterscan` for explorer `:4194`
