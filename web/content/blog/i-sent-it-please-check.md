---
title: "“I Sent It, Please Check.”"
description: "Five words that eat more freelancer and small-business hours than the work being billed. Why the problem is not payment, but matching."
date: 2026-09-03
---

# "I Sent It, Please Check."

If you have ever billed more than three people in one week, you have received that message. Usually with a screenshot. Sometimes the screenshot is cropped. Sometimes the amount is off by a few units because of "fees". Sometimes the transfer has not actually arrived. Sometimes it arrived yesterday, from an account name you do not recognise, and now there are three payments of 250 in your statement and you have no idea which belongs to whom.

This is not a payment problem. The money arrives. It is a **matching** problem: connecting the money that came in with the bill that went out. And matching is work that is unpaid, cannot be delegated, and grows faster than the business does.

## Why it is hard

A bank transfer carries: an amount, a time, a sender name and, if you are lucky, a memo field the sender filled in carelessly. Not one of those is a **bill ID**. You are left guessing from the leftovers.

Amount? Two clients can owe the same figure. Time? You do not know when a client will pay. Name? Clients pay from a spouse's account, a company account, an e-wallet with the display name "cutiepie99". Memo? "payment". Thanks.

So you open a spreadsheet, open the statement, and match line by line. Every month. For every payment. And every time something does not line up, you send the same awkward message: "Hi, was the 250 on the 3rd from you?"

## Stablecoins do not fix it by themselves

Moving to USDC solves several things: no banking hours, no borders, no mystery fees. But a plain USDC transfer carries **less** information than a bank transfer: amount, time, sender address. No memo field. The sender is 42 hex characters you have never seen before.

If you bill in USDC and wait for clients to send to your address, you have only moved the spreadsheet into an explorer. Matching is still manual; the font is just monospace now.

## What is actually needed

The payment has to **say the name of its own bill**. Not in a memo field people forget, but inside the transaction, as something that cannot be dropped or mistyped.

On a blockchain that is easy in a way it never was at a bank: the buyer does not send USDC to your address, they call a contract function with the **bill ID** as an argument. The contract forwards the USDC to you in the same transaction and records an event: *invoice X paid by Z for N*. That event is on chain forever, readable by anyone, and cannot be faked.

Now matching is no longer a guess. Your server reads the event, finds the bill with that ID, checks the recipient and the amount, and marks it paid. No screenshots. No "was that you?". No three anonymous 250s, because each one carries its own ID.

## What does not change

The money still goes straight to you. That matters and is often skipped: most matching "solutions" work by becoming an intermediary. Money goes to them first, they match, then they forward it to you minus a fee, on the next business day. You have traded a matching problem for a custody problem.

The right contract does not need to hold anything. `transferFrom(buyer, merchant)` is one call; the contract just stands beside it, taking notes. Its balance is always zero. Nothing can be stolen from something that is empty.

Nor does it need a separate account anywhere. Payrail runs on Robinhood Chain, an Arbitrum Orbit L2 where the buyer pays gas in a little ETH and there is no Payrail fee. The link carries the network: the buyer's wallet is switched to it, and the payment is looked for there and nowhere else. Your client gets a link that just works, and you get one dashboard.

One thing the link does not carry is your wallet address as a place to "just send to". A plain transfer to your address, from a wallet or an exchange withdrawal, arrives without the bill ID and is the old problem again. Only a payment made through the link names its invoice.

## So

Those five words, "I sent it, please check", are not a complaint about payment. They are an admission that the payment system does not know what is being paid for. Once the transaction carries its own bill ID, the message never needs to be sent again. The client pays; the status changes; you see it when you open the dashboard, or you never see it at all because there is nothing left to check.

That is what we built. How it works is in the [docs](/docs), and what can go wrong is on the [risks page](/docs/risks-and-limits), because "automatic" does not mean "unconditional".

Next: [What Payrail is](/docs/what-payrail-is), then [Getting started](/docs/getting-started) to issue the first invoice.
