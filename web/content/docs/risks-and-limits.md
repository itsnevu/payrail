---
title: Risks and limits
description: What can go wrong, what you are trusting, and what has not been built yet.
order: 7
---

# Risks and limits

This page spells out what the other pages only mention in passing. If you are going to bill real money through Payrail, read this first.

## What you are trusting

**The contract.** About 90 lines on top of OpenZeppelin, eleven tests plus a live end-to-end check, internally reviewed twice, **not independently audited**. The attack surface is small (no balance, no owner, no upgrade) but small is not zero.

**Our backend.** The PAID status is decided by a server reading the chain over RPC. If our server is misconfigured (an old contract address, an RPC that lies), the status can be wrong. The good news: the truth lives on chain, not in our database. `getPayment(invoiceId)` is readable by anyone without us.

**The RPC provider.** Both the buyer's browser and the backend talk to an RPC. A malicious RPC can hide a transaction (the invoice looks unpaid) but cannot fabricate one that is not on chain.

**USDC.** Circle can freeze addresses. If the merchant wallet is frozen, `transferFrom` reverts and nobody can pay that merchant's invoices.

## What can go wrong

**Wrong merchant address.** Merchants register with the connected wallet, so a typo is nearly impossible. But if you register from a wallet you do not control (an exchange wallet, a friend's wallet), the USDC goes there. Nothing can reverse it.

**Invoice ID griefing (fixed in v2).** In v1 the contract keyed only on `invoiceId` and took `merchant` and `amount` from the caller, so anyone who saw a payment link could pay one unit to themselves and lock the real invoice forever. v2 derives the key as `keccak256(abi.encode(salt, merchant, amount))`: wrong terms land on a different key and cannot touch the real invoice. Covered by a regression test in `contracts/test` and by `web/scripts/e2e-local.mjs`, which performs the attack against a live stack and confirms the real buyer can still pay.

**Manual payment with wrong arguments.** Someone calling `pay()` by hand with the right `salt` but a wrong `merchant` or `amount` moves USDC wherever they pointed it and records a payment under a *different* key. The real invoice is untouched and still payable. The mistaken payer has sent money to the wrong place; nothing can reverse that.

**Cancelled but paid anyway.** `DELETE` only changes the database. The contract does not know. A payer who already holds the `pay()` arguments can still send them; USDC reaches the merchant, the indexer applies the event, and since `applyPaymentLog` does not check for `CANCELLED`, the invoice becomes PAID. The merchant receives money they may have to refund by hand.

**Reorgs.** With `CONFIRMATIONS=1`, the block holding the payment can be reorged after we marked PAID. It does not happen on hardhat; on a real network use `2` or `3`.

**Anyone can create invoices for any merchant.** There is no authentication on the API. An attacker can flood your dashboard with fake invoices (no financial harm; an unpaid fake invoice is just a row), or create an invoice in your name and send the link to your client. If paid, it still sends USDC to **your wallet**, because the merchant address comes from the database, not from whoever created the invoice. Annoying, not theft.

**Payment links are public.** Anyone holding the URL sees the description, amount and merchant name. Do not put secrets in the description.

## What has not been built

- **Merchant authentication** (SIWE). Required before production.
- **Automatic expiry.** `dueAt` and the `EXPIRED` status exist in the schema; nothing sets them.
- **Partial payments or instalments.** One invoice, one `pay()`, full amount or more.
- **Webhooks and notifications.** Today you see PAID by opening the dashboard.
- **Escrow.** Funds go straight to the merchant. If you need a hold until goods arrive, that is a different product.
- **Multi-token and multi-chain.** One deployment, one token, one chain.
- **An independent audit.**

## What will not change

Funds will never stop at the contract or at us. That is not a feature waiting to be switched on; it is the shape of the contract. If Payrail ever offers escrow, it will be a different contract with a different risks page.
