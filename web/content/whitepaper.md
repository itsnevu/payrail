---
title: "Payrail: Non-Custodial USDC Payment Reconciliation"
description: "The design, mechanics and failure modes of Payrail: invoices that carry their ID into the transaction, a contract that never holds funds, and two idempotent verification routes."
date: 2026-09-17
---

# Payrail: Non-Custodial USDC Payment Reconciliation

## Abstract

Merchants who accept stablecoin payments face the same problem as merchants who accept bank transfers: money arrives without saying which bill it pays. Payrail solves this by making the **payment transaction carry the invoice ID** as an argument to a contract, which forwards USDC directly to the merchant and emits a structured event. The backend matches the event to an invoice with three checks (ID, recipient, amount) and marks it PAID. The contract never holds funds, has no owner, and cannot be changed. Verification is idempotent and runs over two independent routes so that no payment is missed because of a client failure. Payrail runs on two chains, Arc and Robinhood Chain, with one identical contract on each; every invoice is pinned to one of them, and the design of the key makes a payment on the wrong chain harmless.

## 1. Motivation

Payment matching is invisible, unpaid work. A transfer, bank or onchain, carries an amount, a time and a sender; none of them is a bill identifier. Merchants match by guessing from the leftovers, and wrong guesses produce awkward conversations with customers.

Existing solutions generally become **custodial intermediaries**: funds go to the provider, the provider matches, then forwards to the merchant minus a fee and a delay. This trades a matching problem for a trust problem, and adds a point of failure exactly in the path of the money.

A blockchain allows a third way: a payment that **names itself** without an intermediary holding anything. A contract can accept a bill ID as an argument, forward the buyer's funds to the merchant in the same call, and record that fact as an event that cannot be faked. Payrail is a minimal implementation of that idea.

## 2. Design principles

1. **Funds never stop.** The contract forwards; it does not hold. Its balance is zero structurally, not by policy.
2. **The chain is the source of truth; the database is a cache.** PAID can always be re-derived from onchain events. If the database is lost, the indexer rebuilds it.
3. **Clients give hints, not claims.** No byte from the browser is used to decide PAID except as a lookup key into onchain data.
4. **Every operation is idempotent.** Running verification twice, ten times, or from two concurrent processes yields the same result.
5. **The contract is as small as possible.** Whatever can happen offchain happens offchain. The contract only moves funds and records.

## 3. Data model

Three offchain entities and one onchain mapping.

| Entity | Key | Contents |
| --- | --- | --- |
| `Merchant` | `id` | `name`, `walletAddress` (unique) |
| `Invoice` | `id` (cuid) | `onchainId` (unique), `chainId`, `merchantId`, `description`, `amount` (smallest units, string), `status`, `customerName?`, `dueAt?` |
| `Payment` | `id` | `invoiceId` (unique), `txHash` (unique), `payer`, `amount`, `blockNumber`, `paidAt` |
| `IndexerState` | `1` | `lastBlock` |

Onchain, `mapping(bytes32 => Payment{payer, amount, merchant, paidAt})`.

The bridge between the two is the payment key:

```
salt      = keccak256(invoice.id)
onchainId = keccak256(abi.encode(salt, merchant.walletAddress, amountUnits))
```

`invoice.id` is a random 25-character cuid, so `salt` cannot be guessed and cannot collide in practice. The key binds the salt to the **terms** (recipient and exact amount). It is computed after the record is created (to obtain the `id`) and stored as a unique column. The contract recomputes the same key from the three arguments to `pay()`, so the database and the chain agree by construction rather than by lookup.

`status` is one of `PENDING`, `PAID`, `CANCELLED`, `EXPIRED`. Only the transitions `PENDING` to `PAID` (by verification) and `PENDING` to `CANCELLED` (by the merchant) are implemented.

## 4. The contract

```solidity
function invoiceKey(bytes32 salt, address merchant, uint256 amount) public pure returns (bytes32) {
    return keccak256(abi.encode(salt, merchant, amount));
}

function pay(bytes32 salt, address merchant, uint256 amount) external nonReentrant {
    if (merchant == address(0) || merchant == address(this)) revert InvalidMerchant();
    if (amount == 0 || amount > type(uint96).max) revert InvalidAmount();

    bytes32 invoiceId = invoiceKey(salt, merchant, amount);
    if (_payments[invoiceId].amount != 0) revert InvoiceAlreadyPaid(invoiceId);

    _payments[invoiceId] = Payment(msg.sender, uint96(amount), merchant, uint64(block.timestamp));
    usdc.safeTransferFrom(msg.sender, merchant, amount);
    emit PaymentReceived(invoiceId, salt, merchant, msg.sender, amount, block.timestamp);
}
```

### 4.1 Invariants

