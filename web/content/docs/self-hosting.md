---
title: Self-hosting
description: Run your own Payrail on one server, from clone to cron, with every environment variable explained.
order: 11
section: Reference
---

# Self-hosting

Payrail is a Next.js app, a SQLite file and a contract that is already on Robinhood Chain. Nothing in it reports back to us. You can run the whole thing on one small server and point it at the same PaymentProcessor we use, or at your own deployment.

This is the operator's view. For what the app does once it runs, start at [What Payrail is](/docs/what-payrail-is). For what it does not protect you from, read [Risks and limits](/docs/risks-and-limits) before you bill anyone.

## Prerequisites

- **Node.js 18 or newer** and **npm**, as the README states.
- A server with a public hostname and HTTPS. Service workers, and with them Web Push and the install prompt, need a secure context; outside `localhost` that means HTTPS.
- Outbound access to `https://rpc.mainnet.chain.robinhood.com`. Some Indonesian ISPs answer that hostname with a filter page; see [RPC and the ISP filter](#rpc-and-the-isp-filter).

No database server is needed. SQLite is the default and is enough for one merchant or a handful.

## Clone and install

```bash
git clone <repository url> payrail
cd payrail/web
cp .env.example .env
npm ci
npm run db:push
```

`npm ci` runs `prisma generate` through the `postinstall` script. `db:push` creates the schema in `prisma/dev.db`. Keep that file; see [Backups](#backups).

## Environment variables

Everything lives in `web/.env`. The table covers every key in `.env.example`.

> **Warning:** Every `NEXT_PUBLIC_*` value is inlined into the JavaScript bundle at build time. Change one and you must run `npm run build` again; restarting is not enough.

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | `file:./dev.db` | Prisma datasource. Relative paths resolve from `prisma/`. |
| `NEXT_PUBLIC_CHAINS` | recommended | empty | Comma-separated chain ids the app offers, in display order. Empty means every chain with a deployment record. Set `4663` in production. |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | no | first enabled | Preselected network on the new-invoice form. |
| `RPC_URL_4663` | no | public endpoint | Server-side RPC for Robinhood Chain: verification, indexer, relay. |
| `RPC_URL_46630`, `RPC_URL_31337` | no | public, `http://127.0.0.1:8545` | Same, for the testnet (no deployment yet) and a local hardhat node. |
| `NEXT_PUBLIC_RPC_URL_4663` | no | `/api/rpc/4663` | What the browser and wallet use. Empty keeps the same-origin relay. |
| `NEXT_PUBLIC_RPC_URL_46630`, `NEXT_PUBLIC_RPC_URL_31337` | no | relay, server RPC | Same, testnet and hardhat. |
| `NEXT_PUBLIC_EXPLORER_URL_4663`, `NEXT_PUBLIC_EXPLORER_URL_46630` | no | `https://robinhoodchain.blockscout.com`, `https://explorer.testnet.chain.robinhood.com` | Base URL for transaction and address links. |
| `NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_4663` | no | from `deployments.json` | Override the contract address. |
| `NEXT_PUBLIC_USDC_ADDRESS_4663` | no | from `deployments.json` | Override the billing token address (USDG on Robinhood Chain). |
| `NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_46630`, `NEXT_PUBLIC_USDC_ADDRESS_46630` | no | empty | Same pair for the testnet. |
| `CONFIRMATIONS` | no | `1` | Blocks a payment must be buried under before PAID, all chains. |
| `CONFIRMATIONS_4663` | recommended | `2` | Per-chain override. Keep 2 or 3 on a real network. |
| `RPC_RELAY_RATE`, `RPC_RELAY_BURST` | no | `20`, `60` | Relay token bucket per IP: requests per second, burst size. |
| `INDEXER_SECRET` | yes | `change-me` | Value of the `x-indexer-secret` header on `POST /api/indexer`. Unset means the endpoint always answers 401. |
| `NEXT_PUBLIC_APP_URL` | yes | `http://localhost:3000` | Public origin. Builds `paymentLink`, push URLs and the relay URL during server rendering. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | no | empty | Web Push keys. Both, or push is a no-op. |
| `VAPID_SUBJECT` | no | `mailto:support@payrail.app` | Contact for the push service. Set your own address. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | no | empty | Enables the WalletConnect connector. Empty means injected wallets only. |

A minimal production `.env`:

```bash
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_CHAINS=4663
CONFIRMATIONS_4663=2
INDEXER_SECRET=<openssl rand -hex 32>
NEXT_PUBLIC_APP_URL=https://pay.example.com
```

## SQLite or PostgreSQL

SQLite needs nothing and survives a reboot. Its one weakness is that it is a file on one disk, so back it up.

To use PostgreSQL, change the provider in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Set `DATABASE_URL="postgresql://user:pass@localhost:5432/payrail"` and run `npm run db:push` again. The schema uses no SQLite-specific types. SQLite is the default; `contracts/README.md` lists the move to PostgreSQL as hardening, not as a requirement.

## Build and start

```bash
npm run build
npm start -- -p 3000
```

`npm start` is `next start`; `-p` picks the port. The service worker registers only in a production build, so `npm run dev` is not a substitute.

### pm2

```bash
pm2 start npm --name payrail -- start -- -p 3000
pm2 save
```

The double `--` is deliberate: the first ends pm2's arguments, the second ends npm's.

### systemd

```ini
[Unit]
Description=Payrail
After=network.target

[Service]
User=payrail
WorkingDirectory=/var/www/payrail/web
ExecStart=/usr/bin/npm start -- -p 3000
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

`next start` reads `web/.env` itself, so the unit does not repeat the variables.

## Reverse proxy

Put a TLS terminator in front. With Caddy the whole configuration is:

```
pay.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy obtains the certificate on its own. Whatever proxy you use, `NEXT_PUBLIC_APP_URL` must match the public origin exactly, scheme included, or payment links point at the wrong place.

## The indexer cron

The browser reports a `txHash` after paying, but the indexer is what makes PAID certain: it scans `PaymentReceived` events from its cursor to `head - confirmations + 1` and applies each through the same idempotent `applyPaymentLog`. Without it, a buyer who closes the tab early leaves an invoice PENDING. See [Verification and the indexer](/docs/verification-and-indexer).

Call it from cron on the server itself:

```
* * * * * curl -s -m 50 -X POST -H "x-indexer-secret: <your INDEXER_SECRET>" http://127.0.0.1:3000/api/indexer >/dev/null 2>&1
```

One call scans every enabled chain; `?chainId=4663` narrows it. Once a minute is a sensible start; running it more often mainly costs RPC calls, since every run is idempotent. The first run starts 5,000 blocks behind the head, later runs continue from `IndexerState.lastBlock + 1`.

> **Tip:** Run the `curl` once by hand. A `200` with `{"ok":true,"chains":[...]}` means the secret and the RPC both work. `401` means the header or `INDEXER_SECRET` is wrong. `207` means one chain's RPC failed; the body says which.

## RPC and the ISP filter

Verification, the indexer and the relay at `POST /api/rpc/4663` all use `RPC_URL_4663`, or the public endpoint when it is empty. The buyer's browser and wallet go through the relay, so the server does all the talking to the chain.

`rpc.mainnet.chain.robinhood.com` is content-filtered by some Indonesian ISPs; a request returns an HTML page instead of JSON. That is why the relay exists, and it follows that the server itself must sit somewhere the endpoint answers. A VPS outside the filter is the simple fix. A dedicated RPC provider in `RPC_URL_4663` works too, with no client change. For local development on a filtered ISP, `.env.example` describes pointing `RPC_URL_4663` at a local forwarder on `127.0.0.1:8545`; the forwarder itself comes from a separate repository, not this one.

The relay is not an open proxy: an allow-list of read methods plus `eth_sendRawTransaction`, bodies capped at 256 KB, batches at 50, and a per-IP token bucket kept in memory, so per process.

## Optional: push and WalletConnect

**Web Push.** Run `npx web-push generate-vapid-keys` once. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key in `VAPID_PRIVATE_KEY`, your address in `VAPID_SUBJECT`, and rebuild. The dashboard then shows `Notify me when paid` and `applyPaymentLog` sends `Invoice paid` to every subscribed device. With either key missing the button is hidden and every send is a no-op.

**WalletConnect.** Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and rebuild. The connect button gains a QR option for mobile wallets. Without it, only injected (browser extension) wallets are offered.

## Upgrading

```bash
cd payrail && git pull
cd web && npm ci && npm run db:push && npm run build
pm2 restart payrail
```

`db:push` is a no-op when the schema has not changed. Build before restarting so the running process is replaced by a complete `.next` directory. This is also the step that picks up a changed `NEXT_PUBLIC_*` value.

## Backups

Back up `web/prisma/dev.db`. For a consistent copy while the app is running:

```bash
sqlite3 web/prisma/dev.db ".backup /backups/payrail-$(date +%F).db"
```

Be clear about what the chain can restore. PAID is re-derivable, within limits: on a fresh database the indexer starts 5,000 blocks behind the head, and anything older is readable through `getPayment(invoiceId)` only if you know the key. Merchants, invoices, descriptions and customer names are not on the chain at all. Lose the file without a backup and the events are still there, but there is nothing to match them against.

## Your own PaymentProcessor

Nothing ties a self-hosted Payrail to our contract. Two ways to point elsewhere:

1. **Deploy your own.** In `contracts/`, set `DEPLOYER_PRIVATE_KEY` with a little ETH on Robinhood Chain and run `npm run go:robinhood` (`-- --dry-run` first). It probes the token for code and `decimals == 6`, deploys, and writes the new address into `web/src/lib/deployments.json`. Rebuild the web app.
2. **Override by environment.** Set `NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_4663` and `NEXT_PUBLIC_USDC_ADDRESS_4663` and rebuild. These win over `deployments.json`.

The token must have 6 decimals. The app labels amounts USDG; on Robinhood Chain the token moved is USDG, and the `USDG` in these variable names is a label, not a claim about the issuer.

Verification filters receipt logs to the configured PaymentProcessor and the indexer scans only that address, so a payment to any other contract is not seen. Decide on the address before you issue invoices and do not switch it while invoices are PENDING. The contract has no owner, no pause and no parameters; there is nothing to configure after deployment.

Questions about running it: support@payrail.app.
