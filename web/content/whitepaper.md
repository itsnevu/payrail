---
title: "Payrail: Non-Custodial USDG Payment Reconciliation"
description: "The design, mechanics and failure modes of Payrail: invoices that carry their key into the transaction, a contract that never holds funds, and two idempotent verification routes on Robinhood Chain."
date: 2026-09-20
---

# Payrail: Non-Custodial USDG Payment Reconciliation

## Abstract

Merchants who accept stablecoin payments face the same problem as merchants who accept bank transfers: money arrives without saying which bill it pays. Payrail solves this by making the **payment transaction carry the invoice key** as an argument to a contract, which forwards the dollar token directly to the merchant and emits a structured event. The backend matches the event to an invoice with four checks (key, chain, recipient, exact amount) and marks it PAID. The contract never holds funds, has no owner, and cannot be changed. Verification is idempotent and runs over two independent routes so that no payment is missed because of a client failure.

Payrail runs on one network, **Robinhood Chain** (chain id 4663), with one dollar token. The app labels amounts USDG; the token moved on Robinhood Chain is USDG (Global Dollar, 6 decimals). Every invoice is pinned to the network it was created on, and the design of the key makes a payment on any other deployment harmless. This document describes the system as the code implements it on 20 September 2026, including what it does not do.

## 1. Motivation

### 1.1 The reconciliation problem

Payment matching is invisible, unpaid work. A transfer, bank or onchain, carries an amount, a time and a sender. None of them is a bill identifier. When two clients each owe 250.00 and both pay on the same afternoon, the merchant has two transfers, two open invoices, and no way to tell which is which except by asking.

That question is the whole product. "I sent it, please check" arrives with a screenshot, the merchant opens an explorer or a bank statement, scrolls, guesses, and updates a spreadsheet. Wrong guesses produce awkward conversations. Right guesses still cost ten minutes each, and the ten minutes are never on an invoice.

This is not a payment problem. The money arrives. It is a matching problem: connecting the money that came in with the bill that went out. A plain stablecoin transfer makes it worse, not better, because it carries even less than a bank transfer: no reference field, no memo, no payer name. If you bill in a stablecoin and wait for clients to send to your address, you have only moved the spreadsheet into an explorer.

### 1.2 Why custody is the wrong fix

Existing solutions generally become **custodial intermediaries**. Funds go to the provider, the provider matches, then forwards to the merchant minus a fee and a delay. This trades a matching problem for a trust problem, and adds a point of failure exactly in the path of the money. It also inverts the reason to accept a stablecoin in the first place: the merchant chose an asset that settles to their own wallet, then handed it to a third party so a database could be updated.

### 1.3 What a chain makes possible

A public chain allows a third way: a payment that **names itself** without an intermediary holding anything. A contract can accept a bill key as an argument, forward the buyer's funds to the merchant in the same call, and record that fact as an event that cannot be faked. Anyone can read the event. Nobody can write it without moving the money. Payrail is a minimal implementation of that idea, and the rest of this document is the detail.

## 2. Design goals

Five goals shaped every decision below. Where they conflict with convenience, the goal won.

| Goal | What it means in the code |
| --- | --- |
| **Non-custodial** | The contract forwards, it does not hold. The only token movement is `safeTransferFrom(msg.sender, merchant, amount)`. Its balance is zero structurally, not by policy. There is no withdrawal step because there is nothing to withdraw. |
| **Verifiable** | PAID is decided from a `PaymentReceived` event read from the chain, never from a claim by the browser. The chain is the source of truth; the database is a cache that can be rebuilt from events. |
| **Minimal** | No owner, pause, withdraw, upgrade or adjustable parameter. Whatever can happen offchain happens offchain. Every extra line in a contract is a line that cannot be fixed after deployment. |
| **Idempotent** | One function, `applyPaymentLog`, is the only path to PAID. Running it twice, ten times, or from two processes at once yields one `Payment` row, enforced by a check and two unique constraints. |
| **One chain, one token** | Robinhood Chain and one dollar token. Each invoice is pinned to its `chainId`. Supporting one deployment well is a smaller surface than supporting several badly. |

A sixth principle follows from the second: **clients give hints, not claims**. No byte from the browser is used to decide PAID except as a lookup key into onchain data. The `txHash` a buyer's browser sends is a pointer, "look over there", and nothing more.

## 3. System overview

Payrail is four pieces of software and two things it does not run.

| Component | What it does | Who runs it |
| --- | --- | --- |
| `PaymentProcessor` contract | Derives the key, forwards the token, records the payment, emits the event | Nobody. Deployed once on Robinhood Chain with no owner |
| Web app (Next.js) | Merchant dashboard, invoice creation, payment page, JSON API, same-origin RPC relay | Payrail at `https://payrail.tech`, or anyone who self-hosts |
| Database (Prisma, SQLite by default) | `Merchant`, `Invoice`, `Payment`, `IndexerState`, `PushSubscription` | The same operator as the web app |
| Indexer trigger | Calls `POST /api/indexer` on a schedule so payments made outside the UI are found | The operator, with cron or the bundled loop script |
| Buyer's wallet | Signs `approve` and `pay` | The buyer. Injected (browser extension) wallets always; WalletConnect only when the operator sets a project id |
| RPC and explorer | Reads and broadcasts to the chain; Blockscout shows transactions | Robinhood Chain's public RPC and Blockscout, third parties |

