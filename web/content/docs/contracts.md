---
title: Contracts
description: PaymentProcessor line by line, the key derivation, the deployments, the tests, and how to run or deploy it yourself.
order: 8
section: Under the hood
---

# Contracts

The entire onchain part of Payrail is **one small contract**: `PaymentProcessor.sol`, 91 lines on top of OpenZeppelin 5, Solidity `0.8.24` pinned. Small is deliberate: every extra line is a line that cannot be fixed after deployment. What the backend does with the event is in [Verification and the indexer](/docs/verification-and-indexer); what can go wrong is in [Risks and limits](/docs/risks-and-limits).

## State

```solidity
IERC20 public immutable usdc;

struct Payment { address payer; uint96 amount; address merchant; uint64 paidAt; }
mapping(bytes32 => Payment) private _payments;
```

**`usdc`** is the token the contract moves, set once in the constructor, which reverts `InvalidToken` if the address is zero or has no code. On Robinhood Chain it points at USDG (Global Dollar, 6 decimals): the app labels amounts USDC; the token moved is USDG.

**`Payment`** packs into two storage slots. **`_payments`** maps a key to that record; `amount != 0` means paid, and since a zero amount is rejected on entry the check is exact.

There is no `owner`, no `pause`, no `withdraw`, no `upgrade` and no parameter.

## The key

```solidity
function invoiceKey(bytes32 salt, address merchant, uint256 amount) public pure returns (bytes32) {
    return keccak256(abi.encode(salt, merchant, amount));
}
```

The key is the terms. **`salt`** is issued by the backend: `keccak256` of the invoice's database id, a random cuid, so it cannot be guessed. **`merchant`** is the wallet that receives the funds. **`amount`** is the exact amount in smallest units. Change any of the three and you get a different key.

The backend computes the same hash offchain (`toOnchainId` in `web/src/lib/usdc.ts`) and stores it as `Invoice.onchainId`; the invoice page shows it as `Payment key (onchain)`. The key does not include the chain id; `Invoice.chainId` pins each invoice to its network.

## pay()

```solidity
function pay(bytes32 salt, address merchant, uint256 amount) external nonReentrant
```

The buyer calls this once, after approving at least `amount` to the contract. In order:

1. `merchant == address(0)` or `merchant == address(this)` reverts `InvalidMerchant`. The second half matters: tokens sent to the contract could never leave it.
2. `amount == 0` or `amount > type(uint96).max` reverts `InvalidAmount`.
3. `invoiceId = invoiceKey(salt, merchant, amount)`.
4. `_payments[invoiceId].amount != 0` reverts `InvoiceAlreadyPaid(invoiceId)`. Pay once.
5. Write `Payment{payer: msg.sender, amount, merchant, paidAt: block.timestamp}`.
6. `usdc.safeTransferFrom(msg.sender, merchant, amount)`.
7. `emit PaymentReceived(invoiceId, salt, merchant, msg.sender, amount, block.timestamp)`.

State is written before the external call and the function is `nonReentrant`. `SafeERC20` turns a token that returns `false` into a revert, so a failed transfer never leaves a `Payment` record behind. Anyone can call `pay`; the backend does not check `payer`. Quote the signature as `pay(salt, merchant, amount)`: the first argument is the salt, not the derived key.

**Why funds never touch the contract.** The only token movement is `safeTransferFrom(msg.sender, merchant, amount)`, buyer to merchant. No code path makes the contract a recipient, and `InvalidMerchant` closes the one way a caller could name it as one. The balance is zero structurally, not by policy. Funds land in your wallet, not ours. Nothing to withdraw, so no `withdraw` and no admin key to steal.

**Reading it back.** `isPaid(bytes32)` returns `_payments[id].amount != 0`; `getPayment(bytes32)` returns `{payer, amount, merchant, paidAt}`. Both are free `eth_call`s that anyone can make without our backend.

## Event and errors

| Item | Signature |
| --- | --- |
| Event | `PaymentReceived(bytes32 indexed invoiceId, bytes32 indexed salt, address indexed merchant, address payer, uint256 amount, uint256 timestamp)` |
| Error | `InvalidToken()`: constructor, token address is zero or has no code |
| Error | `InvalidMerchant()`: merchant is zero or the contract itself |
| Error | `InvalidAmount()`: amount is zero or above `uint96` |
| Error | `InvoiceAlreadyPaid(bytes32 invoiceId)`: this key already has a payment |

`applyPaymentLog` matches on `invoiceId`, then re-checks `merchant` and `amount` from the event as defense in depth.

## What the contract does not know

It does not store invoices, so it cannot tell whether `(salt, merchant, amount)` is a real invoice, a cancelled one, or terms someone made up. What it guarantees is that wrong terms land on a different key: a call with the wrong merchant or amount moves tokens wherever the caller pointed them and cannot mark the real invoice paid or block the real buyer. The v1 griefing vector (lock any invoice for one unit) is closed and covered by a regression test. A CANCELLED invoice is cancelled in our database only; the contract still accepts its terms and the backend then marks it PAID.

