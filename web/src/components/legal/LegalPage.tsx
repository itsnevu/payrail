import Link from "next/link";
import type { ReactNode } from "react";
import { ProseShell, Toc } from "@/components/prose/ProseShell";
import { CONTACT_EMAIL } from "@/lib/links";
import { readingMinutes } from "./wordCount";

export type LegalSectionDef = {
  /** Anchor id; also what the Toc links to. */
  id: string;
  title: string;
  body: ReactNode;
};

type Sibling = { href: string; label: string; blurb: string };

type Props = {
  /** Kicker pill: "Terms" or "Privacy". */
  kind: string;
  title: string;
  lede: ReactNode;
  /** As printed: "20 September 2026". */
  updated: string;
  sections: LegalSectionDef[];
  /** The other legal page, linked at the foot. */
  sibling: Sibling;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Frame for Terms and Privacy: header (kicker, title, lede, updated date, reading time), an inline
 * contents list for narrow screens, the sticky Toc from ProseShell on wide ones, then numbered
 * sections each with its own id.
 */
export function LegalPage({ kind, title, lede, updated, sections, sibling }: Props) {
  const minutes = readingMinutes(sections.map((s) => [s.title, s.body]));
  const tocItems = sections.map((s, i) => ({ id: s.id, text: `${i + 1}. ${s.title}`, level: 2 }));

  return (
    <ProseShell>
      <div className="mx-auto grid w-full max-w-[1180px] gap-14 px-5 py-12 sm:px-8 md:py-16 lg:grid-cols-[minmax(0,1fr)_220px]">
        <article className="min-w-0 max-w-[72ch]">
          <header>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-faint">
              <span className="rounded-full bg-field px-2.5 py-1 font-semibold text-ink-soft">{kind}</span>
              <span>Last updated {updated}</span>
              <span aria-hidden="true">·</span>
              <span className="tnum">{minutes} min read</span>
            </div>
            <h1 className="mt-5 text-[36px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[44px]">
              {title}
            </h1>
            <div className="mt-5 text-[17px] leading-[1.6] text-ink-soft">{lede}</div>
          </header>

          {/* Contents, inline, for every width below lg where the sticky Toc is hidden. */}
          <nav aria-label="Contents" className="surface mt-8 rounded-[24px] px-5 py-4 lg:hidden">
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Contents</div>
            <ol className="mt-2.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex min-h-9 items-center gap-2.5 py-1 text-[14px] leading-snug text-ink-soft hover:text-ink">
                    <span className="tnum font-mono text-[12px] text-ink-faint">{pad(i + 1)}</span>
                    <span>{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-12 sm:mt-12 sm:space-y-14">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
                <h2
                  id={`${s.id}-title`}
                  className="flex items-baseline gap-3 text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink sm:text-[24px]"
                >
                  <span className="tnum font-mono text-[13px] font-medium text-ink-faint">{pad(i + 1)}</span>
                  <span>{s.title}</span>
                </h2>
                <div className="mt-4 space-y-4">{s.body}</div>
              </section>
            ))}
          </div>

          <footer className="mt-16 border-t border-line pt-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href={sibling.href} className="surface-interactive rounded-2xl p-4">
                <div className="text-[12px] text-ink-faint">Also read</div>
                <div className="mt-1 text-[15px] font-semibold text-ink">{sibling.label}</div>
                <div className="mt-1 text-[13.5px] leading-snug text-ink-soft">{sibling.blurb}</div>
              </Link>
              <a href={`mailto:${CONTACT_EMAIL}`} className="surface-interactive rounded-2xl p-4">
                <div className="text-[12px] text-ink-faint">Questions</div>
                <div className="mt-1 break-all font-mono text-[14px] font-medium text-ink">{CONTACT_EMAIL}</div>
                <div className="mt-1 text-[13.5px] leading-snug text-ink-soft">
                  One address for support, privacy requests and security reports.
                </div>
              </a>
            </div>
            <p className="mt-6 text-[13px] text-ink-faint">
              {kind} last updated {updated}. The date at the top changes whenever the text does.
            </p>
          </footer>
        </article>

        <Toc items={tocItems} />
      </div>
    </ProseShell>
  );
}
