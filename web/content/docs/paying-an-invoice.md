---
title: Paying an invoice (buyer guide)
description: What to expect when someone sends you a Payrail payment link, from opening it to the transaction that is your receipt.
order: 6
section: Using Payrail
---

# Paying an invoice (buyer guide)

Someone sent you a link that looks like `https://payrail.tech/pay/<id>`. This page explains what happens when you open it, what your wallet asks you to sign, and how to tell that the payment went through. The mechanics behind it are in [Payment flow](/docs/payment-flow).

Before anything else: check that the address bar says `payrail.tech`, and that the merchant name and amount at the top are what you agreed. If either is wrong, stop and ask the merchant. Nothing can be reversed afterwards.

## What the page shows

**Payment to** and the merchant's name, a status pill (PENDING until paid), the description and the amount labelled USDG. Below, in small type: **Due** (if set), **Network** (Robinhood Chain), **To wallet** (the merchant's address) and **Contract** (the PaymentProcessor).

> **Note:** the app labels amounts USDG. On Robinhood Chain the token that moves is USDG (Global Dollar, 6 decimals, `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`). Your wallet may name the token USDG in its prompts. That is expected.

The **To wallet** address comes from the merchant's registration record, not from whoever created the invoice. The contract at `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D` forwards tokens from your wallet to that address; it never holds a balance. If the invoice is already paid, expired or cancelled, the page says so and there is no button.

## Connect a wallet

Press **Connect wallet**. The page uses the wallet injected into your browser: an extension, or the browser built into a mobile wallet app. When the operator has configured WalletConnect (an optional setting, not always on), the button opens a QR modal for a phone wallet if no wallet is injected, and a **Mobile** button sits next to it if one is. If the button reads **No wallet**, open the link inside your wallet app's browser instead. Connecting moves nothing; it lets the page read your balance and allowance.

## Switch or add the network

Invoices are pinned to Robinhood Chain (chain id 4663). If your wallet is on another network the page says **This invoice is paid on Robinhood Chain.** and shows a **Switch to Robinhood Chain** button. Press it; the wallet asks you to switch, or to add the chain first if it has never seen it. The chain definition lists the Payrail relay (`/api/rpc/4663`) first and the public RPC `https://rpc.mainnet.chain.robinhood.com` second, because some ISPs filter the public endpoint. The relay only forwards calls.

Gas is paid in **ETH**. You need a little ETH on Robinhood Chain on top of the stablecoin. The page does not check it; your wallet will tell you if it is short.

## Balance and allowance

Connected on the right network, the page reads three things from the chain: your token balance, the allowance you have granted the PaymentProcessor, and `isPaid(key)` for this invoice. **Your USDG balance** is shown under the step list. If it is below the invoice amount, the button reads **Insufficient balance** and is disabled. If your allowance already covers the amount, the Approve step disappears and paying is one transaction.

## Approve

Press **Pay**. If your allowance is short, the wallet opens the first prompt: `approve(PaymentProcessor, amount)` on the token contract. The button reads `1/2 Approving USDG… (confirm in wallet)`.

The approval is for the **exact invoice amount**, not unlimited; with a standard token, `pay()` spends all of it and the allowance is back to zero. Approving costs gas and moves nothing. The page then re-reads your allowance up to ten times, 1.5 seconds apart, and opens the second prompt.

## Pay

The second prompt is `pay(salt, merchant, amount)` on the PaymentProcessor. The button reads `2/2 Paying… (confirm in wallet)`. All three arguments come from the invoice record; nothing you typed goes into the call.

In that one transaction the contract checks the merchant and amount (`InvalidMerchant`, `InvalidAmount`), derives the payment key, refuses if it is already paid (`InvoiceAlreadyPaid`), records the payment, moves the tokens to the merchant with `safeTransferFrom` and emits `PaymentReceived`. There is no Payrail fee: the merchant receives exactly the amount on the page, and you pay the gas.