The shape of a payment, end to end:

```
merchant                  Payrail app               Robinhood Chain              buyer
   |  create invoice  ------>  |                          |                          |
   |  <------ /pay/<id> link   |                          |                          |
   |  send the link ----------------------------------------------------------->     |
   |                           |  <-------- GET /api/invoices/<id> --------------    |
   |                           |                          |  <--- approve(pp, amt)   |
   |                           |                          |  <--- pay(salt, m, amt)  |
   |                           |                          |  transfer buyer -> m     |
   |                           |                          |  emit PaymentReceived    |
   |                           |  <-------- POST /verify {txHash} ---------------    |
   |                           |  receipt + event ----->  |                          |
   |                           |  applyPaymentLog: PAID   |                          |
   |  dashboard shows PAID     |                          |                          |
   |                           |  POST /api/indexer (cron) scans events as a safety net
```

The merchant never touches the contract. The buyer never touches the database. The app never touches the money.

## 4. Data model

### 4.1 Offchain entities

Five tables in `web/prisma/schema.prisma`. Amounts are strings in smallest units (6 decimals) so nothing is ever rounded.

| Entity | Key | Contents |
| --- | --- | --- |
| `Merchant` | `id` (cuid) | `name`, `walletAddress` (unique, checksummed), `createdAt` |
| `Invoice` | `id` (cuid) | `onchainId` (unique), `chainId`, `merchantId`, `customerName?`, `description`, `amount`, `status`, `dueAt?`, `createdAt`, `updatedAt` |
| `Payment` | `id` | `invoiceId` (unique), `chainId`, `txHash` (unique), `payer`, `amount`, `blockNumber`, `paidAt` |
| `IndexerState` | `chainId` | `lastBlock`, one cursor per chain |
| `PushSubscription` | `id` | `merchantId`, `endpoint` (unique), `p256dh`, `auth`, `userAgent?` |

`Merchant.name` is display only. The contract uses the address. Registering upserts by checksummed wallet, so one wallet is one merchant and a second registration only renames it.

`Invoice.status` is one of PENDING, PAID, EXPIRED, CANCELLED, stored as a string because SQLite has no enums. The implemented transitions are PENDING to PAID (by verification), PENDING to CANCELLED (by `DELETE /api/invoices/:id`), and PENDING to EXPIRED (by `expireOverdueInvoices`, which flips overdue PENDING invoices at the top of every list, detail and stats read). There is no scheduler, and the contract knows nothing about any of it. `DELETE` also overwrites EXPIRED with CANCELLED, since it only refuses PAID.

### 4.2 Onchain state

The contract stores one mapping: `bytes32 => Payment{payer, amount, merchant, paidAt}`. It does not store invoices, descriptions, due dates or merchant names. Moving that knowledge onchain would make every invoice a transaction (gas for the merchant, latency on creation) and every invoice detail public. We chose to keep it offchain.

### 4.3 Key derivation

The bridge between the two worlds is the payment key, computed in `web/src/lib/usdc.ts` and again, independently, inside the contract:

```
salt      = keccak256(bytes(invoice.id))
onchainId = keccak256(abi.encode(salt, merchant.walletAddress, amountUnits))
```

`invoice.id` is a random 25-character cuid, so `salt` cannot be guessed and does not collide in practice. The key binds the salt to the **terms**: the recipient and the exact amount. It is computed after the row is created (to obtain the `id`) and stored lowercase in the unique `onchainId` column. When the buyer calls `pay(salt, merchant, amount)`, the contract recomputes the same `keccak256` from the three arguments, so the database and the chain agree by construction rather than by lookup.

One name, three places: the `onchainId` column, the `invoiceId` in the event, and the "Payment key (onchain)" shown on the invoice page are the same 32 bytes.

The key does not include the chain. The same terms hash to the same `bytes32` on every deployment. `Invoice.chainId` is what pins an invoice to Robinhood Chain, and section 6.1 shows how the backend uses it.

## 5. The contract

`contracts/contracts/PaymentProcessor.sol`, 91 lines, `pragma solidity 0.8.24` (pinned), on OpenZeppelin 5. The full source, with the comments trimmed and annotations added:

