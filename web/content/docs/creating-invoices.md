---
title: Creating invoices
description: Registering as a merchant, writing an invoice, and getting a payment link.
order: 2
---

# Creating invoices

Two things must exist before an invoice can be paid: a **merchant** with a wallet address, and an **invoice** with a USDC amount. Both are created from the dashboard, or through the API if you want to wire Payrail into your own system.

## 1. Register as a merchant

Open the [dashboard](/app), connect a wallet, and enter your business name. That is all. The connected wallet becomes the **receiving address** for every invoice this merchant issues, and `walletAddress` is unique: one wallet, one merchant.

The name is display only. The contract uses the address, so check it twice before your first invoice: USDC sent to the wrong address cannot be pulled back.

## 2. Write the invoice

From **New invoice**, fill in:

| Field | Required | Notes |
| --- | --- | --- |
| Network | yes | Arc or Robinhood Chain. The buyer pays USDC on this chain; it cannot be changed after the link is created. Preselects the network your wallet is on. |
| Description | yes | Up to 500 characters. Shown on the payment link. |
| Amount (USDC) | yes | Positive number, up to 6 decimals. Stored in smallest units (`250.00` becomes `250000000`). |
| Customer name | no | For you only; never sent to chain. |
| Due date | no | Informational. There is no automatic expiry yet. |

The onchain key below does not include the network. The same terms hash to the same key on Arc and on Robinhood Chain, so the invoice's stored `chainId` is what pins the payment: a matching event seen on the other chain is rejected.

On save, the backend creates the invoice record and derives two values:

```
salt      = keccak256(invoice.id)
onchainId = keccak256(abi.encode(salt, merchant.walletAddress, amountUnits))
```

`invoice.id` is a random cuid, so `salt` is unguessable and unique. The buyer passes `salt`, the merchant address and the exact amount to `pay()`; the contract recomputes the same `onchainId` from those three terms. Because the key binds the merchant and the amount, a payment with different terms lands on a different key and can never be confused with, or block, this invoice.

## 3. Share the payment link

The response from `POST /api/invoices` includes `paymentLink`:

```
https://<your-app>/pay/<invoice.id>
```

Send it however you like: email, chat, QR. The link is public to anyone holding it, and can be paid **exactly once**, for **exactly** the listed amount. Paying the same terms twice is rejected by the contract (`InvoiceAlreadyPaid`); paying a different amount is a different key and does not close this invoice.

## Through the API

```bash
curl -X POST https://<your-app>/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "clx...",
    "description": "Logo design, milestone 2",
    "customerName": "Alex",
    "amount": "85.00"
  }'
```

A `201` response contains the full invoice plus `paymentLink`. See [API](/docs/api) for every endpoint.

## Cancelling

`DELETE /api/invoices/:id` marks an invoice **CANCELLED** as long as it is not PAID. The link stops accepting payment in the UI. Note that the contract knows nothing about cancellation: if someone calls `pay()` directly with the ID of a cancelled invoice, the USDC still reaches the merchant and the indexer will record it. See [Risks and limits](/docs/risks-and-limits).

Next: [Payment flow](/docs/payment-flow).
