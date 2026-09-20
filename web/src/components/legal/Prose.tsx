import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Small typographic primitives for the legal pages. They mirror what lib/markdown.tsx produces for
 * the docs (same sizes, same tokens) so Terms and Privacy read as part of the same set, while the
 * text itself stays in JSX where each clause can carry an id and a link.
 */

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[16px] leading-[1.65] text-ink-soft">{children}</p>;
}

/** The term being defined, in ink so it stands out from the surrounding soft text. */
export function Term({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

/** Inline code: identifiers, statuses, addresses, function names. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="break-all rounded-md bg-field px-1.5 py-0.5 font-mono text-[0.86em] text-ink">
      {children}
    </code>
  );
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="space-y-2.5 pl-1">{children}</ul>;
}

export function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-[16px] leading-[1.65] text-ink-soft">
      <span aria-hidden="true" className="mt-[0.72em] h-1.5 w-1.5 flex-none rounded-full bg-ink-faint" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Internal link. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-ink underline decoration-line underline-offset-[3px] hover:decoration-ink">
      {children}
    </Link>
  );
}

/** External link; opens in a new tab and says so to assistive tech. */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-ink underline decoration-line underline-offset-[3px] hover:decoration-ink"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** A quiet inset well for the one sentence in a section the reader should not skim past. */
export function Note({ label = "Note", children }: { label?: string; children: ReactNode }) {
  return (
    <div className="surface-inset rounded-2xl px-4 py-3.5 sm:px-5">
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</div>
      <div className="mt-1.5 text-[15px] leading-[1.6] text-ink">{children}</div>
    </div>
  );
}

/** A block someone would copy: an address, a hash, a URL. */
export function Mono({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="surface-inset flex flex-col gap-1 rounded-2xl px-4 py-3">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</span>
      <span className="break-all font-mono text-[13px] leading-relaxed text-ink">{children}</span>
    </div>
  );
}

/** Reference table. Header row plus label per cell below sm, so it never forces a page-wide scroll. */
export type DataRow = { data: ReactNode; why: ReactNode; keep: ReactNode };

export function DataTable({ rows, caption }: { rows: DataRow[]; caption: string }) {
  const cols: { key: keyof DataRow; label: string }[] = [
    { key: "data", label: "Data" },
    { key: "why", label: "Why we have it" },
    { key: "keep", label: "How long" },
  ];
  return (
    <div role="table" aria-label={caption} className="surface overflow-hidden rounded-[24px] text-[14.5px]">
      <div role="row" className="hidden grid-cols-[1.15fr_1.5fr_1fr] gap-4 border-b border-line bg-field/70 px-5 py-3 sm:grid">
        {cols.map((c) => (
          <div
            key={c.key}
            role="columnheader"
            className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint"
          >
            {c.label}
          </div>
        ))}
      </div>
      <div role="rowgroup">
        {rows.map((row, i) => (
          <div
            key={i}
            role="row"
            className="grid grid-cols-1 gap-2 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[1.15fr_1.5fr_1fr] sm:gap-4"
          >
            {cols.map((c) => (
              <div key={c.key} role="cell" className="min-w-0 leading-[1.55]">
                <span className="mr-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint sm:hidden">
                  {c.label}
                </span>
                <span className={c.key === "data" ? "font-medium text-ink" : "text-ink-soft"}>{row[c.key]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