```solidity
contract PaymentProcessor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // The token is fixed at construction. One deployment per token per chain.
    IERC20 public immutable usdc;

    // Ordered to pack into two storage slots: (payer, amount) and (merchant, paidAt).
    struct Payment {
        address payer;
        uint96 amount;
        address merchant;
        uint64 paidAt;
    }

    // invoiceId => payment. amount > 0 means already paid.
    mapping(bytes32 => Payment) private _payments;

    event PaymentReceived(
        bytes32 indexed invoiceId,
        bytes32 indexed salt,
        address indexed merchant,
        address payer,
        uint256 amount,
        uint256 timestamp
    );

    error InvalidToken();
    error InvalidMerchant();
    error InvalidAmount();
    error InvoiceAlreadyPaid(bytes32 invoiceId);

    // Refuses the zero address and any address without code as the token.
    constructor(address usdc_) {
        if (usdc_ == address(0) || usdc_.code.length == 0) revert InvalidToken();
        usdc = IERC20(usdc_);
    }

    // Pure, so the backend and any third party can compute it offchain and compare.
    function invoiceKey(bytes32 salt, address merchant, uint256 amount) public pure returns (bytes32) {
        return keccak256(abi.encode(salt, merchant, amount));
    }

    // The buyer must have approved at least `amount` to this contract first.
    function pay(bytes32 salt, address merchant, uint256 amount) external nonReentrant {
        // 1. Reject terms that can never be a real invoice.
        if (merchant == address(0) || merchant == address(this)) revert InvalidMerchant();
        if (amount == 0 || amount > type(uint96).max) revert InvalidAmount();

        // 2. The key is the terms.
        bytes32 invoiceId = invoiceKey(salt, merchant, amount);
        if (_payments[invoiceId].amount != 0) revert InvoiceAlreadyPaid(invoiceId);

        // 3. Record first (checks-effects-interactions), then move funds.
        _payments[invoiceId] = Payment({
            payer: msg.sender,
            amount: uint96(amount),
            merchant: merchant,
            paidAt: uint64(block.timestamp)
        });

        // 4. Straight from buyer to merchant. The contract is never the recipient.
        usdc.safeTransferFrom(msg.sender, merchant, amount);

        // 5. The event the backend matches on.
        emit PaymentReceived(invoiceId, salt, merchant, msg.sender, amount, block.timestamp);
    }

    function isPaid(bytes32 invoiceId) external view returns (bool) {
        return _payments[invoiceId].amount != 0;
    }

    function getPayment(bytes32 invoiceId) external view returns (Payment memory) {
        return _payments[invoiceId];
    }
}
```

If `safeTransferFrom` reverts (no allowance, no balance, a token that returns `false`), the whole call reverts and the `Payment` write in step 3 is undone with it. Nothing is recorded that did not move money.

### 5.1 Invariants

- **One payment per key.** Enforced by the `amount != 0` check before the write, with `nonReentrant` closing the reentrancy window. Because `amount == 0` is rejected, `amount != 0` is an exact proxy for "already paid".
- **The key is the terms.** `invoiceId` is a pure function of `(salt, merchant, amount)`. Two calls with different terms can never collide on a key, and a call with the wrong terms cannot occupy the key of a real invoice.
- **Contract balance is zero.** The only token movement is `safeTransferFrom(msg.sender, merchant, amount)`. No code path makes the contract a recipient, and `merchant == address(this)` is rejected explicitly.
- **No authority.** No `owner`, `pause`, `withdraw`, `upgrade`, or adjustable parameter. `usdc` is `immutable` and must be a deployed contract at construction.
- **Two storage slots per payment.** `Payment` packs as `(payer, amount:uint96)` and `(merchant, paidAt:uint64)`. Amounts above `2^96 - 1` smallest units are rejected; that is about 7.9e22 whole tokens, far beyond any supply.
- **Anyone can pay any invoice.** `msg.sender` is recorded as `payer` but never compared to anything. A client can pay from a different wallet than the one that opened the link, from a script, or from a multisig.

### 5.2 What the contract does not know

The contract cannot tell whether a `(salt, merchant, amount)` triple corresponds to a real invoice. Someone who calls `pay()` by hand with a made-up salt moves their token to whatever `merchant` they named and records a payment under a key that no invoice will ever have. That is their money and their mistake; the contract has no way to refuse it and no reason to.

It also does not know about due dates, cancellation, or the merchant's name. All of that lives in the database, and section 6.6 describes what happens when the two disagree. `block.timestamp` is recorded as `paidAt` for information only and is never used for logic.

### 5.3 What v1 got wrong

The first version keyed only on a caller-supplied invoice id; `merchant` and `amount` were extra arguments that did not enter the key. A third party who saw a payment link could call it with themselves as merchant and one unit as the amount. The contract consumed the key, and the real invoice could never be paid. Annoying, not theft, but unfixable after the fact.

v2 closes this by deriving the key from all three terms. A wrong-terms call now lands on a key nobody else will ever use. Both the unit tests and the local end-to-end script (`web/scripts/e2e-local.mjs`) perform the attack and confirm the real buyer can still pay.

### 5.4 Tests

Eleven tests in `contracts/test/PaymentProcessor.test.ts`, run with Hardhat against `MockUSDC` and a `FalseReturnToken` that exists only to prove `SafeERC20` turns a `false` return into a revert.

