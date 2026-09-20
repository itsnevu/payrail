---
title: What Payrail is
description: A USDC invoice that closes itself, what Payrail never does, and where the truth about a payment lives.
order: 1
section: Start here
---

# What Payrail is

Payrail turns "I sent it, please check" into a status that changes on its own. You create an invoice; the buyer pays from their wallet; that payment is matched to the right invoice from an **onchain event**, not from a screenshot and not from a claim in a chat.

A Payrail invoice is not a bill waiting for someone to scan a bank statement. It carries a **unique key that travels inside the payment transaction**, derived from a random salt, the merchant address and the exact amount, so the transaction itself says which invoice it is paying and for how much. That one property is what makes reconciliation honest: there is no guessing whose 250 USDC arrived at 14:02, because every payment names itself.

## The one sentence

Merchant creates a USDC invoice, the system generates a payment link, the buyer pays from a wallet, the backend verifies the transaction onchain, the invoice flips to **PAID**, and the merchant sees the history and exports CSV.

## What it is, and what it is not

Payrail is **reconciliation software, not a payment service provider**. The difference decides where your money goes.

| | Payment service provider | Payrail |
| --- | --- | --- |
| Where the buyer's money goes first | The provider's account | Your wallet, in the same transaction |
| Who decides an invoice is paid | The provider's ledger | A `PaymentReceived` event on Robinhood Chain |
| Can a payment be reversed | Usually | No. Not by the contract, not by us |
| Fee | A percentage | No Payrail fee. The buyer pays gas in ETH |
| Account needed to send a link | Usually, with KYC | No. Your wallet is the identity |

So Payrail is **not a custodian**: no holding account, no balance at the contract, no balance at Payrail, no withdrawal step. It cannot freeze, refund or dispute anything. It is not a full invoicing suite either; there are no taxes, discounts or partial payments yet. And it is **not audited**: two internal review passes, eleven tests and one attack replay, which is not the same thing.

One naming detail matters. The app labels every amount **USDC**. On Robinhood Chain the token actually moved is **USDG** (Global Dollar), 6 decimals, at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. Read USDC on screen as "the dollar token on Robinhood Chain".

## Who it is for

**Merchants who bill in dollars and get paid in a wallet.** Freelancers, small shops, anyone who has had to work out which of two identical transfers belongs to which client. If your reconciliation today is a spreadsheet next to a block explorer, this is for you.

**Buyers need nothing from us.** No account, no sign-up. They open a link, connect a wallet holding a little ETH for gas and enough of the dollar token, and pay. Anyone can pay any invoice. Developers get the same routes the app uses; see [API](/docs/api).

## Three roles

| Role | Does | Holds |
| --- | --- | --- |
| **Merchant** | Registers with a wallet, creates invoices, shares links | The receiving wallet; the dashboard |
| **Buyer** | Opens the link, approves the token, calls `pay()` | Their own wallet; no account needed |
| **PaymentProcessor** | Derives the key from the terms, forwards the token to the merchant, rejects already-paid keys, emits the event | Nothing, ever |

## One payment, end to end

1. **You create the invoice.** On [/invoices/new](/invoices/new): description, optional customer name, amount, optional due date. The server stores it as PENDING and derives the key: `salt = keccak256(invoice.id)`, then `onchainId = keccak256(abi.encode(salt, merchant, amount))`. You get a link, a QR code and share buttons.
2. **The buyer opens the link.** `/pay/<id>` shows your merchant name, the description and the amount, and asks the wallet to switch to Robinhood Chain if needed.
3. **The buyer approves and pays.** Two wallet prompts: `approve(PaymentProcessor, amount)` on the token, then `pay(salt, merchant, amount)` on the contract. One prompt if an earlier allowance already covers the amount. The arguments come from the invoice record, never from anything the buyer typed.
4. **The contract forwards and records.** `pay()` recomputes the key, reverts with `InvoiceAlreadyPaid` if that key was used before, writes the payment, moves the token from buyer to merchant with `safeTransferFrom`, and emits `PaymentReceived`. Nothing stays in the contract; `pay()` never makes it a recipient.
5. **The backend verifies from the chain.** The page posts the `txHash` to `/verify`. The server reads the receipt, waits for the configured confirmations, finds the `PaymentReceived` log whose `invoiceId` equals the invoice's key, checks merchant and exact amount, then writes PAID. If the tab was closed or the buyer paid from a script, the indexer finds the same event by scanning the chain. Both routes end in one idempotent function, `applyPaymentLog`.
6. **You see it.** The invoice shows PAID with payer, amount, block and a Blockscout link. The Activity list and the CSV export read the same rows. With **Notify me when paid** on, and push keys configured on the server, your phone gets "Invoice paid" too.

## What Payrail never does

- **Hold funds.** The only token movement in the contract is `safeTransferFrom(buyer, merchant, amount)`. No code path makes the contract a recipient.
- **Decide PAID from the browser.** The `txHash` the page sends is a pointer to a receipt. Merchant and amount come from the log. Someone else's hash fails the `invoiceId` check.
- **Take a fee.** You receive exactly `amount`. The buyer pays gas for `approve` and `pay`, a little ETH.
- **Change the contract.** No owner, no pause, no withdraw, no upgrade, no adjustable parameter.
- **Reverse anything.** No refunds, no disputes, no holds, and no mechanism to un-PAID an invoice after a reorg. The confirmation count is the only reorg defence.
- **Accept a near miss.** The event amount must equal the invoice amount exactly. An overpayment or underpayment lands on a different key: the token still reaches you, the invoice stays PENDING, you settle by hand.
- **Stop a chain payment after Cancel.** Cancel changes the database only. A payer who holds the `pay()` arguments can still send them, `applyPaymentLog` does not check status, and the invoice becomes PAID. Cancelled but paid anyway.

## Where the truth lives

Two stores, deliberately unequal.

| Fact | Lives in | Readable by |
| --- | --- | --- |
| Was this key paid, by whom, how much, when | The chain: `getPayment(key)`, the `PaymentReceived` event | Anyone, without us |
| Description, customer, due date, status | Our database: the `Invoice` row, plus a `Payment` row caching the event | The dashboard and the API |

**The chain is the source of truth; the database is a cache.** If the `Payment` rows were lost, the indexer can rebuild them by scanning `PaymentReceived` again, provided its cursor (`IndexerState.lastBlock`) is reset to a block before the first payment; with no cursor at all it only looks back 5,000 blocks. The `Invoice` rows cannot be rebuilt from the chain, because the contract stores no invoices, only keys. Back them up.

The contract knows one thing about a key: paid or not. PENDING, CANCELLED and EXPIRED exist only in the database. Overdue invoices are marked EXPIRED when read; there is no scheduler, and the contract does not know about it.

> **Note:** If our server is misconfigured or its RPC lies, the dashboard can be wrong. The payment itself cannot be: `getPayment(key)` on `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D` is readable by anyone at [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com).

## Where to go next

- [Getting started](/docs/getting-started): register a wallet, create the first invoice, get paid.
- [Wallet setup](/docs/wallet-setup): add Robinhood Chain, hold ETH for gas and the dollar token.
- [FAQ](/faq): the short answers, including the USDC and USDG naming.
- [Risks and limits](/docs/risks-and-limits): read before billing real money.
- [Whitepaper](/whitepaper): the design, the contract and the failure modes.
