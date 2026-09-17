import Link from "next/link";
import { LINKS } from "@/lib/links";
import ConnectButton from "@/components/ConnectButton";
import { PactMark } from "@/components/Logo";
import StepArt from "@/components/StepArt";
import { ArrowIcon, TelegramIcon, XIcon } from "@/components/Icons";
import { DashboardPhone, PayPhone, PhoneDefs } from "@/components/Phone";
import { HeroBackdrop } from "@/components/HeroBackdrop";

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

function Hero() {
  return (
    <section className="lp-section lp-hero lp-glass" data-hero="true">
      <HeroBackdrop />
      <div className="lp-col lp-col-left order-1">
        <h1 className="lp-display">Know exactly which invoice got paid.</h1>
      </div>
      <div className="lp-portal order-2">
        <DashboardPhone />
      </div>
      <div className="lp-col lp-col-right order-3 flex flex-col items-start gap-6">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <p className="lp-body lp-muted">
            Create a USDC invoice, send a payment link, and let Payrail match the onchain payment to the right invoice.
            Funds land in your wallet, not ours.
          </p>
          <Link href={LINKS.app} className="lp-pill lp-pill-ink self-center">
            Get started free
          </Link>
        </div>
        <p className="lp-small lp-muted">No holding account. No matching bank statements by hand.</p>
      </div>
    </section>
  );
}

const OLD_WAY = [
  "Send the invoice, then wait for a \"sent it, please check\" message.",
  "Open the wallet, scroll the history, guess which transfer is theirs.",
  "Match the amount by hand. Hope nobody paid the same number.",
  "Reply \"received\", update the sheet, forget one, chase it next month.",
];
const NEW_WAY = [
  "One invoice, one payment link, one onchain ID.",
  "The buyer pays. The contract emits the event with the ID.",
  "Payrail matches merchant, amount and ID from the event.",
  "The invoice is marked PAID. History and CSV are already there.",
];

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
          A USDC transfer carries an amount and a sender, and nothing else. Every freelancer and small shop ends up
          reconciling by hand. That step is the whole product.
        </p>
      </div>
      <div className="lp-col lp-compare">
        <div className="lp-compare-col lp-compare-old">
          <span className="lp-compare-tag">Today</span>
          <ol className="lp-compare-list">
            {OLD_WAY.map((t, i) => (
              <li key={t}>
                <span className="lp-compare-num">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <span className="lp-compare-foot lp-muted">Manual, every single time.</span>
        </div>
        <div className="lp-compare-col lp-compare-new">
          <span className="lp-compare-tag">With Payrail</span>
          <ol className="lp-compare-list">
            {NEW_WAY.map((t, i) => (
              <li key={t}>
                <span className="lp-compare-num">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <span className="lp-compare-foot">Automatic. Funds never held.</span>
        </div>
      </div>
    </section>
  );
}

function PayVerify() {
  return (
    <div className="lp-panel-wrap">
      <section className="lp-section lp-panel">
        <div className="lp-col lp-col-left order-1">
          <h2 className="lp-head">
            Send the link.
            <br />
            <span className="lp-muted">Receive USDC. Marked paid.</span>
          </h2>
        </div>
        <div className="lp-portal order-2">
          <PayPhone />
        </div>
        <div className="lp-col lp-col-right order-3 flex flex-col items-start gap-6">
          <p className="lp-body max-w-sm">
            The buyer opens the link, approves USDC, and calls <code className="font-mono text-[0.9em]">pay()</code>{" "}
            with the invoice ID. The contract forwards USDC straight to the merchant and emits one event. The backend
            reads that receipt and event, never a claim from the browser, and marks the invoice <strong>PAID</strong>.
          </p>
          <Link href="/docs/payment-flow" className="lp-pill lp-pill-surface">
            See how it works <ArrowIcon />
          </Link>
        </div>
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
            <div className="lp-art lp-art-field lp-art-step">
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

const TRUST = [
  {
    figure: "Matched onchain",
    note: "The backend re-validates merchant and amount from the PaymentReceived event, not from frontend input. Anything that does not match never becomes PAID.",
  },
  {
    figure: "Funds never held",
    note: "PaymentProcessor forwards USDC straight to the merchant wallet inside the same transaction. The contract never holds anyone's balance.",
  },
  {
    figure: "Once, and only once",
    note: "A paid invoice is rejected by the contract (InvoiceAlreadyPaid), and txHash is unique in the database. Verification is idempotent; a double payment can never be recorded twice.",
  },
];

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
        <ul className="lp-col lp-grid">
          {TRUST.map((t) => (
            <li key={t.figure} className="lp-tile">
              <div className="lp-art lp-art-surface lp-art-stat">
                <span className="lp-figure">{t.figure}</span>
                <span className="lp-note">{t.note}</span>
              </div>
            </li>
          ))}
        </ul>
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
              <div className="lp-art lp-art-outline lp-stat">
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
