---
title: Troubleshooting
description: Symptom, likely cause and fix for wallet, payment, status, RPC, dashboard and install problems, each tied to what the code actually does.
order: 14
section: Help
---

# Troubleshooting

Every fix here is something the app, the contract or the API already supports. If your symptom is missing, write to support@payrail.app with the invoice id, the transaction hash if there is one, and the paying wallet address.

## Connecting

### The button says No wallet

**Cause.** The page found no injected wallet (`window.ethereum`) and this deployment has no WalletConnect project id, so there is no connector to offer.

**Fix.** On desktop, install a browser extension wallet and reload. On a phone, open the payment link inside your wallet's own browser. A `Mobile` button (WalletConnect) appears only when the server has it configured.

### The button says Switch to Robinhood Chain

**Cause.** The wallet is connected but on another network. Every invoice is pinned to one chain (`Invoice.chainId`) and the page refuses to continue until the wallet matches.

**Fix.** Press the button. The wallet switches, or asks to add the network first if it does not know it.

### The wallet cannot add the network

**Cause.** Some wallets reject the add-chain prompt or time out checking the RPC.

**Fix.** Add it by hand with the values below, then press `Switch to Robinhood Chain` again. See [Wallet setup](/docs/wallet-setup) for the full walkthrough.

| Field | Value |
| --- | --- |
| Network name | Robinhood Chain |
| Chain id | 4663 |
| RPC URL | `https://payrail.tech/api/rpc/4663` (or `https://rpc.mainnet.chain.robinhood.com`) |
| Currency symbol | ETH |
| Explorer | `https://robinhoodchain.blockscout.com` |

## Paying

### The wallet refuses to send, or estimates gas and fails

**Cause.** Usually no ETH on Robinhood Chain. Both `approve` and `pay` are ordinary transactions and gas is paid in ETH, not in the stablecoin.

**Fix.** Put a little ETH on Robinhood Chain in the paying wallet and try again.

### The button reads Insufficient balance

**Cause.** `balanceOf(buyer)` on the billing token is below the invoice amount, read on the invoice's chain.

**Fix.** Top up the token on Robinhood Chain. Note the label: the app writes **USDC** everywhere, but the token moved on Robinhood Chain is **USDG** (Global Dollar, 6 decimals) at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. If your wallet shows USDG where the page says USDC, that is expected.

### Approving never finishes

**Cause.** After you confirm `approve`, the page polls `allowance(buyer, PaymentProcessor)` ten times, 1.5 seconds apart, then sends `pay`. If the approve is stuck (too little gas, or a queued transaction ahead of it), the allowance stays short and `pay` reverts.

**Fix.** Open the wallet's activity list and speed up or cancel the pending approve. Once it is mined, reload the page and press Pay again: the approve row disappears when the allowance already covers the amount, and only `pay` is sent.

### The transaction reverted

The page shows the first line of the wallet's error. The contract's own errors are:

| Error | Meaning | What to do |
| --- | --- | --- |
| `InvoiceAlreadyPaid` | These exact terms (`salt`, `merchant`, `amount`) were paid before. | Reload. The page reads `isPaid(onchainId)` on chain and shows `Invoice paid`. The transaction link appears once verify or the indexer has recorded the earlier payment. |
| `InvalidAmount` | Amount was zero or above `uint96`. | Only reachable from a hand-built call. Use the payment page. |
| `InvalidMerchant` | Merchant was the zero address or the contract. | Same. |
| The token's own error, or `SafeERC20FailedOperation` | `transferFrom` failed inside `pay`. | Balance or allowance is short; see the two fixes above. |

> **Warning:** a reverted transaction still costs gas, but it moves no tokens and records nothing. The invoice stays PENDING and can still be paid.

## Status

### I paid, but the invoice is still PENDING

Work through these in order.

**Confirmations.** Verification waits for `CONFIRMATIONS_4663` blocks (2 in the example configuration). Until then `POST /api/invoices/:id/verify` answers `202` and the page retries up to 20 times, 3 seconds apart. After that it shows `timed out waiting for confirmations, try refreshing` and stops polling. Refreshing is the fix: after a reload the page polls every 5 seconds while the invoice is PENDING and picks up the payment once the indexer has applied it, or once you call verify by hand as below.

**The browser closed before verify ran.** The payment is on chain but nobody handed the backend the hash. Run the fast route by hand:

