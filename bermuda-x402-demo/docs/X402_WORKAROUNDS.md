# Bermuda x402 integration — documented workarounds

This document describes **intentional workarounds** in the Pop the cork demo so the stack works end-to-end today. They exist because of gaps between **Coinbase x402**, **bermuda-bay-sdk**, **Next.js bundling**, and **on-chain / relayer** requirements—not because of bugs in the demo app itself.

---

## Quick reference

| # | Workaround | Where | Purpose |
|---|------------|--------|---------|
| 1 | **Viem signer merge** | `app/api/bermuda-checkout/route.ts` | Satisfy Bermuda SDK expectations for `address` + `readContract` |
| 2 | **`webpackIgnore` dynamic imports** | `app/api/bermuda-checkout/route.ts`, `lib/server.ts` | Load ESM + top-level-await SDK without webpack breaking it |
| 3 | **Server-side Bermuda checkout** | `app/api/bermuda-checkout/route.ts`, `lib/bermuda-client.ts` | Run ZK / WASM where `import.meta.dirname` and bb.js work |
| 4 | **Mock Bermuda `settle`** | `app/api/facilitator/[action]/route.ts` | Skip real `pool.transact()` when compliance / relayer are not demo-ready |
| 5 | **Lightweight Bermuda `verify`** | Same file | Avoid running full bb.js verifier on every verify call |

---

## 1. Viem signer merge (`address` + `readContract`)

**File:** `app/api/bermuda-checkout/route.ts`

**What we do:** After building a viem `walletClient` and `publicClient`, we merge them into one object passed to `x402BermudaClientScheme`:

```typescript
const signer = Object.assign(walletClient, {
  address: account.address,
  readContract: publicClient.readContract.bind(publicClient),
})
```

**Why:** `x402BermudaClientScheme` (inside bermuda-bay-sdk) uses the signer like a hybrid of viem’s `WalletClient` and a public client: it reads `signer.address` directly and calls `signer.readContract()` for EIP-2612 permit flows. A plain `createWalletClient({ account, ... })` does not expose `readContract`; `account.address` is not the same as `walletClient.address` in the shape the SDK expects.

**Official fix (upstream):** Bermuda SDK could accept `ClientEvmSigner` from `@x402/evm` only, or document and use `walletClient.extend(publicActions)` if that produces a compatible surface. Until the SDK aligns with one viem/x402 pattern, keep this merge.

---

## 2. `import(/* webpackIgnore: true */ 'bermuda-bay-sdk')`

**Files:**

- `app/api/bermuda-checkout/route.ts` — lazy load `@x402/core/client` + `bermuda-bay-sdk`
- `lib/server.ts` — load `x402BermudaServerScheme` for `withBermudaPayment`

**What we do:** Use webpack’s magic comment so the dynamic `import()` stays a **runtime** native import instead of being rewritten to `require()`.

**Why:** `bermuda-bay-sdk` is published as **ESM** and may use **top-level await**. Next.js still bundles API routes through webpack; without `webpackIgnore`, known packages can be transformed in ways that break ESM + TLA loading.

**Official fix (upstream):** A published SDK build that is explicitly compatible with Next’s bundler (or Turbopack-only documented path), or a separate `@bermuda/x402-node` entry that avoids TLA in the import graph.

---

## 3. Server-side Bermuda checkout (not in the browser)

**Files:**

- `lib/bermuda-client.ts` — when `NEXT_PUBLIC_BERMUDA_SCHEME !== 'exact'`, POSTs to `/api/bermuda-checkout` instead of running Bermuda in the tab
- `app/api/bermuda-checkout/route.ts` — runs `x402BermudaClientScheme` + proof generation on Node

**What we do:** The browser never imports `bermuda-bay-sdk` for the default Bermuda flow; the server runs the full 402 → payload → retry cycle (including ZK proof generation).

**Why:** Circuit artifacts and `@aztec/bb.js` / Noir loading rely on **Node-friendly** resolution (e.g. `import.meta.dirname` for circuit paths). That is not reliably available or appropriate in a browser bundle today.

**Official fix (upstream):** A **browser WASM build** of the Bermuda SDK (and documented asset hosting) so `x402BermudaClientScheme` can run in the client; then `bermuda-client.ts` could mirror the `exact` path with wallet-connected signing.

**Security note:** The demo may use `NEXT_PUBLIC_AGENT_PK` server-side for the agent wallet. For production, prefer a server-only secret (no `NEXT_PUBLIC_` prefix) and strict auth (e.g. `X-Demo-Token`).

---

## 4. Mock transaction on Bermuda `settle`

**File:** `app/api/facilitator/[action]/route.ts` (Bermuda branch, `action === 'settle'`)

**What we do:** Return `success: true` with a **synthetic** `transaction` hash instead of submitting calldata to the pool via the Tilapia relayer.

**Why:** Real settlement paths expect **predicate / compliance** setup (e.g. registered compliance manager) that a public one-click demo does not provision. The **ZK proof is still generated** and sent in the x402 payment header; only the final on-chain `pool.transact()`-style step is **simulated** so the x402 middleware can complete with a 200 and order JSON.

**Official fix (upstream):** A testnet or partner environment where:

- relayer accepts demo transactions, **or**
- facilitator proxies to Tilapia with correct compliance registration,

then replace the mock block with a real `fetch(BERMUDA_RELAYER_URL, …)` (or equivalent) and return the real tx hash.

---

## 5. Minimal Bermuda `verify`

**File:** `app/api/facilitator/[action]/route.ts` (Bermuda branch, `action === 'verify'`)

**What we do:** Validate presence of `chainId`, `to`, and `data` in the Bermuda payload; return `isValid: true` if present.

**Why:** Full ZK verification would mean running the same **bb.js verifier** stack on every verify call—heavy and duplicative if the relayer already verifies on settle. For the demo, **verify** is structural; **trust** for proof soundness is deferred to whatever replaces the mock **settle** (see §4).

**Official fix (upstream):** If you operate a production facilitator, either:

- call Tilapia’s verify API if exposed, **or**
- run the official verifier server-side and cache results with a nonce/TTL policy.

---

## Related configuration

| Variable | Role |
|----------|------|
| `FACILITATOR_URL` | Points x402 at this app’s `/api/facilitator` (default local or Vercel-derived) |
| `BERMUDA_RELAYER_URL` | Documented default `https://api.tilapialabs.xyz/relayer/relay` — **not** used for mock settle |
| `NEXT_PUBLIC_BERMUDA_SCHEME` | `exact` = EIP-3009 in browser; anything else = Bermuda server checkout |
| `NEXT_PUBLIC_DEMO_TOKEN` | Optional; requires `X-Demo-Token` on `/api/bermuda-checkout` to limit abuse |

---

## Tracking upstream changes

Re-evaluate this document when:

1. **bermuda-bay-sdk** releases a version that documents browser support or stable Next.js imports without `webpackIgnore`.
2. **Bermuda / Tilapia** provides a documented path for **unsigned demo** or **testnet** full settlement without manual compliance registration.
3. **@x402/core** / **@x402/evm** add first-class docs or helpers for **custom schemes** that subsume the signer merge (if Bermuda adopts them).

Until then, **do not remove these workarounds** without testing the full flow: 402 → payment payload → verify → settle → 200 checkout response.
