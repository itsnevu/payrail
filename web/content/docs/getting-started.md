---
title: Getting started
description: Register a wallet, create your first invoice, share the link and watch it turn PAID, in about five minutes on payrail.tech.
order: 2
section: Start here
---

# Getting started

The first five minutes on [https://payrail.tech](https://payrail.tech): register a wallet, create an invoice, share the link, watch it turn PAID. If you want the reasoning first, read [What Payrail is](/docs/what-payrail-is).

## Before you begin

**A wallet.** No accounts, passwords or KYC. Your wallet address is your identity and your payout address. Any injected (browser extension) wallet works; WalletConnect is offered only on deployments that have it configured. See [Wallet setup](/docs/wallet-setup).

**No ETH, no tokens.** Registering and creating invoices are plain API calls, not transactions. You sign nothing and pay no gas. Only the buyer needs funds: a little ETH on Robinhood Chain for gas, and enough of the dollar token to cover the invoice.

**One network.** Payrail runs on Robinhood Chain (chain id 4663), an Arbitrum Orbit L2 with ETH as the gas token. The app labels amounts USDG; the token that moves on Robinhood Chain is USDG (Global Dollar, 6 decimals). Same amount, same decimals, a different ticker on screen.

## 1. Connect and register

1. Open [/app](/app) and press **Connect wallet**.
2. If the connected wallet is not registered yet, a form appears under **Register this wallet as a merchant**. Type a name (the placeholder reads `Business or freelancer name`) and press **Register**.
3. The dashboard loads for that merchant.

The name is display only; buyers see it as `Payment to <name>`. The connected wallet becomes the payout address. The contract sends funds there and nothing can redirect them, so register from a wallet you control, not an exchange deposit address.

## 2. Create the first invoice

Press **New invoice** on the dashboard, or open [/invoices/new](/invoices/new).

| Field | Rule |
| --- | --- |
| Description | Required, up to 500 characters. The buyer sees it. |
| Customer name | Optional, up to 200 characters. |
| Amount (USDG) | Greater than zero, up to 6 decimals. Quick chips: `50`, `100`, `250`, `500`, `1000`. |
| Due date | Optional. The day is stored as midnight UTC at its start, so pick tomorrow or later; a due date of today is already past and the invoice reads EXPIRED at once. Past the due date the payment page refuses to pay and the invoice is marked EXPIRED the next time it is read. The contract does not know about due dates; a direct `pay()` call still goes through and the invoice becomes PAID. |

The **Buyer sees** panel beside the form previews the payment page as you type. Press **Create invoice & payment link**. You land on the invoice page.

No transaction was sent. The server stored the invoice and derived its payment key, `keccak256(abi.encode(salt, merchant, amount))`, shown as **Payment key (onchain)**. The contract recomputes that key when the buyer pays. Details in [Creating invoices](/docs/creating-invoices).

## 3. Share the link

The payment link is `https://payrail.tech/pay/<id>`. While the invoice is PENDING the invoice page offers three ways to hand it over:

- **The QR code.** The buyer scans it with a phone.
- **Share** or **Copy.** On phones with a share sheet the button reads Share and opens whatever messaging app is installed. Elsewhere it reads Copy and puts the link on the clipboard.
- **Open.** Opens the payment page in a new tab, to check what the buyer will see.

**Send reminder** hands over the same link with a prefilled message that starts `Friendly reminder, this invoice is still open` where a share sheet exists; elsewhere it copies the link. **Duplicate** starts a new invoice with the same description, customer name and amount. The due date is not copied.

> **Note:** Payment links are public. Anyone holding the URL sees the merchant name, description and amount, and anyone can pay it. Do not put secrets in the description.

Send the link, not your wallet address. A plain transfer to your address, including a withdrawal from an exchange, never calls `pay()` and never closes an invoice. The tokens arrive; the invoice stays PENDING.

## 4. What the buyer sees

The payment page shows `Payment to <your name>`, the description, the amount, the due date if you set one, the network, and shortened forms of your wallet address and the contract address. The buyer connects a wallet. On another network the page offers **Switch to Robinhood Chain**; the wallet prompts to add the chain if it does not know it.

The buyer presses **Pay <amount> USDG**. That takes up to two wallet prompts: an approval for the contract to move the amount (skipped when an earlier approval still covers it), then `pay(salt, merchant, amount)`. The contract forwards the funds from the buyer to your wallet in that same transaction and never holds them. The page shows `Verifying onchain…`, then `Invoice paid`. Step by step in [Paying an invoice](/docs/paying-an-invoice).

## 5. Watch the status change to PAID

You do not have to refresh. The invoice page polls every 5 seconds while PENDING, the dashboard every 8. When the payment lands the invoice shows **Paid** with the date, the payer, the block number and a link to the transaction on Blockscout.

PAID is decided by our server from the `PaymentReceived` event in the receipt, after the configured number of block confirmations (`CONFIRMATIONS_4663=2` in the shipped configuration), never from anything the buyer's browser claims. The browser only hands over a transaction hash; the server fetches the receipt itself. A second route, the indexer, scans the chain for the same event each time it runs, so a payment still counts when the buyer closed the tab early. See [Verification and the indexer](/docs/verification-and-indexer).

## 6. Dashboard, stats and CSV

The dashboard shows **Received**, the total of verified payments, and a line like `3 invoices · 1 awaiting payment · 250.00 USDG outstanding`. The **Activity** panel lists the last five verified payments with their block numbers. Above the list, a merchant select (`All merchants` or one of them) and a row of status chips (All, Pending, Paid, plus Expired and Cancelled when any exist) narrow what is shown; the chips filter the loaded list and change nothing on the server.

**Export CSV** downloads every invoice for the selected merchant (every merchant when the filter reads `All merchants`) as `payrail-invoices-<timestamp>.csv`, one row per invoice with network, amount, status, payer, transaction hash, explorer URL and block number. The amount column is named `amount_usdc`; on Robinhood Chain those units are USDG. Columns in [API](/docs/api).

## 7. Install it as an app

On desktop, an **Install app** button appears in the header once the browser decides the site is installable. On iOS, tap Share in Safari, then Add to Home Screen. Installed, Payrail opens in its own window straight on the dashboard, with two shortcuts, New invoice and Dashboard. The service worker caches static files only, never `/api/*`, so invoice status and payments always need a connection; without one, a page that is not cached falls back to a plain offline page until the connection returns.

## 8. Turn on push notifications

Push is optional. When the browser supports it and the server has Web Push keys, the dashboard shows **Notify me when paid**. Press it, allow notifications, and the button reads **Notifications on**; a paid invoice then sends a notification titled `Invoice paid` to that device. Press it again to turn it off. No button means push is not available in that browser or on that deployment. There are no webhooks.

## What to test first

> **Tip:** Pay yourself before you bill anyone. It costs a little gas, and the money ends up back in your own wallet.

1. Put a little ETH and at least 1 USDG (the app shows it as 1 USDG) in a second wallet, the buyer.
2. From your merchant wallet, create an invoice for `1` with the description `Test`.
3. Open the payment link from the buyer wallet, ideally on a phone. Approve, then pay.
4. Back on the merchant dashboard, the invoice turns PAID once the transaction has the required confirmations, with the block number and a Blockscout link.
5. Press **Export CSV** and check the row.

If step 4 does not happen within a minute, see [Troubleshooting](/docs/troubleshooting).

## Where to go next

- [Creating invoices](/docs/creating-invoices) for every field.
- [Payment flow](/docs/payment-flow) for what moves where, and when.
- [Risks and limits](/docs/risks-and-limits) before you bill real money. Payrail is beta and not independently audited.
