---
title: Payment flow
description: Who does what from the moment a buyer opens the link until the invoice reads PAID, and what happens when something interrupts it.
order: 5
section: Using Payrail
---

# Payment flow

From the buyer's side, paying a Payrail invoice is opening one page and pressing one button. Behind it are two transactions, one event and a verification that can arrive by two routes. This page walks through it in order.

> **Note:** The app labels amounts USDC. On Robinhood Chain the token moved is USDG (Global Dollar, 6 decimals) at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. That is the token the wallet prompts for.

## Who is involved

| Party | Role in the flow |
| --- | --- |
| **Merchant** | Creates the invoice, sends the link, watches the dashboard. |
| **Buyer** | Opens `/pay/:id`, connects a wallet, confirms two prompts. |
| **Wallet** | Signs `approve` and `pay`. Injected (browser extension) wallets always; WalletConnect only when configured. |
| **Contract** | `PaymentProcessor` at `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D`. Checks, records, forwards, emits. Holds nothing. |
| **Backend** | `POST /api/invoices/:id/verify`. Reads the receipt and marks PAID. |
| **Indexer** | `POST /api/indexer`. Scans `PaymentReceived` events for anything the browser never reported. |

## The sequence

1. **Merchant** creates an invoice at [/invoices/new](/invoices/new). The backend derives the payment key: `salt = keccak256(invoice.id)`, `onchainId = keccak256(abi.encode(salt, merchant, amount))`. The merchant shares the link, `https://payrail.tech/pay/<id>`.
2. **Buyer** opens the link. The page calls `GET /api/invoices/:id` and shows `Payment to <merchant name>`, description, amount, due date (when one was set), network, merchant wallet and contract address.
3. **Buyer** connects a wallet. On another network the page offers `Switch to Robinhood Chain`; the wallet prompts to add the chain if it does not know it.
4. **Page** reads three things on chain: `balanceOf(buyer)`, `allowance(buyer, PaymentProcessor)` and `isPaid(onchainId)`. The balance decides between `Pay <amount> USDC` and `Insufficient balance`. The allowance decides whether the approve row is shown. `isPaid` is a second opinion next to the database.
5. **Buyer** presses Pay. If the allowance is short, **wallet** prompt one: `USDC.approve(PaymentProcessor, amount)`. The page shows `1/2 Approving USDC… (confirm in wallet)` and re-reads the allowance up to ten times, 1.5 seconds apart, until it covers the amount.
6. **Wallet** prompt two: `PaymentProcessor.pay(salt, merchant, amount)`. The page shows `2/2 Paying… (confirm in wallet)`. All three arguments come from the invoice record, never from anything the buyer typed.
7. **Contract** runs `pay`: rejects a bad merchant or amount; derives `invoiceId`; reverts with `InvoiceAlreadyPaid` if that key was ever paid; records `{payer, amount, merchant, paidAt}`; calls `usdc.safeTransferFrom(buyer, merchant, amount)`; emits `PaymentReceived`. The tokens go from the buyer's wallet to the merchant's wallet inside that one call.
8. **Page** waits for the receipt, shows `Verifying onchain…`, then posts the `txHash` to `POST /api/invoices/:id/verify`. It retries up to 20 times, three seconds apart, while the backend answers `202`.
9. **Backend** fetches the receipt, checks it succeeded, waits for the configured confirmations, keeps only logs emitted by the PaymentProcessor address, finds the `PaymentReceived` whose `invoiceId` equals the invoice's `onchainId`, and hands it to `applyPaymentLog`.
10. **`applyPaymentLog`** creates the `Payment` row and sets `status = PAID` in one database transaction. The page shows `Invoice paid` with a Blockscout link. The dashboard, polling every 8 seconds while anything is PENDING, shows it on the next poll. If Web Push is configured and the merchant opted in, an `Invoice paid` notification goes out.
11. **Indexer**, whenever it is called, scans from its last cursor to `head - confirmations + 1` and applies every `PaymentReceived` it finds. If step 8 never happened, the invoice still closes here.

## As a diagram

```text
merchant      buyer / page          wallet        contract         backend       indexer
   |  create invoice, share link       |              |                |              |
   |--------------->|                  |              |                |              |
   |                | GET /api/invoices/:id ---------------------------->|              |
   |                | balanceOf, allowance, isPaid --->|                |              |
   |                | approve(PP, amount) --> tx 1     |                |              |
   |                | pay(salt, merchant, amount) --> tx 2              |              |
   |                |                  |  safeTransferFrom(buyer, merchant)            |
   |                |                  |  emit PaymentReceived           |              |
   |                | POST /verify {txHash} --------------------------->|              |
   |                |                  |              | receipt, confirmations, event  |
   |                |                  |              | applyPaymentLog -> PAID        |
   |                | <-- 200 -----------------------------------------|              |
   |                |                  |              |  getContractEvents <-----------|
   | dashboard PAID |                  |              |  applyPaymentLog (no-op if done)
```

