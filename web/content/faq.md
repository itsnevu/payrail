---
title: FAQ
description: Short answers to the questions merchants, buyers and self-hosters ask about Payrail, each grounded in the code and linked to the page that goes deeper.
date: 2026-09-20
---

# FAQ

Short answers, grounded in the code. Where a question deserves a full page, the answer links to it. Where the honest answer is "not yet", it says so. If your question is missing, write to support@payrail.app.

> **Note:** The app labels every amount USDC. On Robinhood Chain the token actually moved is USDG (Global Dollar, 6 decimals) at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. "The token" below means that contract. The section on Robinhood Chain and USDG explains why the label is stale.

## General

### What is Payrail?

**Payrail** is reconciliation software for merchants who bill in a dollar stablecoin. You create an invoice, send a payment link, and the buyer pays through a contract that forwards the tokens straight to your wallet and emits an event naming the invoice. Our backend reads that event and marks the invoice PAID. The tagline is the whole product: Know exactly which invoice got paid.

A plain transfer carries an amount, a time and a sender. None of those is an invoice number, which is why merchants end up matching by hand and answering "I sent it, please check". Payrail makes the payment carry the invoice key itself. See [What Payrail is](/docs/what-payrail-is).

### Is Payrail a payment processor?

No. Payrail is reconciliation software, not a payment service provider. We do not take deposits, hold balances, forward funds or settle anything. The `PaymentProcessor` contract is named for what it does on chain (it processes one `pay()` call), not for a business role. Money moves from the buyer's wallet to the merchant's wallet inside the buyer's own transaction.

### Do you hold my funds?

Never, and not by policy but by construction. The only token movement in the contract is `safeTransferFrom(msg.sender, merchant, amount)`, buyer to merchant, inside `pay()`. There is no code path in which the contract or Payrail is the recipient, no `withdraw`, no `owner`, no upgrade. The contract's balance is zero structurally. Funds land in your wallet, not ours.

### What does it cost?

There is no Payrail fee. The merchant receives exactly `amount`. The buyer pays gas on Robinhood Chain for `approve` and `pay`, which needs a little ETH in the buyer's wallet. We do not quote gas figures because the network sets them, not us.

### Do I need an account?

No account, no password, no email, no identity check. Your wallet is your identity. A merchant connects a wallet on [/app](/app), types a display name and presses Register; that is the whole sign-up. A buyer needs nothing but a wallet holding the token and a little ETH.

The flip side: there is no merchant authentication yet either. See the security section below.

### Is Payrail audited?

Not independently. The contract has had two internal review passes (the second on 17 September 2026, eight findings, all resolved), eleven unit tests, and a live end-to-end script that replays the v1 griefing attack against a running stack. None of that is a third-party audit, and the docs say so wherever it matters. Bill accordingly. See [Risks and limits](/docs/risks-and-limits).

## For merchants

### How do I start?

Open [/app](/app), connect a browser wallet, enter a name and press Register. Then open [/invoices/new](/invoices/new), fill in a description and an amount, and press Create invoice & payment link. You land on the invoice page with a QR code and a link to share. [Getting started](/docs/getting-started) walks through it step by step.

### Which wallet do I register with?

The one you want the money in. Registration uses the connected wallet's address, so a typo is nearly impossible, but if you connect an exchange deposit address or someone else's wallet, that is where every payment goes. Nothing can pull tokens back. Registering again from a different wallet creates a second merchant; it does not move invoices from the first. The name is display only; the contract uses the address.

### What is on an invoice?

| Field | Rule |
| --- | --- |
| Description | Required, up to 500 characters |
| Customer name | Optional, up to 200 characters |
| Amount | Greater than zero, up to 6 decimals |
| Due date | Optional |

The amount is fixed once created, because the payment key is derived from it. To change the amount, cancel and create a new invoice. Duplicate (or `?from=<id>` on the new-invoice page) prefills a new invoice from an old one, which is handy for retainers. See [Creating invoices](/docs/creating-invoices).

### How do I know it was paid?

The invoice page polls every 5 seconds while PENDING and flips to PAID with the payer, amount, block and a Blockscout link. The dashboard lists the last five verified payments under Activity and polls every 8 seconds while anything is open. If the deployment has VAPID keys, Notify me when paid sends a Web Push `Invoice paid` to your browser. There are no HTTP webhooks.

