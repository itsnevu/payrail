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
    ├── src/lib/verify.ts       tx verification + onchain event indexer
    └── prisma/schema.prisma    Merchant, Invoice, Payment, IndexerState
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
                         #   write web/src/lib/deployment.json automatically
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
2. Add the MockUSDC token (address in `web/src/lib/deployment.json`).
3. With the **merchant** wallet: open `/app`, connect, register as a merchant, then **New invoice** to get a payment link.
4. With the **buyer** wallet: open the payment link `/pay/<id>` and press **Pay** (approve, then pay).
5. The page verifies automatically; back on the dashboard the status is **PAID**, with tx history and **Export CSV**.

## Deploy to Arc Testnet

1. `contracts/.env`: set `DEPLOYER_PRIVATE_KEY`, `ARC_RPC_URL`, `ARC_CHAIN_ID`, `USDC_ADDRESS`.
   **Verify the chainId, RPC and official USDC address against the Arc/Circle documentation.** The values in this repo are placeholders.
2. `cd contracts && npm run deploy:arc`
3. `web/.env`: set `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL`, `CONFIRMATIONS` (e.g. 2 or 3).
4. Production: switch the Prisma datasource to `postgresql` + `DATABASE_URL`, run `/api/indexer` from cron (Vercel Cron, etc.) with the `x-indexer-secret` header.

## API

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/merchants` | list / register merchant (upsert by wallet) |
| GET/POST | `/api/invoices` | list (filter `merchantId`, `status`) / create invoice → `paymentLink` |
| GET/DELETE | `/api/invoices/:id` | detail / cancel (if not PAID) |
| POST | `/api/invoices/:id/verify` | `{txHash}` → verify receipt and event, set PAID (202 = retry, 400 = rejected) |
| POST | `/api/indexer` | scan PaymentReceived events (header `x-indexer-secret`) |
| GET | `/api/invoices/export?merchantId=` | CSV |
| GET | `/api/stats?merchantId=` | summary |

## Security and notes

- Contract (v2): key derived on chain from `(salt, merchant, amount)`, `nonReentrant`, `SafeERC20`, funds are never held, a key can only be paid once. Audit notes and mainnet checklist in `contracts/README.md`.
- The backend re-validates **merchant** and **amount** from the event against the DB; it never trusts frontend input.
- Verification is idempotent: the same tx is never recorded twice (`txHash` unique).
- Not yet: merchant authentication (anyone can currently create invoices for any merchant; add SIWE before production), automatic expiry (`EXPIRED`), webhooks/notifications, escrow. See `web/content/docs/risks-and-limits.md` and the mainnet checklist in `contracts/README.md`.
