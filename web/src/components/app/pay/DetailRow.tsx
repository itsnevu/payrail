import type { ReactNode } from "react";

/** A definition list of small reference rows: label left, mono value right. */
export function DetailList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`divide-y divide-line/70 ${className}`}>{children}</dl>;
}

/**
 * One row of reference data on the pay page (network, wallet, contract, balance).
 * Values are mono and tabular by default because they are ids, hashes and amounts.
 */
export function DetailRow({
  label,
  children,
  mono = true,
  tone = "ink",
  hint,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  /** `ink` for facts, `soft` for secondary, `alert` for a value that blocks payment. */
  tone?: "ink" | "soft" | "alert";
  /** Small text under the value, e.g. "approval needed". */
  hint?: ReactNode;
}) {
  const color = tone === "alert" ? "text-rose-600" : tone === "soft" ? "text-ink-soft" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-[12px] text-ink-faint">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className={`tnum block break-all text-[12.5px] ${mono ? "font-mono" : ""} ${color}`}>{children}</span>
        {hint && <span className="block text-[11px] text-ink-faint">{hint}</span>}
      </dd>
    </div>
  );
}