## Why two transactions

The billing token is an ERC-20 (USDG on Robinhood Chain, labelled USDC in the app). A contract cannot take tokens out of a wallet without an allowance, so the first transaction is `approve` and the second is `pay`. The contract spends the allowance once, in `safeTransferFrom(buyer, merchant, amount)`, moving the tokens from the buyer to the merchant in the same call. Nothing lands in the contract; there is no withdrawal step and no balance to steal.

The allowance check in step 4 lets the page skip the first prompt. `approve` is called with exactly `amount`, so a normal payment consumes the whole allowance and the next invoice needs a new one. Only a buyer who granted a larger allowance elsewhere sees one prompt. Count on two.

Gas is paid in ETH on Robinhood Chain for each transaction, so the buyer needs a little ETH as well as the stablecoin. There is no Payrail fee; the contract deducts nothing, and the merchant receives exactly `amount`.

## Timing and confirmations

Once `pay` is mined, the backend still waits for `CONFIRMATIONS_4663` blocks (2 in the shipped `.env.example`) before it calls anything PAID. Until then `/verify` answers `202` with `waiting for confirmations` and the page keeps asking. After 20 tries, about a minute, it gives up with `timed out waiting for confirmations, try refreshing`. The transaction is not lost: refreshing runs the same check, and the indexer applies it either way.

The confirmation depth is the only protection against a reorg. There is no mechanism to revert PAID once it is set. See [Risks and limits](/docs/risks-and-limits).

## Two routes to PAID

**The fast route** is the browser handing over a `txHash`. The hash is only a pointer. The backend reads the receipt, not the request body, and takes the merchant and amount from the event. A buyer cannot claim to have paid, only point at a transaction that happened.

**The certain route** is the indexer. It does not wait to be told; it scans `PaymentReceived` events in 2,000-block chunks up to the safe head and applies every one that matches an invoice: closed tabs, dropped connections, a `pay` sent from a script or a multisig, a verification that timed out.

Both routes end in `applyPaymentLog`. It looks up the invoice by `onchainId`; returns `ok` without writing if a `Payment` already exists; refuses a mismatched chain, merchant or amount (exact equality, not "at least"); otherwise writes the `Payment` row and flips the status in one transaction. `txHash @unique` and `invoiceId @unique` mean that when the two routes race, whoever arrives second hits the constraint and nothing is written twice.

## What can interrupt the flow

| Interruption | What happens |
| --- | --- |
| Buyer rejects the approve prompt | Nothing was sent. The page shows the first line of the wallet's error and the button returns to `Pay <amount> USDC`. |
| Buyer approves, then rejects `pay` | The allowance sits unused. Pressing Pay again goes straight to prompt two. |
| Balance below the amount | The button reads `Insufficient balance` and is disabled. Top up and reload. |
| Wallet on the wrong network | `Switch to Robinhood Chain`. The chain definition lists the relay `/api/rpc/4663` first, so filtered connections still work. |
| `pay` reverts | Nothing moved. `InvoiceAlreadyPaid` means the key was paid before. `InvalidAmount` and `InvalidMerchant` should not come from the page, because the arguments come from the invoice record, which was created with a positive amount and a registered merchant wallet. |
| Tab closed after `pay` was sent | The tokens are already with the merchant. The indexer marks PAID on its next run. Reopening the link shows `Invoice paid` even before the database catches up, because the page also reads `isPaid`. |
| Invoice CANCELLED or EXPIRED before payment | The page hides the button. The contract does not know. A buyer who already holds the arguments can still call `pay`; the tokens reach the merchant and `applyPaymentLog` marks it PAID. |
| Paid by hand with the wrong terms | Lands on a different key. The real invoice stays PENDING and payable. The tokens went where the caller pointed them. |
| Paid on the testnet or a local chain | Same key, other deployment. `/verify` looks the hash up on the invoice's own chain, so it is never found there, and `applyPaymentLog` refuses an event whose chain differs from `Invoice.chainId`. The invoice stays PENDING. |

> **Warning:** Nothing in this flow can be reversed. Not by the contract, not by us. A wrong merchant, a cancelled invoice paid anyway, a payment on the wrong network: each is settled by hand between merchant and buyer.

Next: [Paying an invoice](/docs/paying-an-invoice) for the buyer's view screen by screen, and [Verification and the indexer](/docs/verification-and-indexer) for the backend.