## One token, one deployment

`usdc` is `immutable`, so one deployment serves one token on one chain. The web app keys every address by chain id in `web/src/lib/deployments.json`.

| Network | Chain id | PaymentProcessor | Token | Deployed |
| --- | --- | --- | --- | --- |
| Robinhood Chain | 4663 | `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D` | USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | `2026-09-19T18:58:30.729Z` (20 September 2026 in UTC+7) |
| Robinhood Chain Testnet | 46630 | not deployed yet | | |
| Hardhat (local) | 31337 | per developer, written by `deploy:local` | MockUSDC, per developer | |

Robinhood Chain is an Arbitrum Orbit L2 with ETH as the gas token. Its public RPC is content-filtered by some ISPs; the browser and the wallet use the same-origin relay `/api/rpc/4663` instead.

> **Note:** the `31337` entry in `deployments.json` belongs to whoever ran the deploy script last. Those are not public addresses.

**MockUSDC.** A 6-decimal ERC-20 with an open `mint()`, for local development only. `deploy:local` deploys it and mints 10,000 mock USDC (10,000,000,000 in smallest units) to each of the first three hardhat accounts.

## Reading the contract on Blockscout

You do not need Payrail to check a payment:

```
https://robinhoodchain.blockscout.com/address/0xD591A0d397179dE0692d50f43AC450C6cDF9C66D
```

Each `pay` transaction's Logs tab shows `PaymentReceived`; `topic1` is the payment key the invoice page shows as `Payment key (onchain)`.

Source verification on Blockscout is still pending, so the Read contract tab may not work yet. Until it does, call the views over JSON-RPC with the ABI in `web/src/lib/PaymentProcessor.abi.json`: `isPaid(bytes32)` is selector `0xfeef6640`, `getPayment(bytes32)` is `0xe66eefc8`.

## Tests

`contracts/test/PaymentProcessor.test.ts`, 11 tests against MockUSDC:

- **constructor**: rejects the zero address and non-contract addresses as the token.
- **invoiceKey**: matches the offchain derivation; changes when any term changes.
- **pay**: transfers USDC straight to the merchant, records the payment and emits the event; rejects paying the same terms twice; rejects zero amount, amounts above uint96, zero merchant and the contract itself as merchant; reverts without allowance and without balance, and records nothing; reverts when the token returns false instead of reverting (SafeERC20); lets anyone pay an invoice, not only the buyer who opened the link.
- **griefing resistance (v1 regression)**: paying the wrong merchant with a known salt does not lock the real invoice; paying the wrong amount to the right merchant does not lock the real invoice.

No CI; run them yourself. `web/scripts/e2e-local.mjs` (`npm run test:e2e` in `web/`) replays the v1 attack against a local stack and asserts the backend flips the real invoice to PAID exactly once. Two internal review passes, the second on 17 September 2026 with eight findings, all resolved. **Not independently audited.**

## Running locally

```bash
cd contracts
npm install
npm test               # 11 tests
npm run node           # terminal 1: hardhat node on :8545, chainId 31337
npm run deploy:local   # terminal 2: MockUSDC + PaymentProcessor, writes web/src/lib/deployments.json and PaymentProcessor.abi.json
```

```bash
cd ../web
cp .env.example .env
npm install
npm run db:push        # SQLite at prisma/dev.db
npm run dev            # http://localhost:3000
node scripts/indexer-loop.mjs   # optional: a local indexer that keeps running
```

## Deploying to Robinhood Chain

`contracts/scripts/robinhood.mjs` is a one-shot deploy. It needs only `DEPLOYER_PRIVATE_KEY` in `contracts/.env`, the key of a wallet holding a little ETH on Robinhood Chain.

```bash
cd contracts
npm run go:robinhood                 # chain 4663
npm run go:robinhood-testnet         # chain 46630
npm run go:robinhood -- --dry-run    # check RPC, gas and token; deploy nothing
```

What it checks, in order:

1. **RPC.** Tries `ROBINHOOD_RPC_URL` from `.env`, then the public endpoint, and requires `eth_chainId` to answer `4663`. If an ISP filter answers instead, it starts a local forwarder that reaches the endpoint by IP with the right SNI.
2. **Gas.** Reads the deployer's ETH balance. Zero stops the run; a dry run reports it and exits with code 2.
3. **Token.** `USDC_ADDRESS_ROBINHOODMAINNET` (or `USDC_ADDRESS`) from `.env` wins; otherwise the known USDG address. It must have code and report `decimals() == 6`, or the script refuses.
4. **Deploy** through `scripts/deploy.ts`, which writes `contracts/deployments/4663.json` and the `4663` entry in `web/src/lib/deployments.json`.
5. **Verify** on Blockscout. Non-fatal; the command to re-run is printed if it fails.

Then in `web/.env`: `NEXT_PUBLIC_CHAINS=4663`, `CONFIRMATIONS_4663=2`. Restart the app and the chain appears in `GET /api/chains`. Commit the deployment record.

Still open: an independent audit, Blockscout source verification, a testnet deployment.

Next: [API](/docs/api).
