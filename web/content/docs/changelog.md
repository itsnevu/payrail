---
title: Changelog
description: What changed in Payrail and when, from the contract v2 key derivation to the Robinhood Chain deployment and the landing rebuild.
order: 12
section: Reference
---

# Changelog

What changed, newest first. Entries come from the git history and, for the days before the repository was snapshotted, from the dated documents written at the time (the review notes in `contracts/README.md`, the whitepaper, the blog). There are no release tags or numbered releases. The only label is **contract v2**, because the contract cannot be changed after deployment and readers need to know which one they are looking at.

> **Note:** A changelog entry is not a claim that a feature is finished. The list of what has not been built lives in [Risks and limits](/docs/risks-and-limits) and is kept current separately.

## 20 September 2026

### Robinhood Chain only

An earlier multi-chain refactor was settled on Robinhood Chain only. Code, configuration, docs, blog, whitepaper and landing page now describe one network. What stayed is the machinery underneath: each invoice is pinned to a `chainId`, verification and the indexer run per chain with one cursor each, and `NEXT_PUBLIC_CHAINS` (production: `4663`) decides which chains a deployment enables.

### Landing rebuild

White theme with black ink. The hero was rebuilt around the glass "P" key visual, first as a still, then as a rendered loop with the still as its poster. The problem section became a match-the-transfer game, the pay walkthrough runs on a phone mock as it scrolls into view, and the trust cards flip to the code behind each claim. Favicons and PWA icons were regenerated from the transparent mark. Pointer effects are mouse only, the motion layer switches off under reduced motion, and the hero loop falls back to the still.

### Same-origin RPC relay

The public Robinhood Chain RPC is content-filtered by some ISPs. The browser and the wallet now talk to `POST /api/rpc/4663`, a relay on the app's own origin that forwards an allow-list of read and broadcast methods. A transport choice, not a trust boundary: PAID is still decided from a `PaymentReceived` log. See [Verification and the indexer](/docs/verification-and-indexer).

### One-shot deploy script

`npm run go:robinhood` needs only `DEPLOYER_PRIVATE_KEY`: it picks a working RPC, checks the deployer's ETH, probes the token for code and `decimals == 6`, deploys, attempts Blockscout verification (non-fatal) and writes the deployment record.

## 19 September 2026

### PaymentProcessor live on Robinhood Chain

Deployed to Robinhood Chain (chain id 4663) at `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D`, 18:58 UTC, which is 20 September in UTC+7 and why other pages give that date. It points at USDG, `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, 6 decimals. The app labels amounts USDG; on Robinhood Chain the token moved is USDG. Blockscout source verification is still pending. No deployment on the testnet (46630). See [Contracts](/docs/contracts).

## 18 September 2026

### Repository snapshot and UI layer

The whole project went into git as a baseline snapshot, and the same day the app got a material and motion layer: glass header, hairline card edges, pointer spotlight, scroll reveal, a live PAID badge, skeleton loading states. Additive CSS plus one `Effects` component.

## 17 September 2026

### Contract v2: the key is derived on chain

The first contract keyed a payment on a caller-supplied `invoiceId` and took `merchant` and `amount` as free arguments, so anyone who saw a payment link could pay one unit to themselves and lock the real invoice. v2 is `pay(salt, merchant, amount)` and derives the key inside the contract:

```solidity
bytes32 invoiceId = keccak256(abi.encode(salt, merchant, amount));
```

Wrong terms land on a different key and cannot touch the real invoice. Two `griefing resistance` tests and `web/scripts/e2e-local.mjs`, which replays the attack against a local stack, cover it. The backend's amount check moved from `>=` to exact equality, since an overpayment is now a different key and must not match.

### Second internal review pass

Eight findings (one High, one Medium, three Low, three Info), all resolved, recorded in `contracts/README.md`. This is an internal review, not an independent audit. The Terms and the Privacy page are dated the same day.

## 15 September 2026

### Two routes to PAID

Before this the only way to mark an invoice paid was the browser posting a `txHash` after `pay()` confirmed, which failed whenever a tab closed too early. The indexer became the second route: it scans `PaymentReceived` events behind a confirmation margin and feeds them through the same idempotent `applyPaymentLog`. Told in full in [Two routes to PAID](/blog/two-routes-to-paid) and [Payment flow](/docs/payment-flow).
