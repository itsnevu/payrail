import { ProseShell, Toc } from "@/components/prose/ProseShell";
import Kicker from "@/components/blog/Kicker";
import { stripLeadingH1 } from "@/components/prose/stripTitle";
import { Markdown, headings } from "@/lib/markdown";
import { whitepaper, formatDate } from "@/lib/content";
import { ALL_CHAINS, addressUrl } from "@/lib/chains";
import { shortAddr } from "@/lib/usdc";

/** The deployed PaymentProcessor on Robinhood Chain (chain id 4663), as the meta row links it. */
const ROBINHOOD = ALL_CHAINS[4663];
const CONTRACT = ROBINHOOD.paymentProcessor ?? "0xD591A0d397179dE0692d50f43AC450C6cDF9C66D";
const CONTRACT_URL = addressUrl(4663, CONTRACT);

export function generateMetadata() {
  const doc = whitepaper();
  return {
    title: "Whitepaper: Payrail",
    description: doc.description || "The design, mechanics and failure modes of Payrail USDG payment reconciliation.",
  };
}

export default function WhitepaperPage() {
  const doc = whitepaper();
  // The body opens with the same `# Title` the header prints, so drop it before rendering.
  const body = stripLeadingH1(doc.body);

  return (
    <ProseShell active="/whitepaper">
      <div className="mx-auto w-full max-w-[1180px] px-5 pt-14 sm:px-8 md:pt-20">
        {/* document header */}
        <header className="max-w-[72ch]">
          <Kicker>Whitepaper</Kicker>
          <h1 className="mt-5 text-[38px] leading-[1.04] font-semibold tracking-[-0.03em] text-ink [text-wrap:balance] sm:text-[48px] lg:text-[56px]">
            {doc.title}
          </h1>

          {doc.description && (
            <div className="surface-inset mt-8 rounded-[24px] p-6 sm:p-7">
              {/* The body's first section is "## Abstract" itself; this card is the one-paragraph version. */}
              <div className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
                In brief
              </div>
              <p className="mt-2.5 text-[16px] leading-[1.65] text-ink-soft sm:text-[17px]">{doc.description}</p>
            </div>
          )}

          <dl className="tnum mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[12.5px] text-ink-soft">
            {doc.date && (
              <div className="flex items-center gap-2">
                <dt className="text-ink-faint">Date</dt>
                <dd>
                  <time dateTime={doc.date}>{formatDate(doc.date)}</time>
                </dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <dt className="text-ink-faint">Reading</dt>
              <dd>{doc.minutes} min</dd>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <dt className="text-ink-faint">Contract</dt>
              <dd className="min-w-0">
                <a
                  href={CONTRACT_URL}
                  target="_blank"
                  rel="noreferrer"
                  title={`${CONTRACT} on Blockscout`}
                  className="inline-flex items-center gap-1.5 text-ink underline decoration-line decoration-[1.5px] underline-offset-[3px] transition-colors hover:decoration-ink"
                >
                  <span>{shortAddr(CONTRACT)}</span>
                  <span className="text-ink-faint">on Robinhood Chain</span>
                  <span aria-hidden="true" className="text-ink-faint">
                    ↗
                  </span>
                </a>
              </dd>
            </div>
          </dl>
        </header>
      </div>

      {/* body with the table of contents on the right from lg */}
      <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 pt-10 pb-4 sm:px-8 md:pt-14 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-14">
        <article className="min-w-0 max-w-[72ch]">
          <Markdown source={body} />
        </article>
        <Toc items={headings(body)} />
      </div>
    </ProseShell>
  );
}
