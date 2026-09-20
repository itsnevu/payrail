---
title: API reference
description: Every Payrail endpoint with parameters, response shapes, status codes and curl examples, plus how to wire invoices into your own system.
order: 10
section: Reference
---

# API reference

The dashboard is just one client of this API. Everything the UI can do, HTTP can do, and the other way round. This page lists every route under `/api`: what it accepts, what it returns and how it fails, read from the route handlers themselves.

## Conventions

**Host.** `https://payrail.tech` in production, or wherever you self-host. Paths below are relative to it.

**JSON everywhere.** Bodies and responses are JSON, except the CSV export and the JSON-RPC relay. Dates are ISO 8601 strings. `BigInt` fields (`blockNumber`) and every amount are strings, so nothing is rounded on the way through `JSON.stringify`.

**Amounts.** Stored and returned in **smallest units** (6 decimals): `"85000000"` is 85.00. The one exception is `POST /api/invoices`, where you send a decimal string (`"85.00"`) and the server converts. The app labels amounts USDG; on Robinhood Chain the token moved is USDG (Global Dollar, 6 decimals).

**Validation errors.** Bodies are checked with zod. A failed check returns `400` with zod's flattened shape:

```json
{ "error": { "fieldErrors": { "amount": ["invalid amount format (max 6 decimals)"] }, "formErrors": [] } }
```

Other errors return `{ "error": "<message>" }` with the status listed per endpoint. A body that is not valid JSON is not caught and surfaces as a `500`, except on `DELETE /api/push/subscribe`, which treats it as a missing `endpoint`.

**Authentication.** None, on any endpoint, except `POST /api/indexer`, which needs the `x-indexer-secret` header. Anyone who can reach the server can create invoices for any merchant and read every invoice. Put the API behind your own proxy if that matters to you. See [Risks and limits](/docs/risks-and-limits).

**CORS.** No route sets `Access-Control-Allow-Origin`, so a page on another origin cannot call this API from the browser; the browser blocks the response. Call it from your server instead. The app's own pages are same-origin and need nothing.

**Pagination and rate limits.** None. `GET /api/merchants` and `GET /api/invoices` return every matching row in one response, and no route throttles callers except the JSON-RPC relay, which has its own per-IP bucket. Filter with the query parameters and keep the polling modest.

**Idempotency.** `POST /api/merchants` is an upsert and can be repeated. `POST /api/invoices` is not: every call creates a new invoice with a new key, so a retried request after a timeout produces two links. Record the returned `id` before you retry, or look the invoice up with `GET /api/invoices?merchantId=` first.

## Merchants

### GET /api/merchants

Every merchant, newest first. No parameters.

```bash
curl https://payrail.tech/api/merchants
```

```json
[{ "id": "clx…", "name": "Acme Studio", "walletAddress": "0xAbC…", "createdAt": "2026-09-17T08:12:00.000Z" }]
```

### POST /api/merchants

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `name` | string | yes | at least 1 character |
| `walletAddress` | string | yes | a valid EVM address (viem `isAddress`) |

Upserts by checksummed wallet: posting the same wallet again updates `name` instead of creating a second merchant. Returns `201` with the merchant, `400` on validation.

```bash
curl -X POST https://payrail.tech/api/merchants \
  -H "content-type: application/json" \
  -d '{"name":"Acme Studio","walletAddress":"0xYourWallet"}'
```

## Invoices

### The invoice object

```json
{
  "id": "clx…",
  "onchainId": "0x9f2a…",
  "chainId": 4663,
  "merchantId": "clx…",
  "customerName": "Alex",
  "description": "Logo design, milestone 2",
  "amount": "85000000",
  "status": "PENDING",
  "dueAt": null,
  "createdAt": "2026-09-17T08:12:00.000Z",
  "updatedAt": "2026-09-17T08:12:00.000Z",
  "merchant": { "id": "clx…", "name": "Acme Studio", "walletAddress": "0xAbC…", "createdAt": "…" },
  "payment": null
}
```

`status` is one of PENDING, PAID, EXPIRED, CANCELLED. `onchainId` is the key the contract records the payment under, `keccak256(abi.encode(salt, merchant, amount))` with `salt = keccak256(invoice.id)`, stored lowercase. Once paid, `payment` is filled:

```json
{ "id": "clx…", "invoiceId": "clx…", "chainId": 4663, "txHash": "0x…", "payer": "0x…", "amount": "85000000", "blockNumber": "18206101", "paidAt": "2026-09-18T10:03:12.000Z", "createdAt": "…" }
```

### GET /api/invoices

