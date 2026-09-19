import type React from "react";
import Link from "next/link";
import { LINKS } from "@/lib/links";
import ConnectButton from "@/components/ConnectButton";
import { PactMark } from "@/components/Logo";
import StepArt from "@/components/StepArt";
import { ArrowIcon, TelegramIcon, XIcon } from "@/components/Icons";
import { PhoneDefs } from "@/components/Phone";
import MatchGame from "@/components/MatchGame";
import PayDemo from "@/components/PayDemo";
import TrustCards from "@/components/TrustCards";

function Header() {
  return (
    <header className="lp-header">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Payrail home">
        <PactMark size={44} />
        <span className="lp-wordmark text-[26px]">payrail</span>
      </Link>
      <nav className="flex items-center gap-1.5">
        {LINKS.x && (
          <a href={LINKS.x} target="_blank" rel="noreferrer" aria-label="Payrail on X" className="lp-icon-button">
            <XIcon />
          </a>
        )}
        {LINKS.telegram && (
          <a
            href={LINKS.telegram}
            target="_blank"
            rel="noreferrer"
            aria-label="Payrail on Telegram"
            className="lp-icon-button"
          >
            <TelegramIcon />
          </a>
        )}
        <Link href={LINKS.docs} className="lp-small ml-1 hidden px-3 py-2 font-medium sm:block">
          Docs
        </Link>
        <Link href={LINKS.app} className="lp-small hidden px-3 py-2 font-medium sm:block">
          Dashboard
        </Link>
        <ConnectButton className="lp-pill lp-pill-sm lp-pill-ink" label="Get started" />
      </nav>
    </header>
  );
}

/** Three rows the dashboard would show a minute after a link is paid. Same shape as the Phone mock data. */
const HERO_EVENTS: { id: string; who: string; amount: string; state: "paid" | "waiting"; meta: string }[] = [
  { id: "INV-0231", who: "Northwind Studio", amount: "250.00", state: "paid", meta: "block 18,204,311" },
  { id: "INV-0230", who: "Kite & Co", amount: "1,180.00", state: "paid", meta: "block 18,204,290" },
  { id: "INV-0232", who: "Halden Press", amount: "640.00", state: "waiting", meta: "link sent 2m ago" },
];

function Hero() {
  return (
    <section className="lp-hero" data-hero="true">
      <div className="lp-hero-copy">
        <p className="lp-eyebrow">USDC invoices · Non-custodial · Verified onchain</p>
        <h1 className="lp-hero-title" style={{ "--reveal-delay": "60ms" } as React.CSSProperties}>
          Know exactly <em>which invoice</em> got paid.
        </h1>
        <p className="lp-body lp-muted lp-hero-lede" style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
          Create a USDC invoice, send a payment link, and let Payrail match the onchain payment to the right invoice.
          Funds land in your wallet, not ours.
        </p>
        <div className="lp-hero-actions" style={{ "--reveal-delay": "180ms" } as React.CSSProperties}>
          <Link href={LINKS.app} className="lp-pill lp-pill-ink">
            Get started free
          </Link>
          <Link href={LINKS.whitepaper} className="lp-pill lp-pill-ghost">
            Read the whitepaper
            <ArrowIcon className="ml-2 h-4 w-4" />
          </Link>
        </div>
        <p className="lp-hero-note" style={{ "--reveal-delay": "240ms" } as React.CSSProperties}>
          No holding account. No matching bank statements by hand.
        </p>
      </div>

      <div className="lp-hero-art" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero/p-2200.jpg"
          srcSet="/hero/p-1200.jpg 1200w, /hero/p-2200.jpg 2200w"
          sizes="100vw"
          alt=""
          fetchPriority="high"
          decoding="async"
          draggable={false}
        />
        <ul className="lp-hero-strip" aria-label="Example invoice activity">
          {HERO_EVENTS.map((e) => (
            <li key={e.id}>
              <span className={`lp-dot${e.state === "waiting" ? " lp-dot-wait" : ""}`} />
              <span>
                <b>{e.id}</b> · {e.who} · {e.amount} USDC · {e.meta}
              </span>
              <span className="lp-strip-tag">{e.state === "paid" ? "PAID" : "PENDING"}</span>
            </li>
          ))}
        </ul>
      </div>

    </section>
  );
}

/** Sits between the hero and the pay walkthrough: the problem, in one breath, before the second phone. */
function Problem() {
  return (
    <section className="lp-section lp-cards lp-problem">
      <div className="lp-col lp-cards-head">
        <h2 className="lp-head max-w-xl">
          Getting paid is easy.
          <br />
          <span className="lp-muted">Knowing which invoice got paid is not.</span>
        </h2>
        <p className="lp-body lp-muted max-w-sm">
          A USDC transfer carries an amount and a sender, and nothing else. Try matching one yourself: that step is
          the whole product.
        </p>
      </div>
      <div className="lp-col">
        <MatchGame />
      </div>
    </section>
  );
}

function PayVerify() {
  return (
    <div className="lp-panel-wrap">
      <section className="lp-section lp-panel">
        <PayDemo />
      </section>
    </div>
  );
}

const STEPS = [
  { kind: "invoice", name: "INVOICE", tag: "POST /api/invoices", a: "description + amount", b: "unique onchain ID" },
  { kind: "link", name: "LINK", tag: "/pay/:id", a: "one URL", b: "any wallet" },
  { kind: "paid", name: "PAID", tag: "PaymentReceived", a: "matched onchain", b: "history + CSV" },
] as const;