### Can I cancel an invoice?

Yes, from the invoice page while it is PENDING (`DELETE /api/invoices/:id`). Cancel only changes the database. The contract does not know: a buyer who already holds the link can still pay, the tokens reach your wallet, and the indexer marks the invoice PAID. Tell the buyer when you cancel. Cancelling a PAID invoice returns `409`.

### What happens after the due date?

Overdue PENDING invoices are marked EXPIRED when the list, detail or stats endpoints read them. There is no scheduler and the contract does not know about expiry. The pay page refuses an EXPIRED invoice client-side, but the same caveat as cancel applies: the right terms sent on chain still become PAID in the database.

### Can I export my invoices?

Export CSV on the dashboard downloads every invoice for the selected merchant: 15 columns including `amount_usdc`, `status`, `paid_at`, `payer`, `tx_hash` and `tx_url`. The same file is at `GET /api/invoices/export?merchantId=<id>`. Amounts are written as decimals (`250.00`), labelled USDC for the reason explained below.

## For buyers

### What do I need to pay?

A wallet on Robinhood Chain holding at least the invoice amount of the token, plus a little ETH for gas. The pay page reads your balance and disables the button as Insufficient balance if it is short. See [Paying an invoice](/docs/paying-an-invoice) and [Wallet setup](/docs/wallet-setup).

### Which wallets work?

Any wallet that injects itself into the browser: a browser extension, or a mobile wallet's built-in browser. WalletConnect is offered only when the deployment sets `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: it becomes the Connect wallet button when no injected wallet is found, or a Mobile button beside it when one is. If neither is available the button reads No wallet.

On a phone, open the link inside your wallet's browser, or tap Connect and choose the mobile option if it is offered.

### Why two transactions?

The contract moves your tokens with `transferFrom`, which the token only allows after you approve the contract for that amount. So the first prompt is `approve(PaymentProcessor, amount)` and the second is `pay(salt, merchant, amount)`. If an earlier approval already covers the amount, the first prompt is skipped and it is one transaction. The arguments to both come from the invoice record, never from anything you type.

### My wallet asked to add or switch networks. Is that normal?

Yes. The invoice is pinned to Robinhood Chain (chain id 4663) and the pay page offers Switch to Robinhood Chain. If your wallet does not know the network, it asks to add it; the definition lists the same-origin relay first and the public RPC second. Check that the chain id is 4663 and that the contract in the second prompt is `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D`.

### Can I pay part of it, or a bit extra?

No. The payment key is `keccak256(abi.encode(salt, merchant, amount))`, so any other amount is a different key. The tokens would still reach the merchant, but the invoice would stay PENDING and you would settle the difference by hand. The pay page always sends the exact amount; this only comes up if you call the contract yourself. There are no partial payments or instalments.

### I paid but the page still says pending

Give it a minute. PAID needs the configured number of confirmations (`CONFIRMATIONS_4663`, 2 in the example configuration) and a `PaymentReceived` event matched to the invoice. If the tab closed or the network dropped before verification finished, the indexer picks the payment up on its own and the page shows it on its next poll. If the page reports a reason such as `transaction reverted`, the tokens did not move; check the wallet. [Troubleshooting](/docs/troubleshooting) lists the messages and what to do.

## Robinhood Chain and USDG

### Which network does Payrail run on?

Robinhood Chain only, chain id 4663, an Arbitrum Orbit L2 with ETH as the gas token. The contract is deployed at `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D`. There is a testnet (46630) configured for rehearsals with no deployment yet, and a local Hardhat chain (31337) for development. A payment anywhere other than 4663 does not count for a production invoice.

### Why does the app say USDC?

Because the code was written against a six-decimal dollar token it calls `usdc` throughout, and the label has not been changed yet. On Robinhood Chain the token the contract moves is USDG (Global Dollar), 6 decimals, at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. Wherever the UI, the CSV or a notification says USDC, read USDG. The amounts are right; only the name is stale.

### Where do I get USDG and ETH on Robinhood Chain?