| Query | Type | Effect |
| --- | --- | --- |
| `merchantId` | string | only this merchant's invoices |
| `status` | string | exact match on the status word |
| `chainId` | number | only invoices pinned to this network |

All filters optional; combine freely. Newest first, each with `merchant` and `payment`. Before the query runs, PENDING invoices whose `dueAt` has passed are flipped to EXPIRED (`expireOverdueInvoices`, scoped to `merchantId` when given). There is no scheduler; the read is what expires them, and the contract does not know about expiry.

```bash
curl "https://payrail.tech/api/invoices?merchantId=MERCHANT_ID&status=PENDING"
```

### POST /api/invoices

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `merchantId` | string | yes | an existing merchant id |
| `chainId` | integer | no | an enabled network with a deployment; default is `NEXT_PUBLIC_DEFAULT_CHAIN_ID`, else the first enabled chain |
| `description` | string | yes | 1 to 500 characters |
| `customerName` | string | no | up to 200 characters |
| `amount` | string | yes | `^\d+(\.\d{1,6})?$`, converted to units, must be above zero |
| `dueAt` | string | no | ISO 8601 datetime in UTC, `2026-10-01T00:00:00Z`; zod's `datetime()` rejects a timezone offset. The invoice is overdue as soon as this instant is in the past, so the form sends midnight UTC at the start of the chosen day; send `T23:59:59Z` if you mean the end of it |

Returns `201` with the invoice object plus `paymentLink`, built from `NEXT_PUBLIC_APP_URL`:

```json
{ "id": "clx…", "status": "PENDING", "paymentLink": "https://payrail.tech/pay/clx…" }
```

| Status | Body |
| --- | --- |
| `400` | zod shape; a chain that is not enabled reports `network <id> is not available (enabled: <ids>)` under `fieldErrors.chainId` |
| `400` | `{ "error": "amount must be > 0" }` |
| `404` | `{ "error": "merchant not found" }` |

```bash
curl -X POST https://payrail.tech/api/invoices \
  -H "content-type: application/json" \
  -d '{"merchantId":"MERCHANT_ID","description":"Logo design, milestone 2","customerName":"Alex","amount":"85.00"}'
```

### GET /api/invoices/:id

One invoice with `merchant` and `payment`. Runs the same expiry pass first, for all merchants. `404` `{ "error": "not found" }`. This is the endpoint to poll.

```bash
curl https://payrail.tech/api/invoices/INVOICE_ID
```

### DELETE /api/invoices/:id

Sets `status` to CANCELLED and returns the bare invoice row, without `merchant` or `payment`. `404` if unknown, `409` `{ "error": "invoice already paid" }` if PAID. An EXPIRED invoice is overwritten to CANCELLED without a guard.

> **Warning:** Cancel is database-only. The contract does not know. Anyone still holding the `pay()` arguments can send them; the transfer goes through, the indexer applies the event, and the invoice becomes PAID.

```bash
curl -X DELETE https://payrail.tech/api/invoices/INVOICE_ID
```

### POST /api/invoices/:id/verify

The fast route to PAID. Body `{ "txHash": "0x…" }` (viem `isHash`). The server reads the receipt on the invoice's own chain, answers `202` until the block has `CONFIRMATIONS_<chainId>` confirmations (falling back to `CONFIRMATIONS`, then `1`; the shipped `.env.example` sets `2` for Robinhood Chain), keeps only logs emitted by the PaymentProcessor, parses `PaymentReceived`, finds the one whose `invoiceId` equals `onchainId`, and hands it to `applyPaymentLog`, which checks merchant and exact amount and writes `Payment` plus `status = PAID` in one database transaction.

Response: `{ ok, reason?, pending?, invoiceId?, invoice }`, with `invoice` re-read after the attempt.

| Status | Meaning | `reason` |
| --- | --- | --- |
| `200` | matched; PAID now, or already was (idempotent) | |
| `202` | not decidable yet, retry | `transaction not found or not mined yet`, `waiting for confirmations` |
| `400` | rejected, do not retry | `transaction reverted`, `no PaymentReceived event for this invoice in the tx`, `no invoice found for this onchainId`, `invoice is on <network>, payment was on <network>`, `merchant mismatch`, `amount mismatch: <event> != <invoice>` |
| `400` | bad hash | zod shape |
| `404` | unknown invoice | `not found` |

```bash
curl -X POST https://payrail.tech/api/invoices/INVOICE_ID/verify \
  -H "content-type: application/json" \
  -d '{"txHash":"0xTRANSACTION_HASH"}'
```

### GET /api/invoices/export