| Group | Test |
| --- | --- |
| constructor | rejects the zero address and non-contract addresses as the token |
| invoiceKey | matches the offchain derivation |
| invoiceKey | changes when any term changes |
| pay | transfers USDG straight to the merchant, records the payment and emits the event |
| pay | rejects paying the same terms twice |
| pay | rejects zero amount, amounts above uint96, zero merchant and the contract itself as merchant |
| pay | reverts without allowance and without balance, and records nothing |
| pay | reverts when the token returns false instead of reverting (SafeERC20) |
| pay | lets anyone pay an invoice, not only the buyer who opened the link |
| griefing resistance | paying the wrong merchant with a known salt does not lock the real invoice |
| griefing resistance | paying the wrong amount to the right merchant does not lock the real invoice |

There is no continuous integration. The tests run on a developer's machine.

### 5.5 Review status

The contract has had two internal review passes. The second, on 17 September 2026, produced eight findings (one High, one Medium, three Low, three Info), all resolved. **This is not an independent audit.** Nobody outside the project has reviewed the code, and we say so on the landing page, in the terms, and in the footer of every documentation page.

> **Warning:** Not audited. If you bill real money through Payrail today, you are trusting about 90 lines of Solidity on the strength of eleven tests and two internal reviews. Read [/docs/risks-and-limits](/docs/risks-and-limits) first.

### 5.6 Deployment

`contracts/scripts/robinhood.mjs` (`npm run go:robinhood`) needs only `DEPLOYER_PRIVATE_KEY`. It picks a working RPC, checks the deployer's ETH, probes the token on chain for code, symbol and `decimals == 6`, deploys, attempts Blockscout source verification (non-fatal), and writes `contracts/deployments/<chainId>.json` and `web/src/lib/deployments.json`. The Robinhood Chain deployment record is dated `2026-09-19T18:58:30.729Z`. Blockscout source verification is still pending.

## 6. Verification

Every route to PAID ends in one function. This section describes that function first, then the two ways of reaching it.

### 6.1 `applyPaymentLog`

`web/src/lib/verify.ts` exports `applyPaymentLog(chainId, log, txHash, blockNumber)`. It receives one parsed `PaymentReceived` event, the chain it was seen on, and where it was seen. In pseudocode:

```
applyPaymentLog(chainId, event, txHash, blockNumber):
  invoice <- Invoice where onchainId = lower(event.invoiceId)
  if none                                             -> reject "no invoice found for this onchainId"
  if invoice.payment exists                           -> ok (already processed)
  if invoice.chainId != chainId                       -> reject "invoice is on <A>, payment was on <B>"
  if event.merchant != invoice.merchant.walletAddress -> reject "merchant mismatch"
  if event.amount != invoice.amount                   -> reject "amount mismatch: X != Y"
  atomically: create Payment{chainId, txHash, payer, amount, blockNumber, paidAt}
              invoice.status <- PAID
  then, fire and forget: Web Push "Invoice paid" to the merchant's devices
```

Four properties matter.

**The arguments come from the event.** Merchant and amount are read from a log that consensus put in a block. The request that triggered the call contributed at most a `txHash`.

**The amount must match exactly.** `event.amount !== BigInt(invoice.amount)` rejects. Since v2 the key already binds merchant and amount, so a matching `invoiceId` implies matching terms; the two explicit checks remain as defense in depth against a wrong deployment address or a wrong ABI. An overpayment or underpayment is a different key and never reaches the invoice at all.

**The chain must match.** The key is the same `bytes32` on every deployment, so the function refuses an event from a chain other than `invoice.chainId`. A payment of the right terms on the testnet lands under the same key there and leaves the real invoice untouched.

**It is idempotent.** The `payment exists` check returns `ok` without writing. If two processes pass that check at the same moment, `Payment.invoiceId @unique` and `Payment.txHash @unique` make the second insert fail on the constraint inside its transaction. Whoever arrives second sees the payment already exists and goes home.

The function does not check `payer` (anyone can pay), `status` (a CANCELLED or EXPIRED invoice becomes PAID) or `dueAt`. Section 6.6 explains why.

### 6.2 Route 1: the receipt

After `pay()` confirms in the buyer's wallet, the payment page calls `POST /api/invoices/:id/verify {txHash}`. The server, on the invoice's own chain:

1. fetches the receipt; none yet: `202` with `"transaction not found or not mined yet"`;
2. checks `status == success`; otherwise `400` with `"transaction reverted"`;
3. checks `head - receipt.blockNumber + 1 >= confirmations`; otherwise `202` with `"waiting for confirmations"`;
4. keeps only the logs whose `address` is this chain's `PaymentProcessor`;
5. parses `PaymentReceived` and finds `invoiceId == invoice.onchainId`; none: `400` with `"no PaymentReceived event for this invoice in the tx"`;
6. calls `applyPaymentLog` with the event's arguments; `200` on `ok`.

The browser retries a `202` up to 20 times with a 3 second pause, then tells the buyer to refresh. A `400` is final and shows its reason. Someone else's `txHash` or a transfer that did not go through the contract fails at step 4 or 5. The `txHash` only selects which receipt to read.

This is the fast route: it runs as soon as the receipt exists, and it needs the buyer's browser to still be open.

### 6.3 Route 2: the indexer

