---
title: Glossary
description: The terms the Payrail docs use, from allowance to WalletConnect, each in a sentence or two with a link to the page that covers it.
order: 13
section: Reference
---

# Glossary

Short definitions of the words the other pages use without stopping to explain, each linked to the page that goes deeper.

## A to C

**allowance.** How much of a token one address lets another move on its behalf. The pay page reads `allowance(buyer, PaymentProcessor)` and skips approve when it already covers the invoice. [Paying an invoice](/docs/paying-an-invoice).

**approve.** The ERC-20 call that sets an allowance, `USDC.approve(PaymentProcessor, amount)`. The first of the buyer's two wallet prompts, before `pay`. [Payment flow](/docs/payment-flow).

**Arbitrum Orbit.** The framework Robinhood Chain is built on: a layer 2 that runs the same EVM, so ordinary wallets and ERC-20 tokens work unchanged. [Wallet setup](/docs/wallet-setup).

**block confirmation.** One more block on top of the block holding a transaction. Payrail waits for `CONFIRMATIONS_4663` of them (2 in the example configuration) before marking PAID. [Verification](/docs/verification-and-indexer).

**Blockscout.** The public explorer for Robinhood Chain, `https://robinhoodchain.blockscout.com`. Every PAID invoice links to its transaction there. [Contracts](/docs/contracts).

**chain id.** The number that tells networks apart: Robinhood Chain 4663, its testnet 46630, local hardhat 31337. Every invoice stores its chain id; a payment on any other does not count. [Wallet setup](/docs/wallet-setup).

**cursor.** The indexer's bookmark, `IndexerState.lastBlock`, one row per chain. Each run scans from `lastBlock + 1` to the confirmed head. [Verification](/docs/verification-and-indexer).

**custodial vs non-custodial.** A custodial service holds your money on the way through; Payrail never does. `pay` calls `safeTransferFrom(buyer, merchant, amount)`, so the token never passes through the contract and there is nothing to withdraw. [What Payrail is](/docs/what-payrail-is).

## E to I

**ERC-20.** The token standard behind `balanceOf`, `approve`, `allowance` and `transferFrom`. USDG is one, hence approve then transfer. [Contracts](/docs/contracts).

**event (log).** A structured record a contract writes into a transaction receipt. Part of the block, so a client cannot fake one; PAID is decided from `PaymentReceived` alone. [Verification](/docs/verification-and-indexer).

**gas.** The fee a network charges to run a transaction, paid in ETH on Robinhood Chain. The buyer pays gas for approve and pay; there is no Payrail fee. [Wallet setup](/docs/wallet-setup).

**idempotent.** Safe to run more than once. `applyPaymentLog` is, so both routes can see the same payment and one `Payment` row results. [Verification](/docs/verification-and-indexer).

**indexer.** The backend job that scans Robinhood Chain for `PaymentReceived` events, 2,000 blocks at a time, and applies each one, reported by a browser or not. [Verification](/docs/verification-and-indexer).

**invoice key.** See payment key.

## M to P

**merchant.** The party being paid: a wallet address registered on the dashboard with a display name. The contract sees only the address. [Creating invoices](/docs/creating-invoices).

**nonce.** A per-account counter that orders an address's transactions, managed by the wallet. Not the salt.

**payment key (onchainId).** `keccak256(abi.encode(salt, merchant, amount))`, the 32-byte value that ties an invoice to its payment. The database calls it `onchainId`, the contract and the event `invoiceId`, the invoice page Payment key (onchain). [Contracts](/docs/contracts).

**PaymentProcessor.** Payrail's only contract, about 90 lines on top of OpenZeppelin, at `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D` on Robinhood Chain. Forwards the token from buyer to merchant, records the payment under the payment key, emits `PaymentReceived`. No owner, no pause, no upgrade. [Contracts](/docs/contracts).

**PaymentReceived.** The event `pay` emits: `(invoiceId, salt, merchant, payer, amount, timestamp)`. The only input to the PAID decision. [Verification](/docs/verification-and-indexer).

