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

For local development, `MockUSDC.sol` is a 6-decimal ERC-20 with an open `mint()`. The deploy script mints 10,000 USDC to the first three hardhat accounts. On real networks the contract points at that chain's official USDC address through `USDC_ADDRESS_<NETWORK>`. Because `usdc` is immutable, **each network gets its own PaymentProcessor**: mainnet, testnet and local are separate deployments. The web app keys every address by chain id in `web/src/lib/deployments.json`.

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

## Networks

Payrail runs on Robinhood Chain. The registry is `web/src/lib/chains.ts`; a network is offered to merchants as soon as its PaymentProcessor address is known.

| Network | Chain id | Gas | Explorer | Deployment |
| --- | --- | --- | --- | --- |
| Robinhood Chain | 4663 | ETH | robinhoodchain.blockscout.com | live: `PaymentProcessor` at `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D`, token USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Robinhood Chain Testnet | 46630 | ETH | explorer.testnet.chain.robinhood.com | not yet |
| Hardhat (local) | 31337 | ETH | none | per developer |

Robinhood Chain is an Arbitrum Orbit L2, so the buyer needs a little ETH there for gas. The dollar token on Robinhood Chain is **USDG** (Global Dollar, 6 decimals); the app still labels amounts "USDC" until a USDC contract is available there. Its public RPC is filtered by some ISPs; the browser and the wallet therefore talk to the same-origin relay `/api/rpc/4663`, which the server forwards.

## Deploying to Robinhood Chain

1. `contracts/.env`: `DEPLOYER_PRIVATE_KEY`, a wallet holding a little ETH on Robinhood Chain (a deploy costs about 0.00003 ETH).
2. `npm run go:robinhood` (or `go:robinhood-testnet` for chain 46630). The script finds a working RPC, checks gas, probes the billing token on chain (USDG by default, or `USDC_ADDRESS_ROBINHOODMAINNET` when set), deploys, verifies on Blockscout, and writes `contracts/deployments/4663.json` plus the entry in `web/src/lib/deployments.json`.
3. `web/.env`: `NEXT_PUBLIC_CHAINS=4663`, `CONFIRMATIONS_4663=2`. Restart the app; the network appears in `GET /api/chains`.

## Production

Switch the Prisma datasource to `postgresql`, run `POST /api/indexer` from cron with the `x-indexer-secret` header (one call scans every enabled chain, each with its own cursor), and set a real `INDEXER_SECRET`.

Next: [API](/docs/api).
