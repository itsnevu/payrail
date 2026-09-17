---
title: Contracts
description: What PaymentProcessor does, the functions worth knowing, and how to run the whole thing locally.
order: 5
---

# Contracts

The entire onchain part of Payrail is **one small contract**: `PaymentProcessor.sol`, about 90 lines on top of OpenZeppelin. Small is deliberate. Every extra line in a contract is a line that cannot be fixed after deployment, and the work that truly needs a chain (moving USDC and recording that it happened) does not need more.

## PaymentProcessor

```solidity
contract PaymentProcessor is ReentrancyGuard {
    IERC20 public immutable usdc;

    struct Payment { address payer; uint96 amount; address merchant; uint64 paidAt; }
    mapping(bytes32 => Payment) private _payments;

    event PaymentReceived(bytes32 indexed invoiceId, bytes32 indexed salt, address indexed merchant,
                          address payer, uint256 amount, uint256 timestamp);

    error InvalidToken();
    error InvalidMerchant();
    error InvalidAmount();
    error InvoiceAlreadyPaid(bytes32 invoiceId);

    function invoiceKey(bytes32 salt, address merchant, uint256 amount) public pure returns (bytes32);
    function pay(bytes32 salt, address merchant, uint256 amount) external nonReentrant;
    function isPaid(bytes32 invoiceId) external view returns (bool);
    function getPayment(bytes32 invoiceId) external view returns (Payment memory);
}
```

| Function | Caller | What happens |
| --- | --- | --- |
| `invoiceKey(salt, merchant, amount)` | anyone | `keccak256(abi.encode(salt, merchant, amount))`, the key every other function uses |
| `pay(salt, merchant, amount)` | buyer | Validate, derive the key, record, `safeTransferFrom(buyer, merchant)`, emit |
| `isPaid(invoiceId)` | anyone | `true` when `_payments[id].amount != 0` |
| `getPayment(invoiceId)` | anyone | `{payer, merchant, amount, paidAt}`: onchain proof readable without our backend |

There is no `owner`, no `pause`, no `withdraw`, no `upgrade`. The contract has no balance to withdraw and no parameter to change. `usdc` is `immutable`: one deployment serves one token.

### What it guards

- **Pay once.** `_payments[invoiceId].amount != 0` reverts with `InvoiceAlreadyPaid`. State is written before the transfer, and the function is `nonReentrant`.
- **No funds held.** Direct buyer-to-merchant transfer through `SafeERC20`. Tokens that return `false` instead of reverting are still caught.
- **No zero address, no zero amount.** Both revert with a named error.

### What it does not guard

The contract still does not store invoices, so it cannot tell you whether a `(salt, merchant, amount)` triple corresponds to a real invoice. What it **does** guarantee, since v2, is that the key is derived from all three terms. A call with the wrong merchant or the wrong amount lands on a different key: it moves USDC wherever the caller pointed it, and it records that payment under its own key, but it cannot mark the real invoice as paid or block the real buyer. The v1 griefing vector (lock any invoice for one unit of USDC) is closed and covered by a regression test.

The backend then confirms that the key in the event equals the `onchainId` it stored, and re-checks merchant and amount from the event as defense in depth (see [Verification and the indexer](/docs/verification-and-indexer)).

## MockUSDC

For local development, `MockUSDC.sol` is a 6-decimal ERC-20 with an open `mint()`. The deploy script mints 10,000 USDC to the first three hardhat accounts. On test networks and production the contract points at the official USDC address through `USDC_ADDRESS`.

## Running locally

```bash
cd contracts
npm install
npm test               # 11 tests: constructor, key derivation, pay, SafeERC20, griefing regression
npm run node           # terminal 1: hardhat node on :8545, chainId 31337
npm run deploy:local   # terminal 2: deploy MockUSDC + PaymentProcessor,
                       #   mint USDC to 3 accounts, write web/src/lib/deployment.json
```

`deploy:local` writes the addresses straight into `web/src/lib/`, so frontend and backend stay in sync without an extra step.

```bash
cd ../web
cp .env.example .env
npm install
npm run db:push        # SQLite at prisma/dev.db
npm run dev            # http://localhost:3000
```

Optional, a local indexer that keeps running:

```bash
node scripts/indexer-loop.mjs
```

## Deploying to Arc Testnet

1. `contracts/.env`: set `DEPLOYER_PRIVATE_KEY`, `ARC_RPC_URL`, `ARC_CHAIN_ID`, `USDC_ADDRESS`. The chain ID, RPC and USDC values in the repo are **placeholders**; verify them against the official Arc and Circle documentation.
2. `npm run deploy:arc`
3. `web/.env`: `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL`, `CONFIRMATIONS=2` or `3`.
4. Production: switch the Prisma datasource to `postgresql`, run `/api/indexer` from cron with the `x-indexer-secret` header.

Next: [API](/docs/api).
