---
title: Risks and limits
description: What can go wrong, what you are trusting, what has not been built yet, and the one thing that will not change.
order: 15
section: Help
---

# Risks and limits

This page spells out what the other pages only mention in passing. If you are going to bill real money through Payrail, read this first.

> **Note:** The app labels every amount USDG. On Robinhood Chain the token actually moved is USDG (Global Dollar, 6 decimals) at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. "The token" below means that contract.

## What you are trusting

### The contract

About 90 lines on top of OpenZeppelin, eleven tests plus a live end-to-end check, two internal review passes, **not independently audited**. The attack surface is small (no balance, no owner, no upgrade, no parameter) but small is not zero. The deployed instance on Robinhood Chain is `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D`. Blockscout source verification is still pending, so today you compare bytecode or you trust us. See [Contracts](/docs/contracts).

### Our backend

PAID is decided by a server reading the chain over RPC. If our server is misconfigured (an old contract address, an RPC that lies), the status can be wrong. The good news: the truth lives on chain, not in our database. `isPaid(invoiceId)` and `getPayment(invoiceId)` are readable by anyone without us, and the pay page checks `isPaid` next to the database. If `Payment` rows are lost but `Invoice` rows survive, the indexer recreates them from `PaymentReceived` events, although a fresh cursor starts only 5,000 blocks behind the head. `Invoice` rows need backups: `applyPaymentLog` drops an event that matches no invoice (`no invoice found for this onchainId`), so a lost database is not rebuilt from the chain.

### The RPC provider

Both the buyer's browser and the backend talk to an RPC. A malicious RPC can hide a transaction (the invoice looks PENDING for longer) but cannot fabricate one, because PAID needs a `PaymentReceived` log parsed from a real receipt. The server's RPC is set per chain (`RPC_URL_4663`) and can point at a second provider if the public one misbehaves.

### The token issuer

Stablecoin issuers can freeze addresses. If the merchant wallet is frozen, `safeTransferFrom` reverts and nobody can pay that merchant's invoices. Out of our control.

### Browser extension wallets

Payrail talks to whatever wallet the browser injects through `window.ethereum`, plus WalletConnect only when the deployment has a project id. A counterfeit or compromised extension can sign anything it likes. The pay page only ever proposes `approve` and `pay`, and the wallet prompt is the last screen that shows what you are signing. If the contract in the prompt is not `0xD591…C66D`, stop.

## What can go wrong

### Wrong merchant address