`POST /api/indexer`, guarded by the `x-indexer-secret` header, runs `runIndexerFor(chainId)` for every enabled chain in parallel. For each chain:

```
head     = getBlockNumber()
safeHead = head - confirmations + 1
from     = IndexerState.lastBlock + 1, or safeHead - 5000 on first run
for each 2,000-block window in [from, safeHead]:
    for each PaymentReceived emitted by PaymentProcessor in the window:
        applyPaymentLog(chainId, event, txHash, blockNumber)
IndexerState[chainId].lastBlock = safeHead
```

The indexer catches everything the receipt route can miss: a closed tab, a dropped connection, a payment made from a script or a multisig that never saw the payment page, a verification that timed out on confirmations. Because `applyPaymentLog` is idempotent, the indexer can run as often as the operator likes and overlap the receipt route without side effects. A chain that errors returns `{chainId, error}` and does not stop the others.

There is no scheduler inside the app. The operator triggers the route with cron or with `web/scripts/indexer-loop.mjs`; the interval is an operational choice, not a product parameter.

### 6.4 Convergence

The two routes are not a primary and a backup. They are two readers of the same log, and both end in the same function with the same arguments. Whichever runs first writes the row; the other finds it and returns `ok`. If the receipt route fails because the RPC is slow, the indexer finds the event on its next pass. If the `Payment` table is lost, the indexer rebuilds it from events, with two conditions: the `Invoice` and `Merchant` rows must still exist (or be restored from an ordinary backup), because `applyPaymentLog` looks each event up by `onchainId`, and the cursor must reach back far enough. A fresh `IndexerState` starts 5,000 blocks behind the head, so older payments need the cursor set back by hand.

Convergence holds because PAID is a function of the chain, not of the order in which the app heard about it.

### 6.5 Confirmations and reorgs

`confirmationsFor(chainId)` reads `CONFIRMATIONS_<chainId>`, then `CONFIRMATIONS`, then defaults to `1`. The shipped `.env.example` sets `CONFIRMATIONS_4663=2`. Both routes wait for it: the receipt route at step 3, the indexer through `safeHead`.

It is the only defence against reorgs. If the block holding a payment is reorged out after the threshold, the invoice stays PAID and the transaction may vanish. There is **no mechanism to revert PAID**. We accept this as the price of an append-only database, and the mitigation is to raise the threshold, not to add a rollback path that would itself need to be trusted.

### 6.6 What verification ignores

`applyPaymentLog` does not consult `status` or `dueAt`. That is deliberate, and it has consequences.

**Cancelled but paid anyway.** `DELETE /api/invoices/:id` only changes the database. The contract does not know. A payer who already holds the `pay()` arguments can still send them; the token reaches the merchant, the event is emitted, the indexer applies it, and the invoice becomes PAID. The merchant has received money they may have to refund by hand.

**Expired but paid anyway.** The same applies to EXPIRED. The payment page refuses to show a Pay button for an EXPIRED invoice, but nothing stops a direct call to `pay()`.

Checking `status` inside `applyPaymentLog` would make the database disagree with the chain: money moved, event emitted, invoice still PENDING. We would rather the row say PAID and the merchant handle the refund than have the record lie.

### 6.7 Notifications

When `applyPaymentLog` writes PAID it also calls `notifyMerchant`, which sends a Web Push message ("Invoice paid") to every device the merchant subscribed from the dashboard. Push is optional: it works only when the operator has set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, and without them every call is a no-op. A push failure never fails the verification. There are no HTTP webhooks.

## 7. Robinhood Chain

### 7.1 Why this network

Payrail runs on **Robinhood Chain**, an Arbitrum Orbit L2 with ETH as the gas token. It is the only network Payrail runs on. Three properties of the choice matter for the design.

**Gas is paid in ETH.** A payment is one `approve` and one `pay`, or one `pay` when the allowance already covers it. The buyer needs a little ETH on Robinhood Chain on top of the dollar token. We do not quote a gas figure because it is not ours to promise.

**The contract needed no changes.** The same Solidity that runs on the local Hardhat node runs on Robinhood Chain. The deploy script only checks that the token at the configured address has code, a symbol and six decimals before it deploys.

**A single deployment keeps the trust surface small.** One contract address, one token address, one explorer to check. The merchant can verify the whole system with two bookmarks.

### 7.2 USDG and the USDG label

The dollar token on Robinhood Chain is **USDG** (Global Dollar), 6 decimals, at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. The app was written with the label "USDG" and still shows it everywhere: the amount field, the payment page, the CSV header `amount_usdc`, the push message. The contract's storage variable is called `usdc`. **On Robinhood Chain the token that moves is USDG.** The label is a naming debt, not a second token. Anyone reading the contract's `usdc()` view sees the USDG address.

> **Note:** Wherever this document or the app says USDG, read it as the dollar token at the address above. On Robinhood Chain that is USDG. Payrail does not claim any particular issuer for it.

### 7.3 The RPC relay

