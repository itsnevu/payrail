# Payrail contracts

Hardhat + Solidity 0.8.24 (pinned) + OpenZeppelin 5.

| File | Purpose |
| --- | --- |
| `contracts/PaymentProcessor.sol` | v2. `pay(salt, merchant, amount)` derives `invoiceId = keccak256(abi.encode(salt, merchant, amount))`, forwards USDC to the merchant, emits `PaymentReceived`. Holds no funds, has no owner. |
| `contracts/MockUSDC.sol` | 6-decimal ERC-20 with open `mint()`. Local testing only. |
| `contracts/mocks/FalseReturnToken.sol` | Token whose `transferFrom` returns `false`. Test only, proves the SafeERC20 path. |
| `scripts/deploy.ts` | Deploys (MockUSDC on local networks), writes `deployments/<chainId>.json` and merges into `web/src/lib/deployments.json`. Refuses non-local deploys without a valid `USDC_ADDRESS_<NETWORK>` that has code on the target chain. |
| `deployments/` | One committed record per chain id. |
| `test/PaymentProcessor.test.ts` | 11 tests: constructor, key derivation, pay, reverts, SafeERC20, griefing regression. |

```bash
npm install
npm test
npm run node            # local chain on :8545
npm run deploy:local    # deploy + write addresses into ../web
npm run deploy:arc      # Arc Testnet (needs .env)
npm run deploy:arc-mainnet   # refuses to run without verified .env values
npm run go:robinhood              # ONE SHOT: Robinhood Chain 4663. Needs only DEPLOYER_PRIVATE_KEY in .env
npm run go:robinhood-testnet      # same for chain 46630; add `-- --dry-run` to check without deploying
npm run deploy:robinhood          # raw hardhat deploy, chain 4663 (needs USDC_ADDRESS_ROBINHOODMAINNET + working RPC)
npm run deploy:robinhood-testnet  # Robinhood Chain Testnet, chain 46630
npx hardhat verify --network robinhoodMainnet <processor> <usdc>   # Blockscout, no real key needed
```

Live end-to-end check (hardhat node + `npm run dev` in `web/`): `cd ../web && npm run test:e2e`. It creates an invoice through the API, performs the v1 griefing attack on chain, pays with the real terms, and asserts the backend flips the invoice to PAID exactly once.

## Audit notes (second pass, 17 September 2026)

Scope: `PaymentProcessor.sol` and its integration points (`web/src/lib/usdc.ts`, `web/src/lib/verify.ts`, `web/src/app/api/invoices/[id]/verify/route.ts`, `web/src/app/(app)/pay/[id]/page.tsx`). Method: manual review against the intended invariants, a unit test per finding, and a live attack replay against a local stack.

### Findings and resolutions

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | **High** | Invoice ID griefing. v1 keyed only on a caller-supplied `invoiceId`, so anyone who saw a payment link could call `pay(id, themselves, 1)` and lock the real invoice forever. | **Fixed.** Key is now `keccak256(abi.encode(salt, merchant, amount))`, computed on chain. Wrong terms land on a different key. Regression tests `griefing resistance` and `e2e-local.mjs` replay the attack. |
| 2 | Medium | Verify endpoint returned `202` (retry) for every failure, including definitive ones (revert, wrong event, terms mismatch). The client retried 20 times on a permanent failure and never showed the reason. | **Fixed.** `200` matched, `202` only when `pending` (not mined or confirmations short), `400` otherwise. |
| 3 | Low | `merchant == address(this)` was accepted. USDC sent to the contract would be stuck forever (no withdraw path by design). | **Fixed.** Reverts `InvalidMerchant`. |
| 4 | Low | Constructor accepted any non-zero address as the token, including an EOA, producing a deployment where every `pay()` reverts. | **Fixed.** Requires `code.length > 0`, reverts `InvalidToken`. |
| 5 | Low | Backend accepted overpayment (`>=`). Harmless in v1; in v2 an overpayment is a different key and must not match. | **Fixed.** Exact equality, and the key already enforces it. |
| 6 | Info | Floating pragma `^0.8.24`. | Pinned to `0.8.24`. |
| 7 | Info | `Payment` struct used three storage slots. | Reordered to `(payer, uint96 amount)`, `(merchant, uint64 paidAt)`: two slots. `amount > uint96.max` rejected (7.9e22 USDC). |
| 8 | Info | Event had `payer` indexed but not `salt`. Indexing `salt` lets the backend look up an invoice's payment directly without the derived key. | Event is now `PaymentReceived(bytes32 indexed invoiceId, bytes32 indexed salt, address indexed merchant, address payer, uint256 amount, uint256 timestamp)`. |

### Reviewed and accepted as designed

- **No admin, no pause, no upgrade.** There is nothing to rescue because the contract never holds a balance. If a v3 is ever needed, deploy fresh and repoint the app.
- **Checks-effects-interactions + `nonReentrant`.** State is written before the external call. USDC is not a callback token, but the guard costs little and protects against a hypothetical token swap.
- **Anyone can pay any invoice.** Intentional: a client may pay from a different wallet than the one that opened the link. The backend does not check `payer`.
- **Cancelled invoices remain payable on chain.** The contract cannot know about database state. The backend currently flips a cancelled invoice to PAID if funds arrive; this is documented and is an application policy question, not a contract bug.
- **USDC blacklist.** If the merchant is frozen by Circle, `transferFrom` reverts and the invoice is unpayable. Out of scope.
- **Timestamp in event and struct.** `block.timestamp` is miner-influenced within seconds; it is informational only and never used for logic.

### Remaining before mainnet (operational, not contract)

- **Independent audit.** Two internal review passes and an attack replay are not a third-party audit. Budget one before real money.
- **Verify the target chain.** All Arc chain IDs, RPC URLs and the USDC address in this repo are placeholders. Confirm them from official Arc and Circle sources, and confirm the ERC-20 USDC on that chain has 6 decimals (the app assumes it does). Robinhood Chain: PaymentProcessor `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D` deployed 20 September 2026 against USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 decimals), see `deployments/4663.json`. Blockscout source verification is still pending (the explorer answered with a Cloudflare challenge); re-run `npx hardhat verify --network robinhoodMainnet 0xD591A0d397179dE0692d50f43AC450C6cDF9C66D 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`.
- **One deployment per chain.** `usdc` is immutable, so each network gets its own PaymentProcessor; the web app keys everything by `chainId`.
- **Verify source on the explorer** after deploy (`EXPLORER_API_KEY` + `npx hardhat verify <address> <usdc>`).
- **Commit the deployment record.** `deploy.ts` overwrites `web/src/lib/deployment.json`; keep a per-chain copy under version control.
- **App hardening.** Add SIWE so only the merchant can create their invoices; set `CONFIRMATIONS` to 2 or 3; generate a real `INDEXER_SECRET`; move to PostgreSQL; use a second RPC provider for the indexer.

### Verdict

The contract is mainnet-shaped: minimal, non-custodial, no privileged roles, invariants tested, and the one exploitable flaw found in the first pass is closed with regression coverage and a live replay. What stands between it and a real deployment is now external (an independent audit, verified chain parameters) and application-side (authentication), not the Solidity.
