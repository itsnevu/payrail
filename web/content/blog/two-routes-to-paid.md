---
title: "Two Routes to PAID, and Why We Do Not Trust the Browser"
description: "What just shipped: fast verification from a txHash, an indexer as the safety net, and one idempotent function both of them pass through."
date: 2026-09-15
---

# Two Routes to PAID, and Why We Do Not Trust the Browser

The first version of Payrail had one way to mark an invoice paid: after the buyer paid, the payment page sent the `txHash` to the server, the server checked it, done. That worked in the demo. It did not work when someone closed the tab two seconds too early.

This post is about what we changed, and the principle that made the change safe.

## The problem

The "browser sends the txHash" route has one obvious point of failure: the browser. Tabs get closed. Networks drop. A buyer pays from a script because they are a developer and do not want to open a UI. A buyer pays from a company multisig that knows nothing about our page. In every one of those cases the USDC reached the merchant, the event is on chain, and our database says PENDING.

The merchant sees PENDING, sends "hi, did you pay?", and we are back to the problem we set out to remove.

## The second route: the indexer

The fix is nothing new: **do not wait to be told, go and look.** The indexer scans `PaymentReceived` events from our contract, from the last processed block to the head, and applies every matching event to the database. It does not care how the transaction was made: UI, script, multisig, another contract. If the event exists, the invoice closes.

It runs from cron. It stores `lastBlock` so it never rescans from the start. It stops `CONFIRMATIONS` blocks short of the head so it never applies a block that might be reorged. Locally there is `scripts/indexer-loop.mjs`; in production, `POST /api/indexer` every 30 seconds with a secret header.

## Two routes, one function

What makes this safe is that both routes end in **the same function**: `applyPaymentLog(event, txHash, blockNumber)`. It:

1. finds the invoice where `onchainId == event.invoiceId`;
2. if the invoice already has a `payment`, stops, because it was already processed;
3. checks that `event.merchant` equals the invoice's merchant wallet;
4. checks that `event.amount >= invoice.amount`;
5. in one database transaction, creates the `Payment` and sets `PAID`.

Step 2 is the key. The browser route and the indexer **will** overlap: the buyer pays, the browser sends the `txHash`, and three seconds later the indexer finds the same event. Without step 2 that is two `Payment` records for one invoice. With step 2, whoever arrives second sees `payment` already exists and goes home. And if two processes run **truly** simultaneously, the `txHash @unique` constraint in the schema catches whatever slipped past the check.

Idempotency was not a feature we added for the indexer. It is what **made it possible** to add the indexer without rethinking the first route.

## Why we do not trust the browser

This is the part we think matters most, and is most often done wrong in similar systems.

When the browser sends `POST /api/invoices/:id/verify { txHash }`, we **do not** read the merchant or the amount from the request. We fetch the **receipt** for that transaction from the RPC, filter its logs to our contract address, find the `PaymentReceived` event with this invoice's `invoiceId`, and take the merchant and amount **from the event**. Then `applyPaymentLog` checks them against the database.

The `txHash` from the browser is only a pointer: "look over there." It cannot claim anything. A buyer who sends someone else's `txHash` fails the `invoiceId` check. A buyer who paid the wrong merchant fails the merchant check. A buyer who underpaid fails the amount check. A buyer who sends a fake `txHash` finds no receipt.

The only way to make an invoice PAID is to **actually pay it**. That is the one property we need, and we get it by trusting no byte from the client except as a lookup key.

## What else changed

- **Contract address filter.** Another contract could emit an event with the same `PaymentReceived` signature. We only read logs from the address we deployed.
- **`202` for "not yet".** If the tx is not mined or confirmations are short, the server answers `202` and the page retries, instead of a `400` that makes the buyer think something broke.
- **Configurable `CONFIRMATIONS`.** `1` for hardhat, `2` or `3` for real networks.

## What did not

The indexer does not check the `CANCELLED` status; an invoice that was cancelled but paid anyway becomes PAID. That is a debatable call (the money did reach the merchant) and we wrote it down on the [risks page](/docs/risks-and-limits) rather than pretend it is not there.

The full detail of both routes is in [Verification and the indexer](/docs/verification-and-indexer).