`?merchantId=` optional. Returns `text/csv; charset=utf-8` as an attachment named `payrail-invoices-<timestamp>.csv`, newest first, 15 columns:

```text
invoice_id, created_at, network, chain_id, merchant, merchant_wallet, customer, description,
amount_usdc, status, paid_at, payer, tx_hash, tx_url, block_number
```

`amount_usdc` is a decimal with two to six places and en-US thousands separators (`85.00`, `1,240.00`); every cell is double-quoted, so the comma is safe. The payment columns are empty for unpaid rows, and `tx_url` is the Blockscout link.

```bash
curl -o invoices.csv "https://payrail.tech/api/invoices/export?merchantId=MERCHANT_ID"
```

## Stats

### GET /api/stats

`?merchantId=` optional. Runs the expiry pass, then counts.

```json
{ "total": 12, "paid": 9, "pending": 2, "totalReceived": "1240000000", "totalOutstanding": "170000000" }
```

`totalReceived` is summed from `Payment` rows, the amounts that actually arrived. `totalOutstanding` is summed from PENDING invoices. Both are unit strings.

## Chains and RPC

### GET /api/chains

The networks this deployment accepts invoices on, with the addresses a script needs to pay without the UI. Server RPC URLs are not exposed.

```json
{
  "default": 4663,
  "chains": [
    { "chainId": 4663, "name": "Robinhood Chain", "testnet": false,
      "explorerUrl": "https://robinhoodchain.blockscout.com",
      "paymentProcessor": "0xD591A0d397179dE0692d50f43AC450C6cDF9C66D",
      "usdc": "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      "rpc": "/api/rpc/4663" }
  ]
}
```

`explorerUrl`, `paymentProcessor` and `usdc` are `null` when unset. To pay from a script, approve `amount` of the token at `usdc` for `paymentProcessor`, then call `pay(salt, merchant, amount)` with `salt = keccak256(invoice.id)`. See [Payment flow](/docs/payment-flow).

### Paying without the UI

Everything `pay()` needs is in `GET /api/invoices/:id` and `GET /api/chains`. With viem, after fetching both:

```ts
import { keccak256, toBytes, parseAbi } from "viem";

const salt = keccak256(toBytes(invoice.id));          // exactly what the pay page sends
const amount = BigInt(invoice.amount);                 // smallest units, as returned by the API
const merchant = invoice.merchant.walletAddress;

await wallet.writeContract({
  address: chain.usdc, abi: parseAbi(["function approve(address,uint256)"]),
  functionName: "approve", args: [chain.paymentProcessor, amount],
});
const txHash = await wallet.writeContract({
  address: chain.paymentProcessor, abi: parseAbi(["function pay(bytes32,address,uint256)"]),
  functionName: "pay", args: [salt, merchant, amount],
});
```

`wallet` is a viem wallet client connected to chain 4663. Then either post `txHash` to `POST /api/invoices/:id/verify` and retry on `202`, or do nothing and let the indexer find the event. A plain `transfer` to the merchant's address, without `pay()`, emits no `PaymentReceived` and never closes the invoice.

### POST /api/rpc/:chainId

A same-origin JSON-RPC relay. Robinhood Chain's public RPC is content-filtered by some Indonesian ISPs, so the app points the browser and the wallet here and the server forwards to its own RPC. Responses pass through untouched, with `cache-control: no-store`. Only these methods are relayed:

```text
eth_chainId, net_version, web3_clientVersion, eth_blockNumber, eth_getBlockByNumber,
eth_getBlockByHash, eth_gasPrice, eth_maxPriorityFeePerGas, eth_feeHistory, eth_estimateGas,
eth_call, eth_getBalance, eth_getCode, eth_getStorageAt, eth_getTransactionCount,
eth_getTransactionByHash, eth_getTransactionReceipt, eth_getLogs, eth_sendRawTransaction
```

**Rate limit.** A token bucket per client IP (first `x-forwarded-for` entry): `RPC_RELAY_RATE` requests per second (default `20`), bursting to `RPC_RELAY_BURST` (default `60`). A batch costs one token per call. Over the limit: `429` with JSON-RPC error `-32005 Too many requests, slow down`. The bucket lives in memory, per server instance.

