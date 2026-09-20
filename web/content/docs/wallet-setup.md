---
title: Wallet setup for Robinhood Chain
description: Add Robinhood Chain to your wallet, get a little ETH for gas and USDG to pay with, and see why the browser and the wallet reach the chain through payrail.tech.
order: 3
section: Start here
---

# Wallet setup for Robinhood Chain

Payrail runs on one network, **Robinhood Chain** (chain id 4663). The merchant needs a wallet address to register; the buyer needs a wallet that knows this network, a little ETH on it for gas, and USDG for the invoice. This page covers all three and the one network quirk that matters: the public RPC is filtered by some ISPs.

## Which wallets work

Payrail offers two connectors.

- **Injected wallets**, meaning a browser extension or a wallet's own in-app browser that exposes `window.ethereum`. Always offered.
- **WalletConnect**, a QR code or deep link to a wallet on your phone. Offered only when the deployment sets `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. Without it, the connect button uses the injected connector and the **Mobile** button does not appear.

Without an extension and without WalletConnect, the connect button has nothing to talk to. On a phone in that situation, open the payment link inside your wallet's built-in browser; the pay page says the same under the button.

## Adding Robinhood Chain

### Let the pay page add it

You usually do not have to add the network by hand. When a connected wallet is on another network, the pay page and the dashboard show **Switch to Robinhood Chain**. Pressing it sends `wallet_switchEthereumChain`. If the wallet does not know chain 4663 (error `4902`), wagmi follows up with `wallet_addEthereumChain` and the wallet shows its own add-network prompt. Approve it. If the wallet does not switch as part of adding the network, press **Switch to Robinhood Chain** again.

The prompt is filled from `web/src/lib/chains.ts`: name `Robinhood Chain`, chain id `0x1237` (4663), currency `ETH` with 18 decimals, the Blockscout explorer, and one RPC URL. That URL is the same-origin relay, `https://payrail.tech/api/rpc/4663`, not the public endpoint. The chain definition lists the public endpoint second, but wagmi's injected connector passes only the first entry, so the wallet keeps the relay as its RPC for this network. What that means is explained below.

### Add it by hand

To add the network yourself, use these values.

| Field | Value |
| --- | --- |
| Network name | Robinhood Chain |
| Chain id | 4663 |
| RPC URL | `https://rpc.mainnet.chain.robinhood.com` |
| Currency symbol | ETH |
| Block explorer | `https://robinhoodchain.blockscout.com` |

Where the public endpoint is filtered, set the RPC URL to `https://payrail.tech/api/rpc/4663` instead. The chain id must be 4663 either way; the pay page sends nothing from a wallet on another network.

## ETH for gas

Robinhood Chain is an Arbitrum Orbit L2 and its gas token is **ETH**. ETH on any other network does not count; it has to sit on Robinhood Chain in the paying wallet.

A payment is at most two transactions, `approve` and `pay`, so a little ETH covers many invoices. Payrail charges no fee; gas is the only cost and the buyer pays it. Merchants need ETH only if they send transactions themselves; registering and creating invoices are database writes and cost no gas.

Getting ETH onto Robinhood Chain is outside Payrail. Check Robinhood's own documentation for the current options; we do not run a bridge or a faucet.

## USDG, labelled USDG

The token that moves when an invoice is paid is **USDG** (Global Dollar, 6 decimals) at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. The app labels amounts "USDG" on every screen, in the CSV export and in notifications; on Robinhood Chain the token moved is USDG. An invoice for 100 USDG is paid with exactly 100 USDG. Any other token, or USDG on any other network, does not count.

The buyer needs USDG in the paying wallet before opening the link. The pay page reads `balanceOf` and disables the button as **Insufficient balance** when the balance is below the invoice amount. How USDG gets into a wallet on Robinhood Chain is, again, documented by Robinhood, not by us.

## The RPC and the ISP filter

The public RPC, `https://rpc.mainnet.chain.robinhood.com`, is content-filtered by some Indonesian ISPs. On such a connection a browser cannot reach the chain directly.

Payrail routes around this with a **same-origin relay**: the browser sends its JSON-RPC calls to `POST /api/rpc/4663` on payrail.tech and the server forwards them to the chain. The relay accepts an allow-list of read and broadcast methods (`eth_call`, `eth_getBalance`, `eth_estimateGas`, `eth_getTransactionReceipt`, `eth_sendRawTransaction` and a few more), rejects anything else with `Method not relayed`, caps bodies at 256 KB, and rate limits per IP (20 requests per second, burst 60). It is a transport, not a trust boundary: PAID is still decided from a `PaymentReceived` event the server reads itself.

The relay covers the page, but the wallet has its own RPC for the network, and the nonce lookup, gas estimate and broadcast happen there. If the wallet's stored RPC for chain 4663 is the public endpoint and your ISP filters it, the page loads fine and the transaction never leaves the wallet. Two ways out:

1. Let the pay page add the network, as described above. The wallet then stores `https://payrail.tech/api/rpc/4663` and its calls go through the relay too.
2. If the network is already in the wallet, edit its RPC URL to the relay address.

The trade-off: that network entry then depends on payrail.tech being up, and wallet features that need a method outside the allow-list will not work on it. On an unfiltered connection the public endpoint is the more independent choice.

> **Note:** The relay only exists on the Payrail deployment you are using. A self-hosted Payrail passes its own origin, and `NEXT_PUBLIC_RPC_URL_4663` can point the browser somewhere else entirely.

## WalletConnect

WalletConnect is optional and off by default. A deployment that sets `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` gets a QR modal for phone wallets and a **Mobile** button next to the connect button. If that button is missing, only injected wallets are offered. A wallet connected this way uses its own RPC settings, so the relay advice above applies to it as well.

## The testnet

Robinhood Chain Testnet (chain id 46630, explorer `https://explorer.testnet.chain.robinhood.com`) is configured in the code but has **no PaymentProcessor deployment yet**. Production enables 4663 only, so no invoice can be created for the testnet and nothing there counts as a payment. Local development uses a Hardhat node (chain id 31337) with a mock token. See [/docs/contracts](/docs/contracts) for how deployments are recorded and [/docs/paying-an-invoice](/docs/paying-an-invoice) for the buyer flow once the wallet is ready.
