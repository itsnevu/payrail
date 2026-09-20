import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Logo";
import { LINKS } from "@/lib/links";
import ProseMenu from "./ProseMenu";
import TocNav, { type TocItem } from "./TocNav";
import "@/styles/prose.css";

const NAV = [
  { href: LINKS.docs, label: "Docs" },
  { href: LINKS.whitepaper, label: "Whitepaper" },
  { href: LINKS.faq, label: "FAQ" },
  { href: LINKS.blog, label: "Blog" },
] as const;

const MENU = [
  { href: LINKS.docs, label: "Docs", note: "Creating, paying and verifying invoices" },
  { href: LINKS.whitepaper, label: "Whitepaper", note: "The full design, end to end" },
  { href: LINKS.faq, label: "FAQ", note: "Short answers, grounded in the code" },
  { href: LINKS.blog, label: "Blog", note: "Notes on what shipped and why" },
  { href: LINKS.app, label: "Dashboard", note: "Your invoices and their status" },
];

const FOOTER: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: LINKS.app, label: "Dashboard" },
      { href: LINKS.newInvoice, label: "New invoice" },
      { href: LINKS.docs, label: "Docs" },
      { href: LINKS.faq, label: "FAQ" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: LINKS.whitepaper, label: "Whitepaper" },
      { href: LINKS.blog, label: "Blog" },
      { href: "/docs/changelog", label: "Changelog" },
      { href: "/docs/api", label: "API" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: LINKS.terms, label: "Terms" },
      { href: LINKS.privacy, label: "Privacy" },
    ],
  },
];

/** Header, footer and page frame shared by every prose page (docs, whitepaper, FAQ, blog, legal). */
export function ProseShell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <div className="lp flex min-h-screen flex-col">
      <header className="prose-header">
        <div className="prose-header-row relative mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 sm:px-8">
          <Link href="/" aria-label="Payrail home" className="shrink-0">
            <Wordmark size={24} markSize={40} />
          </Link>

          <nav aria-label="Site" className="flex items-center gap-1">
            <span className="hidden items-center gap-0.5 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active === item.href ? "page" : undefined}
                  className={`prose-nav-link rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors ${
                    active === item.href ? "text-ink" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </span>
            <Link
              href={LINKS.app}
              className="btn-primary ml-1 h-10 px-4 text-[14px] whitespace-nowrap sm:ml-2"
            >
              <span className="hidden sm:inline">Open&nbsp;</span>
              <span className="sm:lowercase">Dashboard</span>
            </Link>
            <ProseMenu items={MENU} active={active} />
          </nav>
        </div>
      </header>

      <main className="prose-balance flex-1">{children}</main>

      <footer className="mt-24 border-t border-line">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-12 sm:px-8">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] md:gap-8">
            <div className="max-w-sm">
              <Link href="/" aria-label="Payrail home" className="inline-flex">
                <Wordmark size={22} markSize={36} />
              </Link>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
                Payrail is reconciliation software, not a payment service provider. Funds move directly from buyer to
                merchant on Robinhood Chain and never pass through Payrail. Not independently audited.
              </p>
            </div>

            {FOOTER.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <div className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
                  {col.heading}
                </div>
                <ul className="mt-2 space-y-0.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="inline-block py-1 text-[14px] text-ink-soft transition-colors hover:text-ink">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            <span className="text-[13px] text-ink-faint">&copy; {new Date().getFullYear()} Payrail</span>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[12px] tracking-[0.04em] text-ink-soft ring-1 ring-line">
              <span className="prose-status-dot" aria-hidden="true" />
              Robinhood Chain · 4663
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Table of contents built from a document's headings. Sticky column above `lg`, an
 * "On this page" disclosure above the article below it; the heading in view is highlighted.
 */
export function Toc({ items }: { items: TocItem[] }) {
  if (items.length < 3) return null;
  return <TocNav items={items} />;
}
