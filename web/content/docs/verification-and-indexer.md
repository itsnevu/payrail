---
title: Verification and the indexer
description: Two routes to PAID, the matching rules, and why both are idempotent.
order: 4
---

# Verification and the indexer

An invoice becomes PAID through one function: `applyPaymentLog`. There are two ways an event reaches that function. The fast way is a `txHash` from the browser; the slow-but-certain way is the indexer. Both apply the same rules and are safe to run repeatedly.

## Matching rules

Given one `PaymentReceived(invoiceId, salt, merchant, payer, amount, timestamp)` event, the backend:

1. **Finds the invoice** where `onchainId == invoiceId`. None found: the event is ignored (maybe an invoice from another deployment, or someone calling `pay()` with a made-up ID).
2. **Already has a `payment`?** Done, return `ok`. This is what makes verification idempotent: the same transaction processed ten times still produces one record.
3. **Merchant must match.** `getAddress(event.merchant) == getAddress(invoice.merchant.walletAddress)`. Since v2 the key itself already binds the merchant, so a mismatch here can only mean a wrong deployment or ABI; the check stays as defense in depth.
4. **Amount must match exactly.** `event.amount == invoice.amount`. Same reasoning: the key binds the amount, so overpayment or underpayment is a different key and never reaches this invoice.
5. In one database transaction: create `Payment{txHash, payer, amount, blockNumber, paidAt}` and set `invoice.status = PAID`.

`txHash` is `@unique` in the schema. If two processes try to record the same transaction in parallel, the second fails on the constraint instead of producing a duplicate.

## Route 1: verify from `txHash`

```
POST /api/invoices/:id/verify   { "txHash": "0x..." }
```

| Step | On failure |
| --- | --- |
| Fetch the receipt | `"transaction not found or not mined yet"`, 202, retry |
| `receipt.status == success` | `"transaction reverted"`, 400 |
| `head - receipt.block + 1 >= CONFIRMATIONS` | `"waiting for confirmations"`, 202, retry |
| Filter logs to our `PaymentProcessor` address | |
| Find `PaymentReceived` with this invoice's `invoiceId` | `"no event for this invoice in tx"`, 400 |
| `applyPaymentLog` | reasons from the rules above |

The address filter matters: another contract could emit an event with the same signature. We only trust logs from the address we deployed.

## Route 2: the indexer

```
POST /api/indexer      header: x-indexer-secret
```

The indexer reads `IndexerState.lastBlock`, then scans `PaymentReceived` from `lastBlock + 1` to `head - CONFIRMATIONS + 1` in chunks of 2,000 blocks, applies each event through `applyPaymentLog`, and stores the last block. On its first run with no state, it starts 5,000 blocks behind the head.

The indexer catches:

- payments made without the UI (scripts, wallets, other contracts);
- payments where the UI failed to send the `txHash` (tab closed, network dropped);
- verifications that were pending because confirmations were short when the browser tried.

Run it from cron (Vercel Cron, GitHub Actions, or `scripts/indexer-loop.mjs` locally). Because `applyPaymentLog` is idempotent, overlapping with route 1 is harmless: whoever arrives first wins, whoever arrives second sees `payment` already exists and stops.

## Confirmations

`CONFIRMATIONS` (default `1`) applies to both routes. On local hardhat `1` is enough. On a test network or production, `2` or `3` reduces the risk that a short reorg drops a block we already treated as final. Higher means PAID arrives later; there is no single right value.

## What it does not do

Verification does not check `payer`. Anyone may pay anyone's invoice; that is a feature (a client can pay from a company wallet rather than the personal wallet that opened the link). It also does not check `dueAt`; a late payment is still PAID.

Next: [Contracts](/docs/contracts).