From wherever you already hold them. Payrail does not sell, swap or bridge tokens; we only read and match payments. Before relying on any source, check that the token you receive is the contract above, on chain id 4663. A token with the same name on another deployment will not pay a Payrail invoice.

### Why does the pay page use a relay instead of the public RPC?

The public RPC, `https://rpc.mainnet.chain.robinhood.com`, is content-filtered by some ISPs, which would make the pay page unusable on those connections. The browser and the wallet therefore talk to `POST /api/rpc/4663` on the same origin, which forwards an allow-list of read and broadcast methods to the chain. The relay is a transport, not a trust boundary: nothing sent through it can make the server mark PAID. It is rate limited per IP.

### Can I verify a payment without Payrail?

Yes. The contract exposes `isPaid(invoiceId)` and `getPayment(invoiceId)` to anyone, and the invoice page shows the key under Payment key (onchain). Blockscout at `https://robinhoodchain.blockscout.com/tx/<hash>` shows the transaction and its `PaymentReceived` log. The chain is the source of truth; our database is a cache of it.

### Is the contract source verified on Blockscout?

Not yet. The verification step has been failing on a Cloudflare challenge. Until it goes through, compare the deployed bytecode against `contracts/contracts/PaymentProcessor.sol` in the repository, or read the 91 lines in [Contracts](/docs/contracts).

## Verification and status

### How does an invoice become PAID?

Two routes, one function. The fast route: after `pay()` confirms, the pay page posts the `txHash` to `POST /api/invoices/:id/verify`; the server fetches the receipt, waits for confirmations, keeps only logs from the PaymentProcessor address, parses `PaymentReceived` and looks for `invoiceId == onchainId`. The certain route: the indexer scans `PaymentReceived` events from its last cursor to the safe head and applies each one. Both end in `applyPaymentLog`, which checks merchant and amount against the invoice and writes `Payment` plus `status = PAID` in one database transaction. See [Verification and the indexer](/docs/verification-and-indexer) and [Payment flow](/docs/payment-flow).

### What does the browser get to decide?

Nothing. The `txHash` only selects which receipt to read. Merchant and amount come from the event log in the receipt the chain returns, and from the invoice's own record. No byte from the browser is used to decide PAID except as a lookup key. Someone else's `txHash` fails the `invoiceId` check; a screenshot is not an input.

### How many confirmations?

The example configuration sets `CONFIRMATIONS_4663=2`; the global default is `CONFIRMATIONS=1`. The verify route answers `202` until the block has that many confirmations, and the pay page retries up to 20 times, 3 seconds apart. The indexer only scans up to `head - confirmations + 1`. There is no mechanism to revert PAID if a reorg happens after the threshold; raise the setting if you self-host and want more margin.

### Can an invoice be paid twice?

Not on chain and not in the database. The contract reverts `InvoiceAlreadyPaid(invoiceId)` when the key already holds a payment. The database has `invoiceId @unique` and `txHash @unique` on `Payment`, and `applyPaymentLog` returns `ok` without writing when a payment already exists, so two concurrent verifications produce one row.

### What are the status values?

| Status | Set by |
| --- | --- |
| PENDING | Creation |
| PAID | `applyPaymentLog`, from a `PaymentReceived` event |
| CANCELLED | The merchant, `DELETE /api/invoices/:id`, database only |
| EXPIRED | The next list, detail or stats read after `dueAt`, database only |

Only PAID reflects the chain. A CANCELLED or EXPIRED invoice can still be paid on chain, and when it is, it becomes PAID.

## Security and privacy

### What am I trusting?

