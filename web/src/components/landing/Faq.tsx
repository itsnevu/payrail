import type React from "react";
import { Fragment } from "react";
import Link from "next/link";
import { LINKS } from "@/lib/links";
import { ArrowIcon } from "@/components/Icons";

/**
 * Six questions from web/content/faq.md, the ones a merchant weighs before sending a first link.
 * Questions and answers are quoted from that file; the only edits are inline code and links
 * rendered as elements. Each item is a native <details>, so it opens without JavaScript.
 */
type Item = { id: string; q: string; a: React.ReactNode[] };

const ITEMS: Item[] = [
  {
    id: "cost",
    q: "What does it cost?",
    a: [
      <Fragment key="p1">
        There is no Payrail fee. The merchant receives exactly <code>amount</code>. The buyer pays gas on Robinhood
        Chain for <code>approve</code> and <code>pay</code>, which needs a little ETH in the buyer&apos;s wallet. We
        do not quote gas figures because the network sets them, not us.
      </Fragment>,
    ],
  },
  {
    id: "custody",
    q: "Do you hold my funds?",
    a: [
      <Fragment key="p2">
        Never, and not by policy but by construction. The only token movement in the contract is{" "}
        <code>safeTransferFrom(msg.sender, merchant, amount)</code>, buyer to merchant, inside <code>pay()</code>.
        There is no code path in which the contract or Payrail is the recipient, no <code>withdraw</code>, no{" "}
        <code>owner</code>, no upgrade. The contract&apos;s balance is zero structurally. Funds land in your wallet,
        not ours.
      </Fragment>,
    ],
  },
  {
    id: "usdg",
    q: "Which token does the buyer pay with?",
    a: [
      <Fragment key="p3">
        USDG (Global Dollar), the six-decimal dollar stablecoin on Robinhood Chain, at{" "}
        <code>0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168</code>. The invoice amount is the exact USDG amount the
        buyer sends; the contract forwards it to the merchant wallet in the same transaction and keeps nothing.
      </Fragment>,
    ],
  },
  {
    id: "wrong-amount",
    q: "Can I pay part of it, or a bit extra?",
    a: [
      <Fragment key="p4">
        No. The payment key is <code>keccak256(abi.encode(salt, merchant, amount))</code>, so any other amount is a
        different key. The tokens would still reach the merchant, but the invoice would stay PENDING and you would
        settle the difference by hand. The pay page always sends the exact amount; this only comes up if you call
        the contract yourself. There are no partial payments or instalments.
      </Fragment>,
    ],
  },
  {
    id: "audit",
    q: "Is Payrail audited?",
    a: [
      <Fragment key="p5">
        Not independently. The contract has had two internal review passes (the second on 17 September 2026, eight
        findings, all resolved), eleven unit tests, and a live end-to-end script that replays the v1 griefing attack
        against a running stack. None of that is a third-party audit, and the docs say so wherever it matters. Bill
        accordingly. See <Link href="/docs/risks-and-limits">Risks and limits</Link>.
      </Fragment>,
    ],
  },
  {
    id: "account",
    q: "Do I need an account?",
    a: [
      <Fragment key="p6">
        No account, no password, no email, no identity check. Your wallet is your identity. A merchant connects a
        wallet on <Link href={LINKS.app}>/app</Link>, types a display name and presses Register; that is the whole
        sign-up. A buyer needs nothing but a wallet holding the token and a little ETH.
      </Fragment>,
      <Fragment key="p7">
        The flip side: there is no merchant authentication yet either. See{" "}
        <Link href={LINKS.faq}>the security section of the FAQ</Link>.
      </Fragment>,
    ],
  },
];

export default function Faq() {
  return (
    <section id="faq" className="lp-section lp-cards lp-faq" aria-labelledby="faq-heading">
      <div className="lp-col lp-cards-head">
        <div className="max-w-xl">
          <p className="lp-kicker">05 · Questions</p>
          <h2 id="faq-heading" className="lp-head">
            Questions people ask.
          </h2>
        </div>
        <div className="flex max-w-sm flex-col items-start gap-6">
          <p className="lp-body lp-muted">
            Short answers, grounded in the code. Where the honest answer is &ldquo;not yet&rdquo;, it says so.
          </p>
          <Link href={LINKS.faq} className="lp-pill lp-pill-sm lp-pill-surface lp-faq-all">
            All questions <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <ul className="lp-col lp-faq-grid">
        {ITEMS.map((item, i) => (
          <li key={item.id} className="lp-tile lp-faq-tile">
            <details className="lp-faq-item surface-interactive" id={`faq-${item.id}`}>
              <summary className="lp-faq-q">
                <span className="lp-faq-num">0{i + 1}</span>
                <span className="lp-faq-text">{item.q}</span>
                <span className="lp-faq-toggle" aria-hidden="true" />
              </summary>
              <div className="lp-faq-a">
                {item.a.map((p, j) => (
                  <p key={j} className="lp-small lp-muted">
                    {p}
                  </p>
                ))}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