- **One payment per key.** Enforced by the `amount != 0` check before the write, with `nonReentrant` closing the reentrancy window. Because `amount == 0` is rejected, `amount != 0` is an exact proxy for "already paid".
- **The key is the terms.** `invoiceId` is a pure function of `(salt, merchant, amount)`. Two calls with different terms can never collide on a key, and a call with the wrong terms cannot occupy the key of a real invoice.
- **Contract balance = 0.** The only token movement is `safeTransferFrom(msg.sender, merchant, amount)`. No code path makes the contract a recipient.
- **No authority.** No `owner`, `pause`, `withdraw`, `upgrade`, or adjustable parameter. `usdc` is `immutable` and must be a deployed contract at construction.
- **Two storage slots per payment.** `Payment` is ordered `(payer, amount:uint96)`, `(merchant, paidAt:uint64)`. Amounts above `2^96 - 1` smallest units are rejected; that is 7.9e22 USDC, far beyond total supply.

### 4.2 What the contract does not know

The contract does not store invoices. It cannot tell whether a `(salt, merchant, amount)` triple corresponds to a real invoice. Moving that knowledge onchain would mean every invoice is a transaction (gas for the merchant, latency on creation) and every invoice detail is public. We chose to keep it offchain.

What v1 got wrong was letting the key be independent of the terms: `pay(invoiceId, merchant, amount)` keyed only on `invoiceId`, so a third party who saw a payment link could call `pay(id, themselves, 1)` and lock the real invoice for one unit of USDC. The database rejected the mismatched event, but the contract had already consumed the key. v2 closes this by deriving the key from all three terms (section 4). A wrong-terms call now lands on a key nobody else will ever use. Both the unit tests and the live end-to-end script perform the attack and confirm the real buyer can still pay.

## 5. Verification

Every route ends in one function:

```
applyPaymentLog(event, txHash, blockNumber):
  invoice <- Invoice where onchainId = event.invoiceId
  if none                                             -> reject "invoice not found"
  if invoice.payment exists                           -> ok (idempotent)
  if event.merchant != invoice.merchant.walletAddress -> reject "merchant mismatch"
  if event.amount != invoice.amount                   -> reject "amount mismatch"
  atomically: create Payment{txHash, ...}; invoice.status <- PAID
```

Since v2 the key already binds merchant and amount, so a matching `invoiceId` implies matching terms; the two explicit checks remain as defense in depth against a wrong deployment address or ABI. Amounts must match exactly: an overpayment or underpayment is a different key and never reaches the invoice. The `payment exists` check plus the `txHash @unique` constraint guarantee one record per invoice even when the two routes overlap or two processes run concurrently.

### 5.1 Fast route: `txHash` from the client

After `pay()` confirms, the client calls `POST /api/invoices/:id/verify {txHash}`. The server:

1. fetches the receipt; none yet: `202` (retry);
2. checks `status == success`; otherwise `400`;
3. checks `head - receipt.block + 1 >= CONFIRMATIONS`; otherwise `202`;
4. filters `receipt.logs` to `address == PaymentProcessor`;
5. parses `PaymentReceived` and finds `invoiceId == invoice.onchainId`; none: `400`;
6. calls `applyPaymentLog` with arguments **taken from the event**.

The `txHash` only selects which receipt to read. The merchant and amount used for the decision come from a log signed by chain consensus, not from the request.

### 5.2 Certain route: the indexer

`POST /api/indexer` (guarded by a secret header) scans `PaymentReceived` from `lastBlock + 1` to `head - CONFIRMATIONS + 1` in chunks of 2,000 blocks, calls `applyPaymentLog` for each event, then stores `lastBlock`. With no initial state it starts 5,000 blocks behind the head.

The indexer catches payments the client never reported: closed tabs, dropped networks, payments from scripts or multisigs, or verifications that were pending on confirmations. Because `applyPaymentLog` is idempotent, it can run as often as desired and overlap the fast route without side effects.

### 5.3 Confirmations

`CONFIRMATIONS` (default 1) applies to both routes and is the only defence against reorgs. For real networks, 2 or 3 is recommended. There is no mechanism to **revert** PAID if a reorg happens after the threshold; we accept this risk as the price of an append-only database.

## 6. Buyer flow

1. Open `/pay/:id`; the page reads the invoice from the API and shows merchant, description and amount.
2. Connect a wallet; the page switches it to the invoice's chain (Arc or Robinhood Chain) if needed.
3. If `allowance(buyer, PaymentProcessor) < amount`, send `USDC.approve(PaymentProcessor, amount)`.
4. Send `PaymentProcessor.pay(onchainId, merchant.walletAddress, amount)`; arguments are filled from the database, not from user input.
5. After confirmation, post the `txHash` to `/verify`; repeat while `202`.
6. Show PAID and an explorer link.

Two transactions (one if the allowance already covers it). No protocol fee; the merchant receives exactly `amount`.

## 7. Networks

