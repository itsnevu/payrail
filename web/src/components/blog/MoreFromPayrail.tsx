import Link from "next/link";
import { LINKS } from "@/lib/links";
import Kicker from "./Kicker";

export type MoreLink = { href: string; label: string; note: string };

/** The three reference destinations, in the order a reader is most likely to want them. */
export const MORE_LINKS = {
  docs: { href: LINKS.docs, label: "Docs", note: "Creating, paying and verifying invoices, step by step." },
  whitepaper: { href: LINKS.whitepaper, label: "Whitepaper", note: "The full design: data model, contract, verification routes, trust." },
  faq: { href: LINKS.faq, label: "FAQ", note: "Short answers to the questions merchants and buyers ask first." },
} as const satisfies Record<string, MoreLink>;

/**
 * A row of reference links at the foot of a blog page. On the index it points at Docs and FAQ,
 * under a post at Docs, Whitepaper and FAQ. Sits in an inset well so it reads as a footnote to
 * the page rather than as more of the page.
 */
export default function MoreFromPayrail({
  heading,
  lede,
  items,
}: {
  heading: string;
  lede?: string;
  items: readonly MoreLink[];
}) {
  return (
    <aside aria-labelledby="more-from-payrail" className="surface-inset mt-16 rounded-[28px] p-6 sm:p-8">
      <Kicker>More from Payrail</Kicker>
      <h2 id="more-from-payrail" className="mt-3 text-[20px] leading-tight font-semibold tracking-[-0.01em] text-ink">
        {heading}
      </h2>
      {lede && <p className="mt-2 max-w-[56ch] text-[14.5px] leading-relaxed text-ink-soft">{lede}</p>}
      <ul className={`mt-6 grid gap-3 ${items.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="surface-interactive group flex h-full flex-col rounded-2xl border border-line bg-surface p-4"
            >
              <span className="flex items-center justify-between gap-2 text-[15px] font-semibold text-ink">
                {item.label}
                <span aria-hidden="true" className="text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink">
                  →
                </span>
              </span>
              <span className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{item.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