| Status | JSON-RPC error |
| --- | --- |
| `404` | `-32000 chain <id> is not enabled` |
| `413` | `-32600 Request too large` (body over 256 KB) |
| `400` | `-32700 Parse error`; `-32600 Batch of at most 50`, also for an empty batch |
| `200` | `-32601 Method not relayed: <method>`, or `-32600 Invalid request` when a call is not an object or `method` is not a string; in a batch the refused call is answered in its slot, the rest are forwarded, and a slot the upstream did not answer gets `-32603 Missing upstream answer` |
| `502` | `-32603 Upstream returned <status>` (upstream answered with something that is not JSON) or `Upstream unreachable: <message>` |
| `504` | `-32603 Upstream timeout` (25 s) |
| `405` | `GET` is refused with `{ "error": "POST JSON-RPC only" }` |

```bash
curl -X POST https://payrail.tech/api/rpc/4663 \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'
```

## Indexer

### POST /api/indexer

The certain route to PAID. Scans `PaymentReceived` from each chain's stored cursor up to `head - confirmations + 1`, in 2,000-block chunks, and applies every event through the same `applyPaymentLog`. The first run starts 5,000 blocks behind that safe head, or at block 0 on a chain shorter than that. This catches payments that never touched the UI: a wallet, a script, a buyer whose browser closed before `verify`. Idempotent: an already-applied event returns `ok` and changes nothing; `txHash @unique` and `invoiceId @unique` stop a concurrent duplicate from counting twice.

| Input | Where | Effect |
| --- | --- | --- |
| `x-indexer-secret` | header | must equal `INDEXER_SECRET`; if the variable is unset, every call is `401` |
| `chainId` | query | scan one chain; omit to scan every enabled chain in parallel |

```json
{ "ok": true, "chains": [ { "chainId": 4663, "scanned": 1843, "applied": 2, "from": "18204311", "to": "18206153" } ] }
```

`200` when every chain succeeded. `207` with `ok: false` when any chain returned `{ "chainId": 4663, "error": "…" }` in place of a result; the others still ran. `401` `{ "error": "unauthorized" }`. `500` `{ "error": "<message>" }` if the run itself throws.

```bash
curl -X POST "https://payrail.tech/api/indexer?chainId=4663" \
  -H "x-indexer-secret: $INDEXER_SECRET"
```

Run it from cron on the server. How often is your call; the local helper `web/scripts/indexer-loop.mjs` reads `INDEXER_INTERVAL_MS`.

## Push subscriptions

Web Push is optional and only works when the server has `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` set. The dashboard uses these routes; you will rarely call them by hand.

| Method | Body | Response |
| --- | --- | --- |
| `GET /api/push/subscribe` | none | `{ "enabled": <bool>, "publicKey": <key or null> }`; `enabled` is true only when both VAPID keys are set, `publicKey` is `NEXT_PUBLIC_VAPID_PUBLIC_KEY` or `null` |
| `POST /api/push/subscribe` | `{ merchantId, subscription: { endpoint (URL), keys: { p256dh, auth } } }` | `{ "ok": true }`; upsert by `endpoint`; `400` zod, `404` `merchant not found` |
| `DELETE /api/push/subscribe` | `{ endpoint }` | `{ "ok": true }`; `400` `endpoint required` |

When `applyPaymentLog` marks an invoice PAID it sends `Invoice paid` to every subscription of that merchant. A push failure never fails the verification.

## Wire it into your system

Three pieces are enough: create on your side, send the link, and learn about PAID from the API rather than from the customer.

**1. Create the invoice server-side.** Register the receiving wallet once with `POST /api/merchants` and keep the `id` it returns (the same id is in `GET /api/merchants`; the dashboard does not display it). Then `POST /api/invoices` from your backend when you issue a bill. Store the returned `id` and `paymentLink` next to your own order and send the link however you already send invoices. Put your own order number in `description` or `customerName` if you need it back in the CSV.

**2. Learn that it is paid.** Two options, both reading the same database:

- **Poll** `GET /api/invoices/:id` until `status` is PAID, then read `payment.txHash`, `payment.payer` and `payment.blockNumber`. Once a minute is plenty for a back office.
- **Run the indexer yourself** on a schedule with the secret and read `applied`, or rely on whatever schedule the deployment runs it on and poll as above. There are no HTTP webhooks; nothing will call your server.

**3. Reconcile.** `GET /api/invoices/export` gives the same rows as CSV, and `GET /api/stats` gives the totals. Every PAID row carries a `tx_url` you can open on Blockscout, which is the record you would show an accountant. Funds land in your wallet, not ours.

> **Note:** There is no authentication, so compare `payment.amount` and `merchant.walletAddress` against what you expected before you ship goods. The backend already refuses a mismatched merchant or amount, but your own check costs nothing.

Related: [Verification and the indexer](/docs/verification-and-indexer), [Contracts](/docs/contracts), [Self-hosting](/docs/self-hosting), [Risks and limits](/docs/risks-and-limits).
