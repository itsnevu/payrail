---
title: Verification and the indexer
description: The two routes that turn a PaymentReceived event into PAID, the rules they share, confirmations, reorgs, and a failure table.
order: 7
section: Under the hood
---

# Verification and the indexer

An invoice becomes PAID through one function: `applyPaymentLog` in `web/src/lib/verify.ts`. Two routes feed it. The fast way is a `txHash` sent by the buyer's browser right after paying. The slow but certain way is the indexer, which scans the chain for every `PaymentReceived` event our contract emitted. Both apply the same rules and are safe to run repeatedly. Nothing the browser sends decides PAID: the `txHash` is only a lookup key; the receipt and event are read from the chain by the server over its own RPC.

## The shared rules: applyPaymentLog

Given one `PaymentReceived(invoiceId, salt, merchant, payer, amount, timestamp)` event seen on a chain, the backend:

1. **Finds the invoice** where `onchainId == invoiceId` (stored lowercase, `@unique`). None found: `"no invoice found for this onchainId"`, which means another deployment, a reset database, or terms we never issued.
2. **Already has a `payment`?** Return `ok`. This makes both routes idempotent: the same transaction processed ten times still produces one record.
3. **Chain must match.** The key binds `(salt, merchant, amount)` but not the network. If `invoice.chainId` differs from the chain the event was seen on: `"invoice is on <network>, payment was on <network>"`. Payrail runs on Robinhood Chain only; the check is there so a wrong deployment cannot close an invoice from the wrong side.
4. **Merchant must match.** `getAddress(event.merchant) == getAddress(invoice.merchant.walletAddress)`. Since v2 the key itself binds the merchant, so a mismatch can only mean a wrong deployment or ABI; the check stays as defense in depth.
5. **Amount must match exactly.** `event.amount == BigInt(invoice.amount)`, not `>=`. Overpayment or underpayment is a different key and never reaches this invoice; if it did, the reason is `"amount mismatch: X != Y"`.
6. In one database transaction: create `Payment{chainId, txHash, payer, amount, blockNumber, paidAt}` and set `invoice.status = PAID`. Then, if VAPID keys are configured, a Web Push `Invoice paid` goes to the merchant's devices; a push failure never fails the verification.

`txHash` and `invoiceId` are both `@unique` on `Payment`. If the browser and the indexer try to record the same transaction at the same moment, the second fails on the constraint instead of producing a duplicate.