```bash
curl -X POST https://payrail.tech/api/invoices/<invoice id>/verify \
  -H "content-type: application/json" \
  -d '{"txHash":"0x<transaction hash>"}'
```

Use the hash of the `pay` transaction, not the approve, or verify answers `no PaymentReceived event for this invoice in the tx`. Or wait for the indexer, which scans `PaymentReceived` events and applies them through the same `applyPaymentLog` function. See [Verification and the indexer](/docs/verification-and-indexer).

**The indexer is not scheduled.** On a self-hosted deployment nothing calls `POST /api/indexer` unless you schedule it. It answers `401` when the `x-indexer-secret` header is missing, wrong, or `INDEXER_SECRET` is unset. See [Self-hosting](/docs/self-hosting).

**Wrong chain.** The payment page always sends to the invoice's own chain, so this only happens with a hand-built call on another network that has a PaymentProcessor. The indexer rejects such a payment with `invoice is on Robinhood Chain, payment was on <network>` and the invoice stays PENDING. Payrail has no refund mechanism; the buyer and merchant sort it out between themselves.

### The tokens are in my wallet, but the invoice is still PENDING

**Cause.** The buyer sent a plain `transfer` to your address, from a wallet's send screen or as an exchange withdrawal, instead of paying through the link. A transfer does not call `pay()`, so there is no `PaymentReceived` event, and PAID is decided from that event alone. The same happens when the buyer called `pay()` with a different amount: the tokens arrive under a different key.

**Fix.** There is nothing to verify. Reconcile it by hand: check the transfer on Blockscout, then cancel the invoice so it stops showing as outstanding. The record will not say PAID, because no Payrail payment happened. Tell the buyer to use the link next time.

## RPC

### Reads hang or fail on some Indonesian connections

**Cause.** The public RPC is content-filtered by some ISPs. The page points the wallet at the same-origin relay `POST /api/rpc/4663`, so the browser only talks to payrail.tech. A wallet that was set up earlier with the public RPC alone can still fail.

**Fix.** Edit the network in the wallet and set the RPC URL to `https://payrail.tech/api/rpc/4663`. No VPN is needed. When the chain itself is slow the relay answers `504 Upstream timeout` after 25 seconds, or `502` when the upstream reply is not JSON-RPC; wait and retry.

### The relay answers 429 Too many requests

**Cause.** Each IP gets a token bucket of `RPC_RELAY_RATE` requests per second (20) bursting to `RPC_RELAY_BURST` (60). Several people behind one office IP can exhaust it.

**Fix.** Wait a few seconds; the bucket refills. Self-hosters can raise both variables.

## Dashboard

### An invoice is missing

**Cause.** The list is filtered by the merchant select, which auto-selects the merchant whose wallet is connected. An invoice created for another merchant sits under a different filter.

**Fix.** Change the select, or pick `All merchants`, and check the status chips above the list: `All` shows everything, the others show one status. Overdue PENDING invoices become EXPIRED the moment the list is read, so an overdue invoice shows as EXPIRED, and a due date set to today expires on the first read because the day is stored as midnight UTC.

### The API answers merchant not found

**Cause.** `POST /api/invoices` was given a `merchantId` that does not exist.

**Fix.** Register first: connect the wallet on [/app](/app), fill in `Register this wallet as a merchant`, press `Register`. Registering the same wallet again updates the name; it never creates a second merchant.

## Install and notifications

### There is no Install app button

**Cause.** The button renders only after the browser fires `beforeinstallprompt`: Chrome, Edge and Android, on HTTPS, when the app is not already installed. Safari never fires it. The button sits in the desktop header only; on a phone use the browser's own install menu. The service worker registers only in production builds.

**Fix.** On iOS, tap Share, then Add to Home Screen. The payment page shows this hint on iOS until you dismiss it, and remembers the dismissal per device.

### Notify me when paid is missing or greyed out

**Cause.** The button is hidden when the browser lacks Web Push or when the server has no VAPID keys (`GET /api/push/subscribe` returns `enabled: false`). It reads `Notifications blocked` when you denied permission earlier.

**Fix.** Allow notifications for the site in the browser settings, reload the dashboard, then press the button. It renders only for the merchant whose wallet is connected. Self-hosters set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. The push says `Invoice paid` and labels the amount USDC like the rest of the app.

Next: [FAQ](/faq) for the short answers, [Risks and limits](/docs/risks-and-limits) for what no fix covers.
