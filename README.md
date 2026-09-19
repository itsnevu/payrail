# Payrail: USDC Payment Reconciliation

> Know exactly which invoice got paid.

A merchant creates a USDC invoice, the system generates a payment link, the buyer pays from a wallet,
the backend verifies the transaction onchain, the invoice flips to **PAID**, and the merchant sees the
history and exports CSV. The contract never holds funds.

```
PAYRAIL/
├── contracts/     Hardhat + Solidity (PaymentProcessor.sol, MockUSDC.sol, tests, deploy script)
└── web/           Next.js 14 (App Router) + Prisma + wagmi/viem
    ├── src/app/page.tsx        landing page (/), plus /docs, /blog, /whitepaper, /terms, /privacy
    ├── src/app/(app)/          dashboard /app, /invoices/new, /invoices/[id], /pay/[id]
    ├── content/                Markdown for docs, blog and the whitepaper
    ├── src/app/api/            REST API (invoices, merchants, verify, indexer, export, stats)
    ├── src/lib/chains.ts       every supported network (Robinhood Chain, its testnet, local) in one place
    ├── src/lib/verify.ts       tx verification + per-chain onchain event indexer
    ├── src/app/api/rpc/        same-origin JSON-RPC relay (Robinhood Chain is ISP-filtered in ID)
    └── prisma/schema.prisma    Merchant, Invoice (chainId), Payment, IndexerState (per chain)
```

## Architecture

```
Merchant (Next.js dashboard) ──► POST /api/invoices ──► PostgreSQL/SQLite
                                        │
                                        ▼  payment link  /pay/:id
Buyer (wallet) ── approve USDC ──► PaymentProcessor.pay(salt, merchant, amount)
                                        │  USDC goes straight to the merchant (the contract holds nothing)
                                        │  emit PaymentReceived(invoiceId, salt, merchant, payer, amount, ts)
                                        ▼
Backend ◄── (a) frontend posts txHash to POST /api/invoices/:id/verify   (fast)
        ◄── (b) POST /api/indexer scans events from lastBlock to head    (safety net / cron)
        └── match invoiceId + merchant + amount → status = PAID
```

Onchain `invoiceId = keccak256(abi.encode(keccak256(invoice.id), merchant, amount))`, derived by the contract from the payment terms, so wrong terms can never lock a real invoice. Already-paid keys revert with `InvoiceAlreadyPaid`.

## Networks

Payrail runs on **Robinhood Chain**. The app is multi-chain underneath (mainnet, testnet, local) and every invoice is pinned to one network when it is created (`Invoice.chainId`); the buyer's wallet is switched to that network, the backend verifies the receipt on that chain, and the indexer keeps one cursor per chain.

| Network | chainId | Gas | Explorer | Status |
|---|---|---|---|---|
| Hardhat (local) | 31337 | ETH | none | works end to end |
| Robinhood Chain | 4663 | ETH | robinhoodchain.blockscout.com | **deployed 20 Sep 2026**: PaymentProcessor `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D`, billing token USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 decimals) |
| Robinhood Chain Testnet | 46630 | ETH | explorer.testnet.chain.robinhood.com | configured, not deployed |

The registry is `web/src/lib/chains.ts`. A chain is offered as soon as it has a `PaymentProcessor` entry in `web/src/lib/deployments.json` (or the `NEXT_PUBLIC_*_ADDRESS_<chainId>` overrides); `NEXT_PUBLIC_CHAINS=4663` narrows and orders the list (production uses exactly that). `GET /api/chains` lists what a deployment accepts.

**Robinhood Chain RPC.** `rpc.mainnet.chain.robinhood.com` is content-filtered by Indonesian ISPs. The browser and the wallet therefore use the same-origin relay `POST /api/rpc/4663`, which the server forwards to the real endpoint (allow-listed methods only, capped, rate limited). For local development on a filtered ISP, run the launchpad repo's `npm run rpc:proxy` and set `RPC_URL_4663=http://127.0.0.1:8545`.

## Prerequisites