Payrail is dual chain: **Arc** (Circle's chain, USDC as the gas token) and **Robinhood Chain** (an Arbitrum Orbit L2 settling to Ethereum, ETH as the gas token). The contract in section 4 is deployed once per chain, byte for byte the same, each pointing at that chain's USDC. Nothing in the contract knows about the other chain.

The multi-chain part lives entirely in the application:

1. **An invoice is pinned to one chain** at creation (`Invoice.chainId`). The merchant picks the network in the form; the buyer's wallet is switched to it before paying. The choice cannot be changed afterwards, because the payment link is a promise about where the money will show up.
2. **The key does not include the chain.** `invoiceKey(salt, merchant, amount)` gives the same `bytes32` on Arc and on Robinhood Chain. This is deliberate: it keeps the contract identical everywhere and keeps the key derivable without knowing the deployment. The consequence is handled one layer up: `applyPaymentLog` receives the chain the event was seen on and rejects it unless it equals the invoice's `chainId`. A buyer who pays the right terms on the wrong chain has sent USDC to the merchant on that chain, recorded under the same key there, but the invoice stays PENDING and the merchant refunds by hand. The right-chain payment still goes through, because the wrong-chain one never touched that contract.
3. **One verifier and one indexer cursor per chain.** The fast route reads the receipt from the RPC of the invoice's chain. The indexer scans every enabled chain independently (`IndexerState.chainId`), so a slow or failing RPC on one network never stalls the other. `CONFIRMATIONS` is set per chain.
4. **RPC access is a first-class concern.** Robinhood Chain's public RPC is content-filtered by some ISPs, which would make the payment page unusable on those networks. The browser and the wallet therefore talk to a same-origin relay (`/api/rpc/<chainId>`) that forwards an allow-list of read and broadcast methods from the server. The relay is a transport choice, not a trust boundary: the decision to mark PAID still comes from a log signed by chain consensus.

Adding a third chain is a registry entry and a deployment; no schema or contract change.

## 8. Failure mode analysis

| Scenario | What happens | Mitigation |
| --- | --- | --- |
| Client sends someone else's `txHash` | Fails the `invoiceId` check | Built in |
| Client pays the wrong merchant via the UI | Impossible; arguments come from the DB | Built in |
| Attacker pays 1 unit to themselves with a known `salt` | Lands on a different key; real invoice untouched | **Closed in v2.** Regression tests in `contracts/test` and `web/scripts/e2e-local.mjs`. |
| Someone calls `pay()` by hand with the wrong merchant or amount | USDC goes where they pointed it, recorded under a different key; real invoice untouched | No fund recovery for the mistaken payer; invoice remains payable |
| Under- or overpayment | Different key; the invoice stays PENDING; USDC reaches the merchant | Merchant settles by hand. No partial payments yet. |
| Invoice CANCELLED but paid | `applyPaymentLog` does not check status, so PAID | Known; documented. Merchant refunds by hand. |
| Reorg after `CONFIRMATIONS` | PAID stays; tx may vanish | Raise `CONFIRMATIONS` |
| RPC hides a tx | Invoice looks PENDING for longer | Indexer on a second RPC; `getPayment()` readable by anyone |
| Database lost | All status lost | Indexer rebuilds `Payment` from events; `Invoice` needs backups |
| Another contract emits `PaymentReceived` | Ignored by the address filter | Built in |
| Invoice creation without authentication | Spam invoices; fake links in a merchant's name | Funds still go to the merchant's wallet. **SIWE required before production.** |
| USDC freezes the merchant wallet | `transferFrom` reverts; invoices unpayable | Out of our control |
| Buyer pays the right terms on the wrong chain | Same key, other chain; invoice stays PENDING; USDC reached the merchant there | Backend rejects by `chainId`; merchant refunds by hand. Wallet is switched to the right chain before paying. |
| One chain's RPC is down or filtered | That chain's invoices verify late | Per-chain indexer cursor; same-origin relay for the browser; the other chain is unaffected |

## 9. What does not exist yet

Merchant authentication. Automatic expiry (`dueAt` and `EXPIRED` are in the schema; nothing sets them). Partial payments. Webhooks. Multi-token: USDC only, on both chains. Paying an invoice on a chain other than the one it was created for (section 7). Escrow, which is deliberately **not** an evolution of this contract, because it would break the first principle in section 2. An independent audit; the contract has had two internal review passes and a live end-to-end attack test, which is not the same thing.

## 10. Conclusion

Payrail shows that stablecoin payment reconciliation does not require a custodian, on Arc and on Robinhood Chain alike. One contract with no balance, one hash linking an offchain invoice to an onchain event, and one idempotent function reached from two directions are enough to turn "I sent it, please check" into a status that changes on its own. The rest (authentication, expiry, notifications) is ordinary application work that can be added without touching the part that cannot be changed.

---

*Code: `contracts/contracts/PaymentProcessor.sol`, `web/src/lib/verify.ts`. Documentation: [/docs](/docs). Risks: [/docs/risks-and-limits](/docs/risks-and-limits).*