## Waiting for confirmations

The page shows `tx 0x…`, waits for the receipt, then reads **Verifying onchain…** while it sends the hash to the Payrail server. The server reads the receipt itself, waits for the configured number of confirmations (`CONFIRMATIONS_4663`, two in the example configuration) and looks for a `PaymentReceived` event whose key matches this invoice. While the server answers "not yet", the page asks again every 3 seconds, up to twenty times, so about a minute in all.

Closing the tab here does not lose anything. The tokens moved when the transaction was mined, and the indexer the operator runs against `POST /api/indexer` scans the chain for `PaymentReceived` on its own and marks the invoice PAID without your browser. See [Verification and the indexer](/docs/verification-and-indexer).

## Paid: the transaction is your receipt

The page shows **Invoice paid** and the transaction hash as a link to `https://robinhoodchain.blockscout.com/tx/<hash>`. That hash is the receipt: it names your address as payer, the merchant as recipient, the amount and the block. Payrail issues no separate receipt document. If the merchant asks for proof, send the hash.

## Common wallet messages

The page prints the first line of whatever the wallet or the RPC returned.

| Message | Meaning | What to do |
| --- | --- | --- |
| `User rejected the request` | You closed or rejected the prompt | Press **Pay** again |
| `insufficient funds` (mentions gas) | Not enough ETH on Robinhood Chain | Add a little ETH, retry |
| **Insufficient balance** (button) | Token balance below the amount | Top up USDG on Robinhood Chain |
| A revert from `pay`, naming `InvoiceAlreadyPaid` | The contract already holds a payment under this key | Refresh; it should show paid |
| An allowance error from the token (wording depends on the token) | The approval had not landed before `pay()` | Wait for the approve to mine, press **Pay** again |
| `transaction reverted` | Mined but failed; nothing moved | Open the explorer link, then retry |
| `timed out waiting for confirmations, try refreshing` | The page gave up after twenty tries | Refresh; the indexer marks it PAID independently |
| `This invoice is on <network>`, no button | This deployment does not serve that chain | Ask the merchant for a new link |

None of these leave money in between: either the tokens are with the merchant, or they are still with you.

## Safety

- **Verify the domain** every time: `payrail.tech`. A lookalike page can pass a different `merchant` argument, and the contract will forward your tokens to it.
- **Keep the link to yourself.** Payment links are public: anyone holding the URL sees the terms and can pay. Never paste it into a form, a chat or a wallet's send field. It is a web page, not an address.
- **Pay from a wallet, not from an exchange.** An exchange withdrawal is a plain `transfer` to whatever address you type. It does not call `pay()`, emits no `PaymentReceived`, and can never close an invoice, which is why the page shows the merchant's address as information and not as somewhere to send to. Withdraw to your own wallet first, then open the link.
- **Read the wallet prompt.** The approval names the PaymentProcessor as spender and the exact amount. A different amount or an unlimited approval: reject.
- **Do not pay twice.** If the page hangs, refresh before retrying. The contract rejects a second payment of the same terms with `InvoiceAlreadyPaid`, but a second `approve` still costs gas.
- **Cancelled is not a lock.** A merchant can cancel an invoice in Payrail, but the contract does not know. The page hides the button, but if the same arguments reach `pay()` from any other tool the tokens go to the merchant and the invoice is marked PAID. Do not pay an invoice the merchant told you to ignore.
- **Nothing can be reversed.** Not by the contract, not by us. Payrail never holds your tokens. The only remedy for a mistaken payment is the merchant sending it back by hand.

If something looks wrong and the merchant cannot help, write to support@payrail.app with the invoice link and the transaction hash. Known limits are in [Risks and limits](/docs/risks-and-limits).

Next: [Troubleshooting](/docs/troubleshooting) for every message the page can show, and [Wallet setup](/docs/wallet-setup) if the wallet cannot reach Robinhood Chain.