- Node.js 18 or newer (https://nodejs.org)
- MetaMask (or another injected wallet) in the browser

## Run locally (end to end)

### 1. Smart contract

```bash
cd contracts
npm install
npm test                 # 11 tests incl. griefing regression
npm run node             # terminal 1: hardhat node at http://127.0.0.1:8545 (chainId 31337)
npm run deploy:local     # terminal 2: deploy MockUSDC + PaymentProcessor,
                         #   mint 10,000 USDC to the first 3 accounts,
                         #   write web/src/lib/deployments.json (entry "31337") automatically
```

### 2. Web app

```bash
cd web
cp .env.example .env     # defaults already match local hardhat
npm install
npm run db:push          # create SQLite prisma/dev.db
npm run dev              # http://localhost:3000
```

Optional safety-net indexer (catches payments that bypass the UI):

```bash
node scripts/indexer-loop.mjs
```

### 3. Try the flow

1. Import the private keys of hardhat accounts #1 (merchant) and #2 (buyer) into MetaMask and add the network `localhost 8545 / chainId 31337`.
2. Add the MockUSDC token (address in `web/src/lib/deployments.json`).
3. With the **merchant** wallet: open `/app`, connect, register as a merchant, then **New invoice** to get a payment link.
4. With the **buyer** wallet: open the payment link `/pay/<id>` and press **Pay** (approve, then pay).
5. The page verifies automatically; back on the dashboard the status is **PAID**, with tx history and **Export CSV**.

## Deploy to a real network

The same script serves every chain; it writes `contracts/deployments/<chainId>.json` (commit it) and merges the entry into `web/src/lib/deployments.json`.

### Robinhood Chain (4663) or its testnet (46630)

1. `contracts/.env`: `DEPLOYER_PRIVATE_KEY`, funded with a little ETH on that chain. Optionally `USDC_ADDRESS_ROBINHOODMAINNET` to bill in a token other than USDG.
2. `cd contracts && npm run go:robinhood` (or `go:robinhood-testnet`). This one-shot script picks a working RPC (with a local forwarder when the ISP filters the public one), checks the deployer has ETH, probes the token on chain, deploys, verifies on Blockscout and writes both deployment records. `-- --dry-run` checks everything without deploying. Only `DEPLOYER_PRIVATE_KEY` is required; the token defaults to USDG (the 6-decimal dollar on Robinhood Chain) unless `USDC_ADDRESS_ROBINHOODMAINNET` is set.
3. `web/.env`: `CONFIRMATIONS_4663=2`; optionally `RPC_URL_4663` for a dedicated provider. The browser relay needs nothing.
4. Restart the web app; the chain appears in the invoice form and `/api/chains`.

### Production

Switch the Prisma datasource to `postgresql` + `DATABASE_URL`, run `POST /api/indexer` from cron with the `x-indexer-secret` header (one call scans every enabled chain), generate a real `INDEXER_SECRET`.

## API

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/merchants` | list / register merchant (upsert by wallet) |
| GET/POST | `/api/invoices` | list (filter `merchantId`, `status`, `chainId`) / create invoice (`chainId` optional, defaults to `NEXT_PUBLIC_DEFAULT_CHAIN_ID`) → `paymentLink` |
| GET/DELETE | `/api/invoices/:id` | detail / cancel (if not PAID) |
| POST | `/api/invoices/:id/verify` | `{txHash}` → verify receipt and event, set PAID (202 = retry, 400 = rejected) |
| POST | `/api/indexer?chainId=` | scan PaymentReceived events on every enabled chain, or one (header `x-indexer-secret`) |
| GET | `/api/chains` | networks this deployment accepts, with contract addresses |
| POST | `/api/rpc/:chainId` | same-origin JSON-RPC relay for the browser and wallet |
| GET | `/api/invoices/export?merchantId=` | CSV |
| GET | `/api/stats?merchantId=` | summary |

## Security and notes

- Contract (v2): key derived on chain from `(salt, merchant, amount)`, `nonReentrant`, `SafeERC20`, funds are never held, a key can only be paid once. Audit notes and mainnet checklist in `contracts/README.md`.
- The backend re-validates **merchant** and **amount** from the event against the DB; it never trusts frontend input.
- Verification is idempotent: the same tx is never recorded twice (`txHash` unique).
- The onchain key does not include the chain, so the same terms hash to the same key on every network. `Invoice.chainId` is what pins the payment: a matching event seen on another chain is rejected with `invoice is on <network>`.
- Not yet: merchant authentication (anyone can currently create invoices for any merchant; add SIWE before production), automatic expiry (`EXPIRED`), webhooks/notifications, escrow. See `web/content/docs/risks-and-limits.md` and the mainnet checklist in `contracts/README.md`.