The contract (small, reviewed, not independently audited), our backend (which decides PAID by reading the chain over RPC), the RPC provider (which can delay what we see but cannot fabricate a receipt), the token issuer (who can freeze addresses; a frozen merchant wallet makes that merchant's invoices unpayable), and your wallet software. [Security](/docs/security) and [Risks and limits](/docs/risks-and-limits) go through each one.

### Can someone else create invoices in my name?

Yes, today. There is no authentication on the API, so anyone can create an invoice for any registered merchant and send the link to your client. If it is paid, the tokens still go to your wallet, because the merchant address comes from the database, not from whoever made the invoice. Annoying, not theft. Merchant authentication is the fix and is not built yet.

### Can a bad actor lock my invoice by paying it wrong?

Not since v2. The key binds salt, merchant and amount, so paying one unit to themselves lands on a different key and the real invoice stays payable. Two regression tests and the end-to-end script replay exactly this attack against the contract. See [Contracts](/docs/contracts).

### What data do you store and who can see it?

We store what you type into an invoice (description, amount, customer name), the merchant name and wallet address, the transaction hash and payer address of each verified payment, and a push subscription if you turn on Notify me when paid. The site sees your public wallet address when you connect, plus ordinary request data such as IP address and browser type, used to serve the site and spot abuse. No passwords, no identity verification, no advertising, no cross-site tracking. See [Privacy](/privacy).

Payment links are public to anyone holding the URL, and payments sit on a public chain forever. Do not put secrets in the description or the customer name.

### How do I know a pay page is real?

The real page is served only from `https://payrail.tech`, and the wallet prompt is the last screen before you sign: it shows the contract address and the arguments. If the contract is not `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D`, stop. If the merchant address is not the one you expect, stop. A copied page pointing at the real contract with a different merchant sends your tokens to a stranger and leaves the real invoice PENDING.

## Self-hosting and API

### Can I run my own instance?

Yes. It is a Next.js 14 app with Prisma (SQLite by default), pointed at the deployed contract by `web/src/lib/deployments.json`. Set `NEXT_PUBLIC_CHAINS=4663`, `NEXT_PUBLIC_APP_URL`, `CONFIRMATIONS_4663`, a real `INDEXER_SECRET`, and something to call `POST /api/indexer` on a schedule. [Self-hosting](/docs/self-hosting) has the full variable table and the misconfigurations that silently stop invoices turning PAID.

### Is there an API?

Every screen in the app is a call to `/api/*`, and you can call the same endpoints directly: create merchants and invoices, list and export them, verify a transaction hash, read stats. All JSON; amounts are strings in smallest units. No authentication on any route except the indexer secret. [API](/docs/api) documents each one.

```bash
curl -X POST https://payrail.tech/api/invoices \
  -H "content-type: application/json" \
  -d '{"merchantId":"<id>","description":"Design work","amount":"250"}'
```

### How does the indexer get triggered?

`POST /api/indexer` with the `x-indexer-secret` header runs one scan; nothing inside the app schedules it. Call it from cron, a systemd timer, or `web/scripts/indexer-loop.mjs` for local work. It is idempotent, so running it often or overlapping it with the fast route is safe. If `INDEXER_SECRET` is unset the route returns `401` and the safety net is off.

### Can I point it at a different token or chain?

Not without deploying a new contract. `usdc` is `immutable`, set in the constructor, so it is one deployment per token per chain. A chain listed in `NEXT_PUBLIC_CHAINS` without a PaymentProcessor address in `deployments.json` (or the `NEXT_PUBLIC_*_ADDRESS_<id>` overrides) cannot take invoices: `POST /api/invoices` returns `400` for it. Payrail runs on Robinhood Chain; the testnet and local Hardhat exist for rehearsal and development.

## Legal

### Are you a money transmitter?

We cannot give you a legal opinion. What we can state is what the software does: Payrail is reconciliation software, not a payment service provider, bank or custodian. It never holds, receives, forwards or has access to anyone's funds; tokens move from the buyer's wallet to the merchant's wallet in the buyer's own transaction, and we read the result. Which rules apply to you depends on where you are and what you sell. See [Terms](/terms).

### Can I get a refund?

Not through Payrail. Blockchain transactions are final and we never hold the tokens, so there is nothing on our side to reverse. A refund is a new transfer from the merchant's wallet to the buyer's, arranged between the two of you. A cancelled invoice that gets paid anyway is the same case: the merchant refunds by hand.

### What about taxes?

We cannot advise. Payrail records amounts, dates, payers and transaction hashes, and the CSV export gives you the rows, but it applies no tax, no discount and no currency conversion. Your tax position is yours, under the rules of wherever you live and sell.

---

*Still stuck? [Troubleshooting](/docs/troubleshooting) lists the error messages; support@payrail.app reads the rest.*
