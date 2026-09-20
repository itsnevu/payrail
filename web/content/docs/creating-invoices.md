---
title: Creating invoices
description: Every field on the new invoice form, how the amount and payment key are derived, sharing the link, the status lifecycle, cancelling, and export.
order: 4
section: Using Payrail
---

# Creating invoices

Two things must exist before an invoice can be paid: a **merchant** with a wallet address, and an **invoice** with an amount. Both are created from the dashboard, or through the API if you want to wire Payrail into your own system.

> **Note:** The app labels amounts USDG. On Robinhood Chain the token that moves is USDG (Global Dollar, 6 decimals, `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`). USDG on this page means that token.

## Register as a merchant

Open the [dashboard](/app), connect a wallet, and enter your business name. That is all. The connected wallet becomes the **receiving address** for every invoice this merchant issues, and `walletAddress` is unique: one wallet, one merchant. Registering the same wallet again only updates the name.

The name is display only. The contract uses the address, so check it twice before your first invoice: USDG sent to the wrong address cannot be pulled back. See [Wallet setup](/docs/wallet-setup).

A merchant's wallet cannot be changed afterwards. `POST /api/merchants` keys on the wallet, so connecting a new wallet and registering creates a second merchant with its own invoices; it does not move anything from the first. If you lose access to a wallet, cancel its PENDING invoices and reissue them from the new merchant, because every one of them still pays the old address.

## The form

Open [New invoice](/invoices/new).

| Field | Required | API key | Rules |
| --- | --- | --- | --- |
| Merchant | yes | `merchantId` | Preselected for the connected wallet, or for the only registered merchant. A selector appears only when more than one merchant is registered. |
| Network | yes | `chainId` | Shown only when the deployment enables more than one network. Production enables Robinhood Chain (4663) only, so it is hidden. |
| Description | yes | `description` | 1 to 500 characters. Shown to the buyer. |
| Customer name | no | `customerName` | Up to 200 characters. Not shown on the payment page. |
| Amount (USDG) | yes | `amount` | Positive, up to 6 decimals. Quick chips for 50, 100, 250, 500 and 1,000. |
| Due date | no | `dueAt` | The form offers today or later; the API accepts any ISO 8601 timestamp. See Due date below and the lifecycle table. |

A **Buyer sees** panel previews the payment page as you type. `Create invoice & payment link` posts to `POST /api/invoices` and opens the invoice page.

### Amount rules

The amount is a decimal string matching `^\d+(\.\d{1,6})?$`: digits, an optional point, at most six decimals. It is converted with `parseUnits(amount, 6)` and stored as a string of **smallest units**: `250.00` becomes `250000000`, and `0.000001` (the minimum) becomes `1`. Zero is rejected with `amount must be > 0`. The stored value is the exact figure the buyer must send. The contract hashes the amount into the payment key, and `applyPaymentLog` compares the event amount with the stored amount on exact equality, so an overpayment or underpayment lands on a different key and does not settle this invoice.

There is no Payrail fee. The merchant receives exactly `amount`; the buyer pays gas in ETH.

### Due date

The form sends the chosen day as midnight UTC at the start of that day (`2026-10-01` becomes `2026-10-01T00:00:00.000Z`), and an invoice is overdue as soon as `dueAt` is in the past. Two consequences. A due date of today is already past for most of the day, so the invoice reads EXPIRED the first time its page loads; pick tomorrow or later. And "due 1 October" means the link stops working at the start of 1 October UTC, not at the end of it. Through the API you can send any timestamp, so `2026-10-01T23:59:59Z` gives the buyer the whole day.

There is no reminder or notification when a due date passes, and no due date at all means the link stays open until it is paid or cancelled.

### Network

Every invoice carries a `chainId`. It defaults to the deployment's default chain and is rejected with `400` if that chain is not enabled. The key derived below does not include the network, so `Invoice.chainId` is what pins the payment to Robinhood Chain: `applyPaymentLog` rejects a matching event from any other enabled chain. The network cannot be changed after the link is created.

## What happens on save

The backend creates the record, then derives two values from it:

```
salt      = keccak256(invoice.id)
onchainId = keccak256(abi.encode(salt, merchant.walletAddress, amountUnits))
```

`invoice.id` is a random cuid, so `salt` is unguessable and unique. `onchainId` is stored lowercase in a unique column and shown on the invoice page as **Payment key (onchain)**. The buyer's wallet calls `pay(salt, merchant, amount)` and the contract recomputes the same key with `invoiceKey`. Because the key binds the merchant and the amount, a payment with different terms can never be confused with, or block, this invoice. Paying the same terms twice is rejected with `InvoiceAlreadyPaid`.

The `201` response is the invoice with its `merchant`, its `payment` (null until paid) and `paymentLink`:

```
https://payrail.tech/pay/<invoice.id>
```

## Sharing the link

While the invoice is PENDING, its page shows:

- a **QR code** of the payment link, for a customer standing in front of you;
- the link in a read-only field, with **Open** to view it;
- **Share**, which opens the phone's share sheet where the Web Share API exists; everywhere else the same button reads **Copy** and copies the link to the clipboard;
- **Send reminder**, the same button with the text `Friendly reminder, this invoice is still open: <description>, <amount> USDG` and the due date if set.

The link is public to anyone holding it. It shows the merchant name, description, amount, network, merchant wallet and contract address, and can be paid **exactly once** for **exactly** the listed amount, by any wallet. Do not put secrets in the description. Anyone with the id can also read the record through `GET /api/invoices/:id`, customer name included.

Send the link, not your wallet address. A plain transfer to your address, from a wallet or an exchange withdrawal, does not call `pay()`, emits no `PaymentReceived`, and never closes an invoice: the tokens arrive, the invoice stays PENDING, and you are matching by hand again. Only a payment made through the link names its invoice.

The invoice page polls every 5 seconds and flips to paid on its own, with payer, block and a Blockscout link. See [Payment flow](/docs/payment-flow) for the buyer's side.

## Status lifecycle

`status` is a plain string with four values.

| Status | Set by | Can the link be paid? |
| --- | --- | --- |
| PENDING | Creation. | Yes. |
| PAID | `applyPaymentLog`, from a `PaymentReceived` event seen by the verify route or the indexer. Final. | The contract rejects a second payment on the same key. |
| CANCELLED | `DELETE /api/invoices/:id`. Database only. | The page refuses. The contract does not know. |
| EXPIRED | The read paths (`GET /api/invoices`, `GET /api/invoices/:id`, `GET /api/stats`) flip PENDING invoices whose `dueAt` is in the past. No scheduler. | The page refuses. The contract does not know. |

Only PENDING to PAID and PENDING to CANCELLED are intended. Two more happen in practice. `DELETE` overwrites EXPIRED with CANCELLED without a guard. And `applyPaymentLog` checks neither `status` nor `dueAt`, so a CANCELLED or EXPIRED invoice whose `pay()` arguments are still out there becomes PAID the moment someone sends them.

## Cancelling

**Cancel invoice** on the invoice page asks for confirmation and calls `DELETE /api/invoices/:id`. A PAID invoice returns `409 invoice already paid`; anything else becomes CANCELLED and the payment page stops offering Pay.

> **Warning:** Cancel is a database flag. A payer who already holds the link, or the three `pay()` arguments, can still send the transaction. USDG reaches your wallet, the verify route or the indexer records the `PaymentReceived` event, and the invoice becomes PAID. Refunding is on you. See [Risks and limits](/docs/risks-and-limits).

There is no delete. `DELETE /api/invoices/:id` cancels; the row stays in the list, the export and the stats, and a CANCELLED invoice cannot be reopened. Create a new one instead.

## Editing

An invoice cannot be edited. The amount and merchant are baked into `onchainId`, and the record is what the buyer was sent. To change anything, cancel it and create a new one.

**Duplicate**, on every invoice page, opens the form prefilled with the merchant, network, description, customer name and amount (`/invoices/new?from=<id>`). The due date is not copied. This is the path for retainers and repeat customers.

## Through the API

Everything the form does is one request. No authentication exists yet, so anyone can create an invoice for any registered merchant; a paid one still sends USDG to that merchant's wallet, because the address comes from the database.

```bash
curl -X POST https://payrail.tech/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "clx...",
    "description": "Logo design, milestone 2",
    "customerName": "Alex",
    "amount": "85.00",
    "dueAt": "2026-10-01T00:00:00.000Z"
  }'
```

Validation errors are `400` in zod's `flatten()` shape (`{ error: { fieldErrors, formErrors } }`); an unknown merchant is `404`. For bulk creation, loop over the same call and keep the returned `id` and `paymentLink`. Listing and filtering by `status` or `chainId` are on the [API](/docs/api) page.

## Export and stats

**Export CSV** on the dashboard calls `GET /api/invoices/export?merchantId=<id>` and downloads `payrail-invoices-<timestamp>.csv`, one row per invoice, newest first, every value double-quoted. The 15 columns:

| Column | Contents |
| --- | --- |
| `invoice_id` | The cuid; the dashboard shows it as `INV-` plus its last four characters. |
| `created_at` | ISO 8601, UTC. |
| `network`, `chain_id` | Robinhood Chain, 4663. |
| `merchant`, `merchant_wallet` | Merchant name and receiving address. |
| `customer`, `description` | As entered. |
| `amount_usdc` | Formatted decimal with en-US thousands separators, at least two decimals (`1,000.00`). Strip the comma before parsing. |
| `status` | PENDING, PAID, CANCELLED or EXPIRED. |
| `paid_at`, `payer`, `tx_hash`, `tx_url`, `block_number` | Empty until paid; then the paying wallet, the transaction hash, its Blockscout link and the block. |

The dashboard header comes from `GET /api/stats?merchantId=<id>`: `total`, `paid` and `pending` counts, `totalReceived` (sum of `Payment` rows) and `totalOutstanding` (sum of PENDING invoices), both in smallest units. Reading stats also runs the expiry sweep described above.

Next: [Payment flow](/docs/payment-flow).