Robinhood Chain's public RPC, `https://rpc.mainnet.chain.robinhood.com`, is content-filtered by some ISPs. On those connections a payment page that talked to the RPC directly would hang. The browser and the wallet therefore use a same-origin relay, `POST /api/rpc/4663`, which forwards an allow-list of read and broadcast methods from the server. The chain definition the wallet is asked to add lists the relay first and the public RPC second.

The relay is a transport choice, not a trust boundary. It cannot invent a receipt; it can only forward what the upstream RPC returns. The decision to mark PAID still comes from a log that consensus put in a block, and `getPayment(invoiceId)` is readable by anyone through any RPC without going through Payrail. The relay is rate-limited per IP, refuses bodies over 256 KB and batches over 50, and relays only the methods in Appendix A.

### 7.4 Networks

| Network | Chain id | Status | Explorer |
| --- | --- | --- | --- |
| Robinhood Chain | 4663 | Live. The only network the hosted deployment enables | `https://robinhoodchain.blockscout.com` |
| Robinhood Chain Testnet | 46630 | Configured, no deployment yet | `https://explorer.testnet.chain.robinhood.com` |
| Hardhat (local) | 31337 | Development only, with `MockUSDC` | none |

Which chains a deployment enables is decided by `NEXT_PUBLIC_CHAINS`; the hosted deployment at `https://payrail.tech` enables `4663` only. Every invoice is pinned to one `chainId` at creation. The payment page refuses an invoice whose chain is not enabled and asks the buyer to request a new link.

## 8. Threat model and trust assumptions

### 8.1 What you are trusting

| Party | What they could do | What they cannot do |
| --- | --- | --- |
| The contract | Contain a bug. About 90 lines, eleven tests, two internal reviews, not independently audited | Hold, redirect or withhold funds. It has no balance and no owner |
| Payrail's backend | Mark an invoice PAID late, or not at all, if misconfigured (wrong address, lying RPC) | Mark an invoice PAID without a matching event on chain, or move money |
| The RPC provider | Hide a transaction, so the invoice looks unpaid for longer | Fabricate a transaction that is not on chain |
| The token issuer | Freeze an address. A frozen merchant wallet makes `transferFrom` revert and that merchant's invoices unpayable | Anything Payrail can influence. Out of our control |
| Robinhood Chain | Reorg a block after the confirmation threshold | Anything Payrail can influence beyond raising `CONFIRMATIONS` |

### 8.2 Failure modes

| Scenario | What happens | Mitigation |
| --- | --- | --- |
| Browser sends someone else's `txHash` | Fails the `invoiceId` check in step 5 | Built in |
| Attacker pays 1 unit to themselves with a known `salt` | Lands on a different key; real invoice untouched | Closed in v2. Regression tests in `contracts/test` and `web/scripts/e2e-local.mjs` |
| Someone calls `pay()` by hand with the wrong merchant or amount | Token goes where they pointed it, recorded under a different key; real invoice untouched | No fund recovery for the mistaken payer; the invoice remains payable |
| Under- or overpayment | Different key; the invoice stays PENDING; the token reaches the merchant | Merchant settles by hand. No partial payments |
| Invoice CANCELLED or EXPIRED, then paid on chain | `applyPaymentLog` does not check status, so PAID | Known and documented. Merchant refunds by hand |
| Reorg after `CONFIRMATIONS` | PAID stays; the transaction may vanish | Raise `CONFIRMATIONS_4663` |
| RPC hides a transaction, or the public RPC is filtered | Invoice looks PENDING for longer | Same-origin relay for the browser; `RPC_URL_4663` can point the server at a second provider; `getPayment()` is readable by anyone |
| Database lost | All status lost | Restore `Merchant` and `Invoice` from backup; the indexer then rebuilds `Payment` from events, once its cursor is set back far enough (a fresh cursor starts 5,000 blocks behind the head) |
| Another contract emits `PaymentReceived` | Ignored by the address filter | Built in |
| Same terms paid on another deployment (the testnet, a local node) | Same key, other chain; `applyPaymentLog` rejects by `chainId` | Built in; the wallet is switched to Robinhood Chain before paying |
| Invoice creation without authentication | Spam invoices; fake links in a merchant's name | Funds still go to the merchant's own wallet. Annoying, not theft. Authentication is the first item in section 11 |

### 8.3 What is public

Payment links are public. Anyone holding `/pay/<id>` sees the description, the amount, the merchant's name and wallet, and the contract address. The JSON the page loads from `GET /api/invoices/:id` also carries the customer name and the payment key, and it answers without authentication, as does every other endpoint except the indexer. Do not put secrets in a description.

## 9. Limitations and what is not built

Everything in this section is true of the code today. None of it is a euphemism.

**Not independently audited.** Two internal review passes, eleven tests and one attack replay are not a third-party audit.

**No merchant authentication.** There is no login. Anyone can create invoices for any registered merchant, list them, or cancel them. Money still goes only to the merchant's registered wallet, because the address comes from the database. Wallet-signature sign-in (SIWE) is required before this can be called production-grade.

**No webhooks.** Web Push to the merchant's devices exists and is optional. There is no HTTP callback to a merchant's server. Integrators poll `GET /api/invoices/:id` or the CSV export.