**PENDING, PAID, CANCELLED, EXPIRED.** The four invoice statuses. PAID is set only by verifying a `PaymentReceived` event. CANCELLED lives in the database only; a cancelled invoice paid on chain becomes PAID. EXPIRED is set when an overdue invoice is read; there is no scheduler. [Risks and limits](/docs/risks-and-limits).

**plain transfer.** An ERC-20 `transfer` straight to the merchant's address, from a wallet or an exchange withdrawal, without calling `pay()`. It emits no `PaymentReceived`, so it never closes an invoice; the tokens sit in the merchant's wallet and the invoice stays PENDING. [Payment flow](/docs/payment-flow).

**PWA.** Progressive web app: a site that installs from the browser through a manifest and a service worker. Payrail is one. [Getting started](/docs/getting-started).

## R to S

**receipt.** What the network returns once a transaction is mined: status, block number and logs. The fast route reads the one the browser's `txHash` points to. [Verification](/docs/verification-and-indexer).

**relay.** `POST /api/rpc/4663`, a same-origin endpoint forwarding an allow-list of JSON-RPC methods to Robinhood Chain, needed because some ISPs filter the public RPC. A transport, not a trust boundary. [Wallet setup](/docs/wallet-setup).

**reorg.** The chain replaces its most recent blocks, and a payment in a replaced block can vanish. Confirmations reduce the risk; there is no mechanism to revert PAID. [Risks and limits](/docs/risks-and-limits).

**Robinhood Chain.** The only network Payrail runs on: an Arbitrum Orbit L2, chain id 4663, gas in ETH, dollar token USDG. [Wallet setup](/docs/wallet-setup).

**RPC.** The JSON-RPC interface for reading a chain and broadcasting transactions. The server uses `https://rpc.mainnet.chain.robinhood.com` unless `RPC_URL_4663` overrides it; browsers use the relay. An RPC can hide a transaction but cannot invent one. [Security model](/docs/security).

**SafeERC20.** The OpenZeppelin wrapper `PaymentProcessor` uses for the transfer. A token that returns `false` instead of reverting is turned into a revert, so a failed transfer is never recorded. [Contracts](/docs/contracts).

**salt.** `keccak256(invoice.id)`, a 32-byte value derived from the invoice's random id. The first argument to `pay(salt, merchant, amount)`. [Contracts](/docs/contracts).

**SIWE.** Wallet-signature sign-in: proving control of a wallet by signing a message, with no password. Not built yet: no merchant-facing API route is authenticated (only the indexer checks a secret), so anyone can create invoices for any merchant. [Security model](/docs/security).

**smallest units (6 decimals).** The integer a token is really counted in. USDG has 6 decimals, so an invoice created with amount `1.50` is stored, passed to `pay` and returned by the API as `1500000`. [API](/docs/api).

## T to Z

**transaction hash (txHash).** The 32-byte identifier of a transaction. The pay page sends it to `/verify` as a pointer to a receipt; on its own it claims nothing. Unique in the database. [Verification](/docs/verification-and-indexer).

**USDC (as used in the UI).** The label the app, CSV export and push notifications use for amounts. On Robinhood Chain the token actually moved is USDG; the label has not been renamed yet. [Wallet setup](/docs/wallet-setup).

**USDG.** Global Dollar, the dollar stablecoin on Robinhood Chain, 6 decimals, at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. `PaymentProcessor` is bound to it, immutably. [Contracts](/docs/contracts).

**VAPID.** The key pair that identifies a server to browser push services. With both keys set, and a browser that supports push, the dashboard offers Notify me when paid; without them push is off. [Self-hosting](/docs/self-hosting).

**wallet.** Software that holds keys and signs transactions. The wallet address is the identity; there are no passwords. Injected (browser extension) wallets are always offered; WalletConnect only when configured. [Wallet setup](/docs/wallet-setup).

**WalletConnect.** A protocol that links a wallet on another device to a site through a QR code. Offered only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set. [Wallet setup](/docs/wallet-setup).

Next: [FAQ](/faq) for the questions these terms come up in, and [Troubleshooting](/docs/troubleshooting) for the error messages.
