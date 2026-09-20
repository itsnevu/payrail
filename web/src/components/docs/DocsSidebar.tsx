import Link from "next/link";
import type { Doc } from "@/lib/content";

type Section = { section: string; pages: Doc[] };

/**
 * Left column of a docs page: every page grouped by section, in reading order, with the page the
 * reader is on highlighted. Hidden below `lg`; `DocsJump` covers small screens.
 */
export function DocsSidebar({ sections, current }: { sections: Section[]; current: string }) {
  return (
    <nav aria-label="Docs pages" className="hidden h-full lg:block">
      <div className="sticky top-[92px] max-h-[calc(100vh-120px)] overflow-y-auto pr-2 pb-6">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> All docs
        </Link>

        {sections.map((group, gi) => (
          <div key={group.section} className={gi === 0 ? "mt-6" : "mt-7"}>
            <div className="px-3 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
              {String(gi + 1).padStart(2, "0")} · {group.section}
            </div>
            <ul className="mt-2 space-y-0.5">
              {group.pages.map((p) => {
                const active = p.slug === current;
                return (
                  <li key={p.slug}>
                    <Link
                      href={`/docs/${p.slug}`}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-1.5 text-[13.5px] leading-snug transition-colors ${
                        active ? "bg-field font-semibold text-ink" : "text-ink-soft hover:bg-surface hover:text-ink"
                      }`}
                    >
                      {p.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-8 border-t border-line pt-5">
          <div className="px-3 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
            Also
          </div>
          <ul className="mt-2 space-y-0.5">
            <li>
              <Link href="/whitepaper" className="block rounded-lg px-3 py-1.5 text-[13.5px] text-ink-soft transition-colors hover:bg-surface hover:text-ink">
                Whitepaper
              </Link>
            </li>
            <li>
              <Link href="/faq" className="block rounded-lg px-3 py-1.5 text-[13.5px] text-ink-soft transition-colors hover:bg-surface hover:text-ink">
                FAQ
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
