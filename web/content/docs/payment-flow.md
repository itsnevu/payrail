---
title: Payment flow
description: What happens when a buyer opens the link. Approve, pay, and why funds never stop in between.
order: 3
---

# Payment flow

From the buyer's side, paying a Payrail invoice is opening one page and pressing one button. Behind it are two transactions and one verification. This page walks through all three.

## The `/pay/:id` page

The payment page shows the merchant name, the description and the amount, read from the database through `GET /api/invoices/:id`. The buyer connects a wallet; the page checks their USDC balance and the `allowance` already granted to `PaymentProcessor`.

If the invoice is already PAID or CANCELLED, the button does not appear. If the wallet is on the wrong chain, the page asks to switch first.

## Two transactions

**1. Approve.** USDC is an ERC-20; the contract cannot pull funds without permission. The buyer calls `USDC.approve(PaymentProcessor, amount)`. If the existing allowance already covers the amount, this step is skipped.

**2. Pay.** The buyer calls:

```solidity
PaymentProcessor.pay(bytes32 salt, address merchant, uint256 amount)
```

with `salt = keccak256(invoice.id)`, `merchant` set to the merchant walletAddress, and `amount` in smallest units, exactly as invoiced. Inside, the contract:

1. Rejects a zero merchant, the contract itself as merchant, a zero amount, and amounts above `uint96`.
2. Computes `invoiceId = keccak256(abi.encode(salt, merchant, amount))`.
3. Rejects if that `invoiceId` was ever paid before: `InvoiceAlreadyPaid`.
4. Records `{payer, amount, merchant, paidAt}` for that key.
5. Calls `usdc.safeTransferFrom(buyer, merchant, amount)`, **straight to the merchant**.
6. Emits `PaymentReceived(invoiceId, salt, merchant, payer, amount, timestamp)`.

The order matters. The "paid" state is written before the transfer and the function is `nonReentrant`, so there is no window to pay the same invoice twice in one block. And because the transfer is `transferFrom(buyer, merchant)` rather than `transferFrom(buyer, contract)` followed by `transfer(contract, merchant)`, **the contract's balance is always zero**. Nothing can be "withdrawn" from Payrail because nothing was ever there.

## Verification

Once `pay()` is confirmed, the page posts its `txHash` to:

```
POST /api/invoices/:id/verify   { "txHash": "0x..." }
```

The backend fetches the receipt, checks that its status is `success`, waits for the configured number of confirmations (`CONFIRMATIONS`), then looks for a `PaymentReceived` event **emitted by our contract address** whose `invoiceId` matches this invoice. If confirmations are still short, the response is `202` and the page retries. On a match, the invoice becomes PAID and the page shows an explorer link.

Worth noting: the `txHash` from the browser is only **a pointer to where to look**. The merchant and amount used to decide PAID are read from the event, not from the request body. A buyer cannot "claim" to have paid; they can only point at a transaction that really happened. Details in [Verification and the indexer](/docs/verification-and-indexer).

## When the buyer pays outside the UI

Anyone who knows the `salt`, the merchant address and the exact amount can call `pay()` directly: from a script, another wallet, another contract. The `/pay/:id` page will not know, but the **indexer** will: it scans `PaymentReceived` events from the last processed block to the head and applies the ones that match. The invoice still closes, just a little later.

## What the buyer pays

Two transactions means gas twice (once if the allowance already exists). There is no Payrail fee. The amount that reaches the merchant is exactly `amount`; the contract deducts nothing.

Next: [Verification and the indexer](/docs/verification-and-indexer).