Merchants register with the connected wallet, so a typo is nearly impossible. But if you register from a wallet you do not control (an exchange deposit address, a friend's wallet), the tokens go there. Nothing can reverse it, and the wallet on a merchant cannot be changed afterwards: registering from another wallet creates a second merchant, and every PENDING invoice of the first still pays the first address.

### Plain transfers are not payments

A buyer who sends the tokens straight to your address, from a wallet's send screen or as an exchange withdrawal, has not paid the invoice in Payrail's sense. No `pay()` call, no `PaymentReceived`, nothing for either route to match. The tokens are in your wallet and the invoice stays PENDING until you cancel it by hand. The same is true of a `pay()` call with a different amount: it lands on a different key. Send the link, not your address.

### Invoice ID griefing (fixed in v2)

In v1 the contract keyed only on `invoiceId` and took `merchant` and `amount` from the caller, so anyone who saw a payment link could pay one unit to themselves and lock the real invoice forever. v2 derives the key as `keccak256(abi.encode(salt, merchant, amount))`: wrong terms land on a different key and cannot touch the real invoice. Covered by two regression tests in `contracts/test` and by `web/scripts/e2e-local.mjs`, which replays the attack against a live stack and confirms the real buyer can still pay.

### Manual payment with wrong arguments

Someone calling `pay(salt, merchant, amount)` by hand with the right `salt` but a wrong `merchant` or `amount` moves tokens wherever they pointed them and records a payment under a *different* key. The real invoice is untouched and still payable. The mistaken payer has sent money to the wrong place; nothing can reverse that. An underpayment or overpayment is the same case: `applyPaymentLog` requires `log.amount` to equal `invoice.amount` exactly, so the invoice stays PENDING and the merchant settles by hand.

### Cancelled but paid anyway

`DELETE /api/invoices/:id` only changes the database. The contract does not know. A payer who already holds the `pay()` arguments can still send them; tokens reach the merchant, the indexer applies the event, and since `applyPaymentLog` does not check for CANCELLED, the invoice becomes PAID. The merchant receives money they may have to refund by hand. Tell the buyer when you cancel; the pay page hides the button, a script ignores it.

### Expired but paid anyway

Overdue PENDING invoices are marked EXPIRED when the list, detail or stats endpoints read them (`expireOverdueInvoices`). There is no scheduler and the contract does not know about it. The pay page refuses an EXPIRED invoice client-side only, so the cancel case applies: right terms on chain, PAID in the database. `DELETE` also overwrites EXPIRED with CANCELLED without a guard.

### Reorgs

With `CONFIRMATIONS=1`, the block holding the payment can be reorged after we marked PAID. The shipped `.env.example` sets `CONFIRMATIONS_4663=2` for Robinhood Chain; raise it if you want more margin. There is **no mechanism to revert PAID** once the threshold has passed.

### Anyone can create invoices for any merchant

There is no authentication on the API. An attacker can flood your dashboard with fake invoices (no financial harm; an unpaid fake invoice is just a row), or create an invoice in your name and send the link to your client. If paid, it still sends tokens to **your wallet**, because the merchant address comes from the database, not from whoever created the invoice. Annoying, not theft. Merchant authentication is the fix; it is not built yet.

### Payment links are public

Anyone holding `/pay/<id>` sees the merchant name, description, amount, merchant wallet, contract and, once paid, the transaction hash. The same id opens `GET /api/invoices/<id>`, which has no authentication and also returns the customer name and, once paid, the payer address. The id is a random cuid and hard to guess, but it is not a secret once shared, and the explorer shows the payment to everyone anyway. Do not put secrets in the description or the customer name.

### Phishing copies of the pay page

Anyone can copy the pay page and swap in their own merchant address. The real page is only served from `https://payrail.tech`, and the wallet prompt shows the contract and the arguments before you sign. A copy that points at the real contract with a different `merchant` lands on a different key: the real invoice stays PENDING and the buyer has paid a stranger. Send links from a channel your customer already recognises, and tell buyers to check the domain.

### RPC relay abuse

`POST /api/rpc/4663` is a public endpoint that forwards an allow-list of read and broadcast methods so the pay page works where the public RPC is filtered. Limits: 256 KB body, 50-item batches, 25 second upstream timeout, and per IP `RPC_RELAY_RATE` 20 requests a second bursting to `RPC_RELAY_BURST` 60, then `429`. A flood from a shared IP slows the pay page for everyone behind it. The relay is a transport, not a trust boundary: nothing sent through it can make the server mark PAID.

### Operator misconfiguration

Mostly a self-hosting concern. A wrong `NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_4663` makes the address filter drop every log, so nothing turns PAID. An unset `INDEXER_SECRET` makes the indexer answer `401`, and the safety net is off. An empty `NEXT_PUBLIC_CHAINS` enables every chain in `deployments.json`, which ships with a local 31337 entry beside 4663, so the network selector appears and an invoice can be pinned to a chain nobody pays on. A value that names no known chain falls back to 31337 alone. Set it to `4663`. See [Self-hosting](/docs/self-hosting).

## What has not been built

- **Merchant authentication** (SIWE). Required before production.
- **Expiry the contract knows about.** `dueAt` flips an overdue invoice to EXPIRED when it is read; the contract will still accept the payment.
- **Partial payments or instalments.** One invoice, one `pay()`, the exact amount.
- **Webhooks.** Web Push `Invoice paid` exists when the deployment has VAPID keys; there is no HTTP callback.
- **Escrow, refunds, disputes.** Funds go straight to the merchant. If you need a hold until goods arrive, that is a different product.
- **Multi-token, multi-chain.** One dollar token, one chain: Robinhood Chain. A payment on the testnet or anywhere else does not count.
- **Reverting PAID.** No reorg handling after the confirmation threshold.
- **An independent audit.**

## What will not change

Funds will never stop at the contract or at us. That is not a feature waiting to be switched on; it is the shape of the contract. If Payrail ever offers escrow, it will be a different contract with a different risks page.

Next: [Security model](/docs/security) for who is assumed hostile and where the trust boundaries sit, and [Troubleshooting](/docs/troubleshooting) for the cases that do have a fix.
