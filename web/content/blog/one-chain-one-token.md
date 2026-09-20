---
title: "One Chain, One Token"
description: "Why Payrail runs on Robinhood Chain only, with one dollar token, what that decision removes from the product, what it costs the buyer, and the same-origin RPC relay it forced us to build."
date: 2026-09-20
---

# One Chain, One Token

Payrail runs on exactly one network, Robinhood Chain (chain id 4663), and moves exactly one token there, USDG. This post is about that decision: what it takes out of the product, what it costs, and the one practical wrinkle it produced. Most of the value of the decision is in what we no longer have to write.

## One chain

The contract does not know which chain it is on. `invoiceKey(salt, merchant, amount)` is a pure function of three arguments, and the same terms hash to the same `bytes32` on every deployment. That is fine when there is one deployment that matters and a testnet and a local node beside it for rehearsals. It becomes a reconciliation problem the moment there are two networks a buyer could plausibly pay on.

So every invoice is pinned to a network at creation (`Invoice.chainId`), and `applyPaymentLog` refuses to mark PAID unless the network the event was seen on equals the invoice's `chainId`. In production `NEXT_PUBLIC_CHAINS` is `4663` and nothing else. The network selector on the new invoice form only renders when more than one chain is enabled, so on Payrail it does not render at all. The buyer never picks a network; a wallet on any other network sees `Switch to Robinhood Chain` where the pay button would be, and a wallet that does not know the chain yet is asked to add it.

Robinhood Chain is an Arbitrum Orbit L2 with ETH as the gas token. The deployed PaymentProcessor is `0xD591A0d397179dE0692d50f43AC450C6cDF9C66D`, and its `usdc` field is `immutable`, so that deployment is bound to one token forever. A second token would be a second contract.

## One token, and the label

The token that actually moves on Robinhood Chain is **USDG** (Global Dollar), 6 decimals, at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. The app labels every amount USDG: the amount field, the pay button, the CSV column `amount_usdc`, the push notification. The contract's storage variable is called `usdc` too.

> **Note:** The label is a name for "the dollar token this deployment moves", not a claim about who issues it. The address in the wallet prompt, and in `/api/chains`, is USDG.

The label exists because the contract and the app were written around a generic six-decimal dollar token and called it `usdc` (the local test token is still `MockUSDC`); the deployment to Robinhood Chain came after the name was everywhere. Renaming every label is cosmetic, and we would rather ship the honest note than a half-finished rename. Nothing in the matching logic depends on the word. `applyPaymentLog` compares `log.amount` to `invoice.amount` in smallest units, and the contract checks nothing about the amount except `amount != 0` and the uint96 ceiling.

## What it removes

Each of these is a feature we do not have to build, document, test or explain on the risks page.

- **Chain selection.** No dropdown on the invoice form, no "which network did you mean" on the pay page, one explorer base URL.
- **Token selection.** No token list, no per-token decimals, no price conversion. One token, one `decimals`, one address to check in the wallet prompt.
- **Bridging questions.** We do not tell buyers how to move funds between networks, because there is only one network to be on. The requirement is USDG for the amount and a little ETH for gas, both on Robinhood Chain. How the buyer gets them is between the buyer and their wallet.
- **Cross-chain reconciliation.** There is no question of the same invoice being paid on two networks and which one counts. The pinned `chainId` and the address filter in the verifier answer it before it is asked: an event from another deployment lands under the same key over there and never touches the invoice here.
- **A second indexer cursor and a second confirmation count to reason about.** The code supports one cursor per chain (`IndexerState` is keyed by `chainId`); with one enabled chain that table never holds more than one row.

It also shrinks the trust list. [Risks and limits](/docs/risks-and-limits) names the contract, our backend, the RPC provider and the token issuer. Each is singular because the deployment is singular.

## What it costs

The buyer has to be on Robinhood Chain. Not "can pay from anywhere and we sort it out": on that chain, with USDG in the wallet, with enough ETH for two transactions (approve, then pay; one if an earlier allowance still covers the amount). A buyer who holds dollars on some other network has work to do before the pay button is enabled, and Payrail does not help with that work.

We think that is the right trade for reconciliation software. The moment funds could arrive on more than one network, PAID stops being a single lookup and becomes a policy, and policies are where "I sent it, please check" comes back. A buyer on the wrong network sees `This invoice is paid on Robinhood Chain.` and a `Switch to Robinhood Chain` button, and that is the whole conversation.

A second cost is smaller but real: if the chain's RPC is unreachable, nobody can pay or verify until it is back. `RPC_URL_4663` can point the server at a second provider, but there is no other network to fall over to.

## The wrinkle: a filtered RPC

Robinhood Chain's public RPC, `https://rpc.mainnet.chain.robinhood.com`, is content-filtered by some ISPs, including some in Indonesia. On those connections, talking to the public endpoint directly, the pay page cannot read `balanceOf`, `allowance` or `isPaid`, and the wallet cannot broadcast. The chain is fine. The route to it is not.

The fix is a same-origin relay. The browser and the wallet talk to `POST /api/rpc/4663` on `payrail.tech`, and the server forwards the JSON-RPC body to the chain. The chain definition the wallet receives when it adds Robinhood Chain lists the relay first and the public endpoint second, so a wallet that can reach the public RPC keeps a fallback and a wallet that cannot still works.

The relay is deliberately narrow:

- an allow-list of methods, all reads plus `eth_sendRawTransaction`; anything else answers `-32601 Method not relayed: <method>`;
- a 256 KB body limit, 50 items per batch, a 25 second upstream timeout;
- a per-IP token bucket, `RPC_RELAY_RATE` 20 requests a second bursting to `RPC_RELAY_BURST` 60, then `429`;
- `cache-control: no-store` on every response.

`eth_sendRawTransaction` is the one write, and it is the wallet's own signed transaction. The relay cannot alter it, cannot sign anything, and never sees a key.

## What the relay does not change

The relay moves bytes. It does not move trust. PAID is still decided by the server reading a `PaymentReceived` log out of a real receipt, filtered to our contract address, on the invoice's own chain, after `CONFIRMATIONS_4663` blocks. Nothing a browser sends through `/api/rpc/4663` can make that happen; the only way to make an invoice PAID is to actually pay it.

The same applies to a lying RPC on the server side. It can hide a transaction and make an invoice look PENDING for longer. It cannot fabricate one, because the verifier needs a receipt and a log, and the indexer needs the same log from `getContractEvents`. If the public endpoint misbehaves, `RPC_URL_4663` points the server elsewhere and the relay follows.

## In one paragraph

One network, pinned per invoice. One token, immutable in the contract, labelled USDG in the app and named USDG in every address that matters. No chain picker, no token picker, no bridging advice, no cross-chain matching. The buyer has to be on Robinhood Chain with USDG and a little ETH, and the pay page gets them there or says why it cannot. Where an ISP gets in the way, the relay carries the same requests through our origin and changes nothing about what we trust.

The mechanics of the pinning and the address filter are in [Verification and the indexer](/docs/verification-and-indexer). The relay's limits are in [Risks and limits](/docs/risks-and-limits) and the [API reference](/docs/api). What the buyer sees, step by step, is in [Paying an invoice](/docs/paying-an-invoice).
