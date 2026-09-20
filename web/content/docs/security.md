---
title: Security model
description: Who can do what to a Payrail invoice, what the contract and backend guarantee, what they do not, and how to report a problem.
order: 9
section: Under the hood
---

# Security model

This page is the threat model behind [Risks and limits](/docs/risks-and-limits). That page lists what can go wrong. This one says who we assume is hostile, where the trust boundaries sit, and which guarantees hold on each side. Read it before self-hosting.

One naming note applies throughout. The app labels amounts USDG. On Robinhood Chain the token that actually moves is USDG (Global Dollar, 6 decimals, `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`).

## Threat model

### Assets

**Tokens in flight.** The stablecoin moving from buyer to merchant inside `pay()`. The only asset with a dollar value. It moves in exactly one transaction, `pay()`; the `approve` before it grants an allowance and moves nothing.

**Invoice records.** The `Invoice`, `Payment` and `Merchant` rows and the PAID status derived from them. No dollar value, but they are what a merchant acts on: shipping goods, closing a ticket, reconciling the month.

**Operator secrets.** `INDEXER_SECRET`, `VAPID_PRIVATE_KEY` and, on the deployment machine only, `DEPLOYER_PRIVATE_KEY`.

### Actors

| Actor | What they can do | What we assume |
| --- | --- | --- |
| Merchant | Register a wallet, create and cancel invoices, read the dashboard | Honest about their own wallet; may be careless |
| Buyer | Open a payment link, call `approve` and `pay` from any wallet or script | May try to get PAID without paying |
| Anyone on the internet | Call every API route except `POST /api/indexer`; read every payment link | Hostile |
| RPC provider | Answer or refuse chain reads and broadcasts | Can lie. `verify.ts` believes the receipt and logs its RPC returns, so status is only as honest as `RPC_URL_4663`. It cannot move funds |
| Payrail operator | Run the server, the database and the indexer secret | Trusted for status, never for funds |

### Trust boundaries

There are three, and money crosses only the first.

1. **Buyer wallet to contract to merchant wallet.** The stablecoin passes through `safeTransferFrom(msg.sender, merchant, amount)` inside `pay()`. Nothing else in Payrail can touch it.
2. **Chain to backend.** `verify.ts` reads receipts and `PaymentReceived` logs over RPC and decides PAID. The chain is the source of truth for payments; the indexer can re-derive `Payment` rows from `PaymentReceived` logs, but only for invoices that still exist in the database and only from its cursor forward.
3. **Browser to backend.** The client sends invoice fields and a `txHash`. The `txHash` is a pointer to a receipt, not a claim. No byte from the browser decides PAID.

Funds land in your wallet, not ours. The operator can corrupt status, never custody.

## What the contract guarantees

`PaymentProcessor.sol` is 91 lines on OpenZeppelin 5, Solidity 0.8.24, deployed at `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D` on Robinhood Chain.

- **Funds never stop.** The only token movement is buyer to merchant in the same call. The contract's balance is zero structurally, not by policy.
- **One payment per key.** `invoiceId = keccak256(abi.encode(salt, merchant, amount))`. A second `pay()` with the same terms reverts with `InvoiceAlreadyPaid`. `nonReentrant` closes the reentrancy window, and the payment record is written before the transfer.
- **The key is the terms.** A call with a known `salt` but a different `merchant` or `amount` lands on a different key and cannot lock the real invoice. This closed the v1 griefing bug; two regression tests and `web/scripts/e2e-local.mjs` replay the attack.
- **Nobody can change it.** No `owner`, `pause`, `upgrade` or adjustable parameter. `usdc` is `immutable`.
- **Input bounds.** `InvalidMerchant` for the zero address or the contract itself; `InvalidAmount` for zero or above `type(uint96).max`.

## What the contract does not guarantee

- It does not know what an invoice is. Any `(salt, merchant, amount)` triple is accepted, so a hand-made call with wrong terms sends tokens wherever the caller pointed them. Nothing can reverse that.
- It does not know about CANCELLED or EXPIRED. Those are database words.
- It cannot un-freeze a merchant wallet. If the token contract refuses transfers to or from an address, `safeTransferFrom` reverts and that merchant cannot be paid through this contract.
- It has been through two internal review passes and 11 tests. It is **not independently audited**.