Not checked: `payer` (anyone may pay anyone's invoice, so a client can pay from a company wallet), `status` (a CANCELLED or EXPIRED invoice paid on chain becomes PAID) and `dueAt` (a late payment is still PAID).

## Route 1: verify from txHash

```
POST /api/invoices/:id/verify   { "txHash": "0x..." }
```

The pay page calls this after the wallet returns a receipt. The route rejects a malformed hash (400) and an unknown invoice id (404), then runs `verifyTx` on the invoice's own chain, so a hash from another network can never match. Step by step:

1. **Fetch the receipt** with `getTransactionReceipt`. No receipt yet: `"transaction not found or not mined yet"`, `pending: true`.
2. **Check `receipt.status`.** Anything but `success`: `"transaction reverted"`. A revert has no logs to match.
3. **Count confirmations.** `latest - receipt.blockNumber + 1 < confirmations`: `"waiting for confirmations"`, `pending: true`.
4. **Filter the logs by address.** Only logs whose `address` is this chain's PaymentProcessor are kept. Any contract can emit an event with the same signature; we trust only the address we deployed.
5. **Decode `PaymentReceived`** from the surviving logs and look for one whose `invoiceId` equals the invoice's `onchainId`, compared case-insensitively. None: `"no PaymentReceived event for this invoice in the tx"`.
6. **Apply** the matching log through `applyPaymentLog` with the receipt's block number.

The HTTP status carries the meaning:

| Status | Meaning | Client behaviour |
| --- | --- | --- |
| 200 | Matched and PAID (or already PAID) | Done |
| 202 | Undecidable yet: not mined, or short of confirmations | Retry |
| 400 | Definitively rejected: reverted, wrong event, terms mismatch | Stop, show `reason` |

The response always includes the fresh `invoice`. The pay page tries up to 20 times, pausing 3 seconds after each 202, then shows `timed out waiting for confirmations, try refreshing`.

## Route 2: the indexer

```
POST /api/indexer            header: x-indexer-secret: <INDEXER_SECRET>
POST /api/indexer?chainId=4663
```

The indexer needs no browser. It catches payments made without the UI (a script, a wallet, another contract), payments where the browser never sent the `txHash` (tab closed, network dropped), and verifications that timed out.

### Cursor and ranges

Each chain keeps its own cursor in `IndexerState{chainId, lastBlock}`. One run on one chain:

1. `head = getBlockNumber()`; `safeHead = head - confirmations + 1`. The indexer never reads past `safeHead`, so it never applies a block still inside the confirmation window.
2. `from = lastBlock + 1`, or on the first run `safeHead - 5000` (0 when `safeHead` is 5,000 or less). If `from > safeHead` the run returns `scanned: 0`.
3. Scan `PaymentReceived` logs from our contract address with `getContractEvents`, in chunks of 2,000 blocks, up to `safeHead`. Every log goes through `applyPaymentLog`.
4. Upsert `IndexerState.lastBlock = safeHead`.

The cursor advances whether or not each log was applied; a rejected log is not retried. To have older blocks seen again after restoring a database, set `lastBlock` to a block before the payment and call the route once.

### Triggering and the response

This is the only authenticated route. It returns 401 when the header is missing or wrong, and also when `INDEXER_SECRET` is unset, so a deployment that forgot the variable is closed rather than open. Without `chainId` it runs every enabled chain; with `chainId`, that one. A chain that is not enabled or whose RPC fails comes back as `{chainId, error}` without stopping the others.

```json
{ "ok": true, "chains": [ { "chainId": 4663, "scanned": 240, "applied": 1, "from": "1284001", "to": "1284240" } ] }
```

`scanned` counts blocks, not events. 200 means every chain finished; 207 means at least one returned an `error`.

### Running it from cron

Call the route on an interval of your choosing from the machine that hosts the app:

```
* * * * * curl -s -m 50 -X POST -H "x-indexer-secret: $INDEXER_SECRET" http://127.0.0.1:3000/api/indexer >/dev/null 2>&1
```

Adjust the port and supply the real secret. For development, `node scripts/indexer-loop.mjs` does the same from a terminal. Overlapping runs, or a run that lands at the same moment as route 1, are harmless: whoever arrives second sees `payment` already exists and stops.

> **Tip:** Route 1 is a convenience for the buyer, who wants to see PAID before closing the tab. Route 2 is the guarantee. Run it in production.

## Confirmations and reorgs

`confirmationsFor(chainId)` reads `CONFIRMATIONS_<chainId>`, then `CONFIRMATIONS`, then defaults to `1`. `.env.example` sets `CONFIRMATIONS_4663=2` for Robinhood Chain. The same number gates both routes: route 1 answers 202 until the block has that many confirmations; route 2 reads only up to `safeHead = head - confirmations + 1`, the newest block that already has that many confirmations.

That number is the only reorg protection there is. Once `applyPaymentLog` has written PAID, nothing watches the block afterwards and there is no mechanism to revert PAID if the chain later drops it. Higher means PAID arrives later; on local Hardhat `1` is fine, on Robinhood Chain `2` or `3` is a sensible trade.

## Failure table

| Symptom | Cause | What the code returns |
| --- | --- | --- |
| `waiting for confirmations` | Block younger than `CONFIRMATIONS_4663` | 202, `pending: true`; the page retries |
| `transaction not found or not mined yet` | Receipt not on the server's RPC yet | 202, `pending: true`; the page retries |
| `transaction reverted` | `pay()` reverted: no allowance, no balance, `InvoiceAlreadyPaid` | 400, no logs to match |
| `no PaymentReceived event for this invoice in the tx` | Unrelated transaction, or the event came from another contract address | 400 |
| `no invoice found for this onchainId` | Terms we never issued, another deployment, or a reset database | 400 on route 1; skipped by route 2 |
| `merchant mismatch`, `amount mismatch`, `invoice is on X, payment was on Y` | Wrong deployment or ABI on the server; the key already binds the terms | 400 on route 1; skipped by route 2 |
| PENDING although Blockscout shows the payment | Browser never sent the hash and the indexer is not running | Nothing until `POST /api/indexer` runs |
| PENDING although the tokens arrived in the merchant wallet | A plain `transfer`, not a `pay()` call: no `PaymentReceived` to match | Nothing; not a Payrail payment. Verify with the transfer hash answers `no PaymentReceived event for this invoice in the tx` |
| `POST /api/indexer` answers 401 | Header missing or wrong, or `INDEXER_SECRET` unset | `{"error":"unauthorized"}` |
| Indexer answers 207 | One chain's RPC failed or the chain is not enabled | `{chainId, error}` for that chain, results for the rest |
| CANCELLED invoice became PAID | Payer still held the `pay()` arguments; cancel is database only | Applied like any other payment |

Next: [Contracts](/docs/contracts), then [Risks and limits](/docs/risks-and-limits) for what these mechanisms do not protect against.
