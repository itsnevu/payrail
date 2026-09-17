---
title: API
description: Every endpoint, what it accepts and what it returns, for wiring Payrail into your own system.
order: 6
---

# API

The dashboard is just one client of this API. Everything the UI can do, HTTP can do, and the other way round. All responses are JSON; `BigInt` values (blocks) and USDC amounts are sent as strings so precision is never lost.

Amounts are always in **smallest USDC units** (6 decimals), except when creating an invoice, where you send a plain number (`"85.00"`) and the backend converts.

## Merchants

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/merchants` | All merchants |
| `POST` | `/api/merchants` | `{ name, walletAddress }`, upsert by wallet |

`walletAddress` is unique. Posting the same wallet again updates `name` instead of creating a second merchant.

## Invoices

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/invoices?merchantId=&status=` | List, newest first. Both filters optional. |
| `POST` | `/api/invoices` | Create; `201` with `paymentLink` |
| `GET` | `/api/invoices/:id` | Detail, including `merchant` and `payment` (if any) |
| `DELETE` | `/api/invoices/:id` | Set `CANCELLED` if not PAID |

Body for `POST /api/invoices`:

```json
{
  "merchantId": "clx...",
  "description": "Logo design, milestone 2",
  "customerName": "Alex",
  "amount": "85.00",
  "dueAt": "2026-10-01T00:00:00Z"
}
```

Validation (zod): `description` 1 to 500 characters, `amount` matching `^\d+(\.\d{1,6})?$` and `> 0`, `dueAt` optional ISO datetime. Unknown merchant: `404`.

The invoice object:

```json
{
  "id": "clx...",
  "onchainId": "0x9f2a...",
  "merchantId": "clx...",
  "customerName": "Alex",
  "description": "Logo design, milestone 2",
  "amount": "85000000",
  "status": "PENDING",
  "dueAt": null,
  "createdAt": "2026-09-17T08:12:00.000Z",
  "merchant": { "id": "...", "name": "Acme Studio", "walletAddress": "0x..." },
  "payment": null,
  "paymentLink": "https://.../pay/clx..."
}
```

`status` is one of `PENDING`, `PAID`, `CANCELLED`, `EXPIRED` (the last is reserved; nothing sets it yet).

## Verification

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/invoices/:id/verify` | `{ txHash }`: check receipt and event, set PAID |

| Code | Meaning |
| --- | --- |
| `200` | Matched; the invoice is now PAID (or already was; idempotent) |
| `202` | Undecidable yet: tx not found yet or confirmations short. Retry. |
| `400` | Tx reverted, no event for this invoice, or terms mismatch. Body has `reason`. Do not retry. |

## Indexer

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/indexer` | Scan `PaymentReceived` from the last block to the head |

Requires an `x-indexer-secret` header equal to `INDEXER_SECRET`. Without it, `401`. Response:

```json
{ "scanned": 1843, "applied": 2, "from": "18204311", "to": "18206153" }
```

Safe to call as often as you like; already-applied events are skipped.

## Export and summary

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/invoices/export?merchantId=` | CSV of the merchant's invoices, with `txHash` and `paidAt` for PAID ones |
| `GET` | `/api/stats?merchantId=` | `{ total, paid, pending, totalReceived, totalOutstanding }` |

`totalReceived` is summed from `Payment` records (the actual amounts received), `totalOutstanding` from `PENDING` invoices. Both are smallest-unit strings.

## What is missing

There is no authentication on these endpoints. Anyone who can reach the server can create invoices for any merchant and read anyone's invoices. For production, add sign-in with wallet (SIWE) or put the API behind your own proxy. See [Risks and limits](/docs/risks-and-limits).

Next: [Risks and limits](/docs/risks-and-limits).
