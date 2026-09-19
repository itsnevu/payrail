---
title: What Payrail is
description: A USDC invoice that closes itself, and what that gets you.
order: 1
---

# What Payrail is

Payrail turns "I sent it, please check" into a status that changes on its own. You create an invoice; the buyer pays from their wallet; that payment is matched to the right invoice from an **onchain event**, not from a screenshot and not from a claim in a chat.

A Payrail invoice is not a bill waiting for someone to scan a bank statement. It carries a **unique key that travels inside the payment transaction**, derived from a random salt, the merchant address and the exact amount, so the transaction itself says which invoice it is paying and for how much. That one property is what makes reconciliation honest: there is no guessing whose 250 USDC arrived at 14:02, because every payment names itself.

## The flow in one sentence

Merchant creates a USDC invoice, the system generates a payment link, the buyer pays from a wallet, the backend verifies the transaction onchain, the invoice flips to **PAID**, and the merchant sees the history and exports CSV.

## Three roles

| Role | Does | Holds |
| --- | --- | --- |
| **Merchant** | Registers with a wallet, creates invoices, shares links | The receiving wallet; the dashboard |
| **Buyer** | Opens the link, approves USDC, calls `pay()` | Their own wallet; no account needed |
| **PaymentProcessor** | Derives the key from the terms, forwards USDC to the merchant, rejects already-paid keys, emits the event | Nothing. The contract never holds funds |

## What you get

- **One status instead of one spreadsheet column.** PENDING becomes PAID when, and only when, a matching payment is visible on chain.
- **Funds go straight to your wallet.** `pay()` calls `transferFrom(buyer, merchant)` inside the same transaction. No balance in the contract, no balance at Payrail, no "withdrawal" step.
- **Proof anyone can verify.** Every PAID invoice has a `txHash`, block, payer and amount. Open it in an explorer; you do not have to trust us.
- **History you can export.** CSV per merchant, from the same data the dashboard reads.
- **A safety net.** If a buyer pays directly from a script or wallet without touching our UI, the indexer catches the event and the invoice still closes. See [Verification and the indexer](/docs/verification-and-indexer).

## What it is not

It is not a payment gateway and not a custodian: we never hold your USDC and cannot reverse a transaction. It is not a full invoicing suite; there are no taxes, discounts or partial payments yet. It is not audited. It runs on two chains, Arc and Robinhood Chain, and every invoice is pinned to one of them when it is created. See [Risks and limits](/docs/risks-and-limits).

Next: [Creating invoices](/docs/creating-invoices).
