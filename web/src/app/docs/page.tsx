import Link from "next/link";
import { ProseShell } from "@/components/prose/ProseShell";
import { DocsCard } from "@/components/docs/DocsCard";
import { docsPages, docsSections } from "@/lib/content";

export const metadata = {
  title: "Docs: Payrail",
  description:
    "How Payrail works: getting started, wallet setup, creating and paying invoices, onchain verification, contracts, API, self-hosting and troubleshooting.",
};

const QUICK_LINKS = [
  { href: "/docs/paying-an-invoice", label: "Pay your first invoice" },
  { href: "/docs/wallet-setup", label: "Wallet setup" },
  { href: "/docs/troubleshooting", label: "Troubleshooting" },
  { href: "/faq", label: "FAQ" },
] as const;

export default function DocsIndex() {
  const pages = docsPages();
  const sections = docsSections();
  const numberOf = (slug: string) => pages.findIndex((p) => p.slug === slug) + 1;

  return (
    <ProseShell active="/docs">
      <div className="mx-auto w-full max-w-[1080px] px-5 py-14 sm:px-8 md:py-20">
        {/* header */}
        <header className="max-w-[64ch]">
          <p className="lp-kicker">Documentation</p>
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink sm:text-[48px]">
            Guides and reference for Payrail
          </h1>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-ink-soft">
            A USDC invoice that closes itself. These pages cover how to create one, how the buyer pays it, how the
            payment is matched from the chain, what the contract and the backend guarantee, and what you are trusting
            when you use it.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/docs/getting-started" className="btn-primary h-11 px-5 text-[14.5px]">
              Getting started
            </Link>
            <Link href="/docs/api" className="btn-secondary h-11 px-5 text-[14.5px]">
              API reference
            </Link>
          </div>
        </header>

        {/* quick links */}
        <nav aria-label="Quick links" className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-line py-4">
          <span className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
            Quick links
          </span>
          <ul className="flex flex-wrap gap-2">
            {QUICK_LINKS.map((q) => (
              <li key={q.href}>
                <Link
                  href={q.href}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-field hover:text-ink"
                >
                  {q.label}
                  <span aria-hidden className="text-ink-faint">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* sections */}
        {sections.map((group, gi) => (
          <section key={group.section} aria-labelledby={`docs-section-${gi}`} className="mt-14 first:mt-12">
            <p className="lp-kicker">
              {String(gi + 1).padStart(2, "0")} · {group.section}
            </p>
            <h2 id={`docs-section-${gi}`} className="sr-only">
              {group.section}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.pages.map((page) => (
                <li key={page.slug}>
                  <DocsCard page={page} number={numberOf(page.slug)} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* whitepaper */}
        <div className="surface-inset mt-16 rounded-[24px] p-6 sm:p-8">
          <p className="lp-kicker">Whitepaper</p>
          <div className="text-[19px] font-semibold tracking-[-0.01em] text-ink">Want the full design?</div>
          <p className="mt-2 max-w-[56ch] text-[14.5px] leading-relaxed text-ink-soft">
            The whitepaper covers the mechanics end to end: the data model, the contract, the two verification routes,
            the trust assumptions, and what is still missing.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/whitepaper" className="btn-primary h-10 px-4 text-[14px]">
              Read the whitepaper
            </Link>
            <Link href="/faq" className="btn-secondary h-10 px-4 text-[14px]">
              Or the FAQ
            </Link>
          </div>
        </div>
      </div>
    </ProseShell>
  );
}