function Steps() {
  return (
    <section className="lp-section lp-cards">
      <div className="lp-col lp-cards-head">
        <div className="max-w-xl">
          <h2 className="lp-head">
            Three steps.
            <br />
            <span className="lp-muted">One transaction.</span>
          </h2>
        </div>
        <div className="flex max-w-sm flex-col items-start gap-6">
          <p className="lp-body lp-muted">
            You write the invoice. The buyer pays from their wallet. Payrail matches the ID, merchant and amount from the
            onchain event, then closes the invoice without you touching anything.
          </p>
          <Link href={LINKS.newInvoice} className="lp-pill lp-pill-ink">
            Create your first invoice <ArrowIcon />
          </Link>
        </div>
      </div>
      <ul className="lp-col lp-grid">
        {STEPS.map((s, i) => (
          <li key={s.name} className="lp-tile">
            <div className="lp-art lp-art-field lp-art-step lp-tilt">
              <span className="lp-art-num">0{i + 1}</span>
              <span className="lp-art-tag lp-art-tag-mono">{s.tag}</span>
              <StepArt kind={s.kind} />
            </div>
            <p className="lp-caption">
              {s.name}{" "}
              <span className="lp-muted">
                {s.a} · {s.b}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Trust() {
  return (
    <div className="lp-on-field">
      <section className="lp-section lp-cards">
        <div className="lp-col lp-cards-head">
          <h2 className="lp-head max-w-xl">
            Verified from the chain,
            <br />
            <span className="lp-muted">not from anyone&apos;s word.</span>
          </h2>
          <p className="lp-body lp-muted max-w-sm">
            Screenshots can be faked. Bank statements can be misread. An onchain event can be neither, and it is the
            only source of truth Payrail trusts.
          </p>
        </div>
        <TrustCards />
      </section>
    </div>
  );
}

const STATS = [
  { figure: "1", unit: "transaction", tag: "pay()", note: "From the buyer: approve USDC, then pay. Nothing else to do." },
  { figure: "0", unit: "USDC held", tag: "custody", note: "Not by the contract, not by us. Funds land in your wallet in the same block." },
  { figure: "2", unit: "ways to verify", tag: "txHash · indexer", note: "The receipt from the browser, and an indexer watching the chain as the safety net." },
];

function Closing() {
  return (
    <div className="lp-on-night">
      <section className="lp-section lp-cards lp-closing">
        <div className="lp-col lp-cards-head">
          <h2 className="lp-head max-w-xl">
            Stop matching statements.
            <br />
            <span className="lp-muted">Start sending links.</span>
          </h2>
        </div>
        <ul className="lp-col lp-grid lp-grid-4">
          {STATS.map((s) => (
            <li key={s.figure} className="lp-tile">
              <div className="lp-art lp-art-outline lp-stat lp-tilt">
                <span className="lp-stat-tag">{s.tag}</span>
                <span className="lp-stat-big">
                  <span className="lp-stat-figure">{s.figure}</span>
                  <span className="lp-stat-unit">{s.unit}</span>
                </span>
                <span className="lp-note">{s.note}</span>
              </div>
            </li>
          ))}
          <li className="lp-tile">
            <Link href={LINKS.app} className="lp-art lp-art-cta lp-stat">
              <span className="lp-stat-tag">Free · Arc Testnet</span>
              <span className="lp-stat-big">
                <span className="lp-figure">Get started</span>
                <span className="lp-stat-unit">Connect a wallet. No account, no KYC to send a link.</span>
              </span>
              <span className="lp-arrow">
                <ArrowIcon size={32} />
              </span>
            </Link>
          </li>
        </ul>

        <footer className="lp-col lp-footer">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <PactMark size={40} />
              <span className="lp-wordmark text-[24px]">payrail</span>
            </div>
            <p className="lp-small lp-muted max-w-md">
              Payrail is reconciliation software, not a payment service provider. USDC moves directly from buyer to
              merchant on a public blockchain.
            </p>
            <span className="lp-small lp-muted">Not audited. Running on Arc Testnet.</span>
          </div>
          <div className="flex flex-col items-start gap-5 lg:items-end">
            {(LINKS.x || LINKS.telegram) && (
              <div className="flex items-center gap-1.5">
                {LINKS.x && (
                  <a href={LINKS.x} target="_blank" rel="noreferrer" aria-label="Payrail on X" className="lp-icon-button">
                    <XIcon />
                  </a>
                )}
                {LINKS.telegram && (
                  <a
                    href={LINKS.telegram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Payrail on Telegram"
                    className="lp-icon-button"
                  >
                    <TelegramIcon />
                  </a>
                )}
              </div>
            )}
            <nav className="lp-small flex flex-wrap gap-x-6 gap-y-2 lg:justify-end">
              <Link href={LINKS.app}>Dashboard</Link>
              <Link href={LINKS.docs}>Docs</Link>
              <Link href={LINKS.whitepaper}>Whitepaper</Link>
              <Link href={LINKS.blog}>Blog</Link>
              <Link href={LINKS.terms}>Terms</Link>
              <Link href={LINKS.privacy}>Privacy</Link>
            </nav>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <main className="lp flex-1 overflow-x-clip">
      <PhoneDefs />
      <Header />
      <Hero />
      <Problem />
      <PayVerify />
      <Steps />
      <Trust />
      <Closing />
    </main>
  );
}