## What the backend guarantees

- **Re-validation from the event.** Both routes to PAID end in `applyPaymentLog`, which takes `invoiceId`, `merchant` and `amount` from a `PaymentReceived` log at this chain's contract address, on the invoice's own `chainId`, after `CONFIRMATIONS` blocks. Merchant must match the registered wallet, amount must match exactly. Someone else's `txHash` fails the `invoiceId` check.
- **Idempotency.** A second application of the same event returns `ok` without writing. `txHash @unique` and `invoiceId @unique` make concurrent duplicates fail on the constraint, so the fast route and the indexer can overlap freely.
- **No client claims.** The pay page fills `pay()` from the database record and the verify route reads the receipt itself. A screenshot, a forged `txHash` or a modified page cannot produce PAID.
- **Relay allow-list.** `POST /api/rpc/4663` forwards only read methods and `eth_sendRawTransaction`, rate-limited per IP. It is a transport, not a trust boundary.

## What the backend does not guarantee

- **Authentication.** There is none. Anyone can create, list or cancel any merchant's invoices and read any invoice by id.
- **Reorg recovery.** After `CONFIRMATIONS` (`CONFIRMATIONS_4663=2` in the example configuration), PAID is final in the database. There is no mechanism to revert PAID.
- **Status over chain.** A CANCELLED invoice can still be paid on chain and becomes PAID.
- **Privacy of links.** Payment links are public. Do not put secrets in the description.

## Known gaps

These are the gaps the repo's README and [Risks and limits](/docs/risks-and-limits) name themselves, not softened.

- **Merchant authentication** (SIWE). Required before production. Until then anyone can create invoices for any merchant. An attacker can flood your dashboard with fake invoices, or create an invoice in your name and send the link to your client. If paid, it still sends the tokens to **your wallet**, because the merchant address comes from the database, not from whoever created the invoice. Annoying, not theft.
- **Cancel is not on chain.** `DELETE /api/invoices/:id` only changes the database. Cancelled but paid anyway is a real outcome; the merchant refunds by hand.
- **Indexer secret** is a shared string compared on every call. A leaked secret lets someone trigger scans, a nuisance, not a way to fake PAID. Rotate it.

> **Warning:** none of these gaps lets an attacker move your funds. All of them let an attacker or a careless buyer make your records wrong.

## Operator security for self-hosters

If you run your own instance, you own these.

| Secret | Where it lives | Rule |
| --- | --- | --- |
| `INDEXER_SECRET` | Web server env | Set a long random value. `change-me` is the example default and rejects nothing useful. |
| `VAPID_PRIVATE_KEY` | Web server env | Signs push messages. Leaked together with the stored subscription endpoints, it lets someone push messages to your merchants' devices. Regenerate with `npx web-push generate-vapid-keys` and re-subscribe. |
| `DEPLOYER_PRIVATE_KEY` | `contracts/.env` on the machine that deploys | **Never on the web server.** The app has no use for it; the contract has no owner to act for. |

Beyond secrets: set `CONFIRMATIONS_4663` to 2 or 3, point `RPC_URL_4663` at a provider you trust, set `NEXT_PUBLIC_CHAINS=4663` so the local hardhat deployment is never offered, and back up the database (the indexer rebuilds `Payment`, not `Invoice`). Call `POST /api/indexer` from the same host so the secret never leaves the machine.

```bash
curl -s -X POST -H "x-indexer-secret: $INDEXER_SECRET" http://127.0.0.1:3000/api/indexer
```

## Responsible disclosure

Email **support@payrail.app** with the affected route, contract function or file, steps to reproduce and, if funds were involved, a transaction hash on Robinhood Chain. Do not test against merchants you do not control. Fixes that change behaviour are recorded in the [changelog](/docs/changelog); new limits are added to [Risks and limits](/docs/risks-and-limits).
