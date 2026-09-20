import type { ReactNode } from "react";

/**
 * One row of a definition list: label on the left, value on the right, stacked on narrow
 * screens. Values that are ids or hashes pass `mono` so they wrap by character.
 */
export function DetailRow({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] text-ink-soft">{label}</dt>
      <dd className={`min-w-0 text-sm text-ink ${mono ? "break-all font-mono text-[13px]" : ""}`}>{children}</dd>
    </div>
  );
}

/** The list itself: hairline dividers, no outer padding so it sits flush in a card. */
export function DetailList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`divide-y divide-line ${className}`}>{children}</dl>;
}
