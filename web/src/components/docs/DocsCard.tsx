import Link from "next/link";
import type { Doc } from "@/lib/content";

/** One page on the docs index: its number in reading order, title, description and reading time. */
export function DocsCard({ page, number }: { page: Doc; number: number }) {
  return (
    <Link
      href={`/docs/${page.slug}`}
      className="surface-interactive group flex h-full flex-col rounded-[24px] border border-line p-6"
    >
      <span className="flex items-center justify-between">
        <span className="tnum font-mono text-[12px] text-ink-faint">{String(number).padStart(2, "0")}</span>
        <span className="tnum font-mono text-[11px] tracking-[0.06em] text-ink-faint uppercase">{page.minutes} min</span>
      </span>
      <span className="mt-3 text-[18px] leading-snug font-semibold tracking-[-0.01em] text-ink">{page.title}</span>
      <span className="mt-2 flex-1 text-[14.5px] leading-relaxed text-ink-soft">{page.description}</span>
      <span className="mt-5 flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition-colors group-hover:text-ink">
        Read
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