**No escrow, no refunds, no disputes, no reversals.** Funds go straight to the merchant in the same transaction. If you need a hold until goods arrive, that is a different product, and it will not be an evolution of this contract, because it would break the first goal in section 2.

**No partial payments, instalments, taxes or discounts.** One invoice, one `pay()`, exactly `amount`.

**Cancel is database-only.** A cancelled invoice can still be paid on chain and becomes PAID.

**Expiry is lazy and offchain.** Overdue invoices are marked EXPIRED when read. There is no scheduler and the contract does not know about it.

**No reorg recovery.** After `CONFIRMATIONS`, PAID is permanent in the database.

**One token, one chain.** A payment on any other network does not count and has to be refunded by hand.

**The UI says USDG.** The token on Robinhood Chain is USDG. See section 7.2.

**Blockscout source verification is pending.** The bytecode is on chain at the address in Appendix A and the source is in the repository; the explorer does not yet show them side by side.

**SQLite by default, WalletConnect optional.** PostgreSQL and WalletConnect are configuration choices the operator makes, not things the repository ships switched on. Injected wallets always work.

## 10. Comparison

Three ways a merchant can accept a dollar payment and know which invoice it closed, next to Payrail.

| | Bank transfer, reconciled by hand | Custodial crypto processor | Raw wallet transfer | Payrail |
| --- | --- | --- | --- | --- |
| Who holds the money in transit | The banks | The processor | Nobody | Nobody |
| What links payment to invoice | A reference field the payer may fill in | The processor's database | Nothing | The key in the transaction |
| Who decides "paid" | The merchant, by reading a statement | The processor | The merchant, by reading an explorer | A `PaymentReceived` event, read by software |
| Can "paid" be faked | A misread line, a doctored screenshot | Only by the processor | A doctored screenshot | Not without moving the money |
| Fee | Bank fees | Processor fee | Gas | Gas. No Payrail fee |
| Settlement to the merchant | Same or next business day | On the processor's schedule | Same block | Same block |
| Can the merchant self-verify | Yes, against the bank | Only through the processor | Yes, against the chain | Yes, against the chain, without Payrail |
| Failure of the intermediary | Bank holiday, frozen account | Hack, insolvency, freeze | None | Late status only; funds unaffected |

**Versus bank transfer reconciliation.** A bank transfer has a reference field, and nothing makes the payer fill it in. Payrail makes the reference mandatory and machine-checked: it is an argument to the contract, and a payment without it is not a Payrail payment. The reconciliation step is not faster; it is gone.

**Versus custodial processors.** A custodial processor solves matching by owning the money for a while, at the cost of a fee, a delay, and the risk that the processor is the next thing to fail. Payrail's contract has no balance, so there is nothing to hack, freeze or lose. The trade is that Payrail cannot do anything a custodian does: no refunds, no disputes, no holds.

**Versus raw wallet transfers.** A plain transfer to the merchant's address is non-custodial and carries nothing; the merchant is back to the spreadsheet, now with 42-character identifiers. Payrail keeps everything about the raw transfer (same block, same wallet, no fee, no custody) and adds the one thing it lacked: the payment says the name of its own bill.

## 11. Roadmap

What we intend to do, in roughly this order, with no dates attached. An item is here because the repository already names it as missing, not because it is promised.

1. **Merchant authentication.** Wallet-based sign-in so that only the merchant can create, list and cancel their invoices. The README calls this required before production, and we agree.
2. **An independent audit** of `PaymentProcessor.sol`. The contract will not change to accommodate this; the point is to have someone else say so.
3. **Blockscout source verification** of the Robinhood Chain deployment, so the explorer shows the source next to the bytecode.
4. **Naming the token correctly.** Replacing the USDG label with the symbol of the token actually moved on Robinhood Chain.
5. **Webhooks.** An HTTP callback on PAID, alongside the existing Web Push, so integrators do not have to poll.
6. **Operational hardening of the hosted deployment.** A second RPC provider for the indexer, PostgreSQL in place of SQLite, and the confirmation threshold reviewed against observed reorg depth.

Escrow, partial payments and multi-chain support are not on this list. The first would be a different contract with a different risks page. The other two would enlarge the contract, and the contract is the one part that cannot be fixed later.

## 12. Conclusion

Payrail shows that stablecoin payment reconciliation on Robinhood Chain does not require a custodian. One contract with no balance, one hash linking an offchain invoice to an onchain event, and one idempotent function reached from two directions are enough to turn "I sent it, please check" into a status that changes on its own. Funds land in your wallet, not ours. The rest (authentication, webhooks, a second RPC) is ordinary application work that can be added without touching the part that cannot be changed.

## Appendix A. Addresses and ABI

### A.1 Robinhood Chain (4663)

| Item | Value |
| --- | --- |
| `PaymentProcessor` | `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D` |
| Token (USDG, 6 decimals) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Explorer | `https://robinhoodchain.blockscout.com/address/0xD591A0d397179dE0692d50f43AC450C6cDF9C66D` |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Browser relay | `https://payrail.tech/api/rpc/4663` |
| Gas token | ETH |
| Deployed | `2026-09-19T18:58:30.729Z` |

