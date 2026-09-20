"use client";

export const STATUS_ORDER = ["PENDING", "PAID", "EXPIRED", "CANCELLED"] as const;
export type StatusFilterValue = "" | (typeof STATUS_ORDER)[number];

const LABEL: Record<StatusFilterValue, string> = {
  "": "All",
  PENDING: "Pending",
  PAID: "Paid",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

/**
 * Chip row that narrows the invoice list by status. EXPIRED and CANCELLED chips only appear once
 * such an invoice exists, so the row stays short for most merchants.
 */
export default function StatusFilter({
  value,
  counts,
  onChange,
}: {
  value: StatusFilterValue;
  counts: Record<string, number>;
  onChange: (v: StatusFilterValue) => void;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const options: StatusFilterValue[] = ["", "PENDING", "PAID", ...STATUS_ORDER.filter((s) => (s === "EXPIRED" || s === "CANCELLED") && (counts[s] ?? 0) > 0)];

  return (
    <div role="group" aria-label="Filter by status" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {options.map((opt) => {
        const active = value === opt;
        const n = opt === "" ? total : counts[opt] ?? 0;
        return (
          <button
            key={opt || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={`relative inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] ${
              active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            {LABEL[opt]}
            <span className={`tnum font-mono text-[11px] ${active ? "text-bg/70" : "text-ink-faint"}`}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}