The addresses in `deployments.json` for chain 31337 are local Hardhat addresses and mean nothing on a public network.

### A.2 Event

```solidity
event PaymentReceived(
    bytes32 indexed invoiceId,   // keccak256(abi.encode(salt, merchant, amount))
    bytes32 indexed salt,        // keccak256(bytes(invoice.id))
    address indexed merchant,    // recipient of the funds
    address payer,               // msg.sender of pay()
    uint256 amount,              // smallest units, 6 decimals
    uint256 timestamp            // block.timestamp, informational
);
```

Topic 0: `0xc329fd6b1c9c59c2e10b244f1fc2eb47bcd4daf6880a3011462dbe7639271aaf`. Topics 1 to 3 are `invoiceId`, `salt` and `merchant`, so a merchant can filter every payment to their address with one `eth_getLogs` call and no help from Payrail.

### A.3 Functions and errors

| Selector | Signature | Notes |
| --- | --- | --- |
| `0x97d4df67` | `pay(bytes32 salt, address merchant, uint256 amount)` | `nonReentrant`; requires prior `approve` |
| `0x41d36d7c` | `invoiceKey(bytes32 salt, address merchant, uint256 amount)` | `pure` |
| `0xfeef6640` | `isPaid(bytes32 invoiceId)` | `view` |
| `0xe66eefc8` | `getPayment(bytes32 invoiceId)` | `view`, returns `(payer, amount, merchant, paidAt)` |
| `0x3e413bee` | `usdc()` | `view`, the token address |

| Error | When |
| --- | --- |
| `InvalidToken()` | Constructor: token is the zero address or has no code |
| `InvalidMerchant()` | `merchant` is the zero address or the contract itself |
| `InvalidAmount()` | `amount` is zero or above `type(uint96).max` |
| `InvoiceAlreadyPaid(bytes32 invoiceId)` | The key already has a payment |

### A.4 Relay allow-list

`POST /api/rpc/4663` forwards only these JSON-RPC methods: `eth_chainId`, `net_version`, `web3_clientVersion`, `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getBlockByHash`, `eth_gasPrice`, `eth_maxPriorityFeePerGas`, `eth_feeHistory`, `eth_estimateGas`, `eth_call`, `eth_getBalance`, `eth_getCode`, `eth_getStorageAt`, `eth_getTransactionCount`, `eth_getTransactionByHash`, `eth_getTransactionReceipt`, `eth_getLogs`, `eth_sendRawTransaction`. Anything else returns `-32601 Method not relayed`.

### A.5 Checking a payment without Payrail

One `eth_call` to `getPayment`, against the public RPC or any provider for chain 4663:

```bash
curl -s https://rpc.mainnet.chain.robinhood.com \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0xD591A0d397179dE0692d50f43AC450C6cDF9C66D","data":"0xe66eefc8<onchainId without 0x>"},"latest"]}'
```

`<onchainId>` is the "Payment key (onchain)" shown on the invoice page, 64 hex characters. The result is four 32-byte words: `payer`, `amount`, `merchant`, `paidAt`. A non-zero second word means the invoice is paid, whatever any database says.

## Appendix B. Glossary pointers

Short definitions of the terms this document uses, with the page that goes deeper.

| Term | Meaning | Read more |
| --- | --- | --- |
| **Salt** | `keccak256` of the invoice's random database id. First argument to `pay()` | [Contracts](/docs/contracts) |
| **Terms** | The triple `(salt, merchant, amount)` | [Contracts](/docs/contracts) |
| **Payment key, onchainId, invoiceId** | The same 32 bytes: `keccak256(abi.encode(terms))` | [Verification and the indexer](/docs/verification-and-indexer) |
| **PaymentReceived** | The event the backend matches on | [Verification and the indexer](/docs/verification-and-indexer) |
| **applyPaymentLog** | The one idempotent function that writes PAID | [Verification and the indexer](/docs/verification-and-indexer) |
| **Receipt route, indexer** | The two ways of reaching it: the buyer's `txHash`, and a scheduled scan of events | [Payment flow](/docs/payment-flow) |
| **Confirmations** | Blocks to wait before PAID; `CONFIRMATIONS_4663` | [Security](/docs/security) |
| **Relay** | `POST /api/rpc/4663`, the same-origin RPC forwarder | [Wallet setup](/docs/wallet-setup) |
| **USDG** | The dollar token on Robinhood Chain that the UI labels USDG | [What Payrail is](/docs/what-payrail-is) |

The full list is at [/docs/glossary](/docs/glossary). The API surface is at [/docs/api](/docs/api). Questions that come up often are at [/faq](/faq).

---

*Code: `contracts/contracts/PaymentProcessor.sol`, `web/src/lib/verify.ts`, `web/src/lib/usdc.ts`. Documentation: [/docs](/docs). Risks: [/docs/risks-and-limits](/docs/risks-and-limits). Contact: support@payrail.app.*
