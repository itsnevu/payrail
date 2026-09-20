import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { Chip } from "@/components/Logo";
import { ChevronIcon } from "@/components/Icons";
import { formatUsdc } from "@/lib/usdc";
import { chainName } from "@/lib/chains";
import { LINKS } from "@/lib/links";
import { fullDate, invNo, relDay } from "./format";
import type { Invoice } from "./types";

/**
 * Chip tint per status, from the palette tokens so the tile reads on the light `bg-field` well
 * (the phone mockup uses the same idea on its dark ground). PAID is ink, PENDING fades, the rest are quiet.
 */
const STATUS_COLORS: Record<string, string> = {
  PAID: "var(--ink)",
  PENDING: "var(--ink-faint)",
  EXPIRED: "var(--line)",
  CANCELLED: "var(--line)",
};

const TH = "px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint first:pl-5 last:pr-5";

/** Three shimmer rows while the first fetch is in flight. */
export function InvoiceSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading invoices">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-field" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-field" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-field" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded bg-field" />
        </li>
      ))}
    </ul>
  );
}

/** Shown when the merchant has no invoices at all. */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-14 text-center">
      <div className="flex items-center gap-2">
        <Chip size={28} color="var(--ink)" />
        <Chip size={28} color="var(--bg)" stroke="var(--ink)" />
        <Chip size={28} color="var(--ink-soft)" />
      </div>
      <div>
        <p className="text-[16px] font-medium">No invoices yet</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[14px] leading-relaxed text-ink-soft">
          Create one, send the link, and it shows up here as PAID the moment the payment lands. The app labels amounts USDC; on
          Robinhood Chain the token moved is USDG.
        </p>
      </div>
      <Link className="btn-primary" href={LINKS.newInvoice}>
        Create your first invoice
      </Link>
    </div>
  );
}

/** Shown when the status filter leaves nothing to list. */
export function FilteredEmpty({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-[15px] font-medium">No {label.toLowerCase()} invoices</p>
      <button type="button" className="btn-secondary" onClick={onClear}>
        Show all
      </button>
    </div>
  );
}

/**
 * The invoice list: a table from `sm` up, stacked cards below it. Every row is one link to the
 * invoice page. The latest verified payment is tinted so it reads first.
 */
export default function InvoiceList({ invoices, latestPaidId }: { invoices: Invoice[]; latestPaidId?: string }) {
  return (
    <>
      {/* sm+: table */}
      <div className="hidden sm:block">
        <table className="w-full border-collapse text-[14px]">
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className={TH}>
                Invoice
              </th>
              <th scope="col" className={TH}>
                Description
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Amount
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={`${TH} hidden md:table-cell`}>
                Created
              </th>
              <th scope="col" className={`${TH} hidden lg:table-cell`}>
                Chain
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => {
              const hi = i.id === latestPaidId;
              return (
                <tr key={i.id} className={`relative border-b border-line last:border-0 ${hi ? "bg-field" : ""}`}>
                  <td className="py-3.5 pl-5 pr-3 align-middle">
                    {/* The stretched pseudo-element makes the whole row the link target. */}
                    <Link
                      href={`/invoices/${i.id}`}
                      className="tnum font-mono text-[13px] text-ink after:absolute after:inset-0 after:content-['']"
                      aria-label={`Open ${invNo(i.id)}`}
                    >
                      {invNo(i.id)}
                    </Link>
                  </td>
                  <td className="max-w-[1px] px-3 py-3.5 align-middle">
                    <span className="block truncate text-[15px]">{i.customerName || i.description}</span>
                    <span className="block truncate text-[13px] text-ink-soft">{i.customerName ? i.description : i.merchant.name}</span>
                  </td>
                  <td className="tnum whitespace-nowrap px-3 py-3.5 text-right align-middle text-[16px]">
                    {formatUsdc(i.amount)} <small className="text-[12px] text-ink-soft">USDC</small>
                  </td>
                  <td className="px-3 py-3.5 align-middle">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3.5 align-middle text-[13px] text-ink-soft md:table-cell">
                    <time dateTime={i.createdAt} title={fullDate(i.createdAt)}>
                      {relDay(i.createdAt)}
                    </time>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3.5 align-middle font-mono text-[12px] text-ink-soft lg:table-cell">
                    {chainName(i.chainId)}
                  </td>
                  <td className="py-3.5 pl-3 pr-5 text-right align-middle">
                    <ChevronIcon className="inline-block h-4 w-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* below sm: stacked cards */}
      <ul className="sm:hidden">
        {invoices.map((i) => {
          const hi = i.id === latestPaidId;
          return (
            <li key={i.id} className={`border-b border-line last:border-0 ${hi ? "bg-field" : ""}`}>
              <Link href={`/invoices/${i.id}`} className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-field">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-field">
                  <Chip size={22} color={STATUS_COLORS[i.status] ?? "var(--line)"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{i.customerName || i.description}</span>
                  <span className="mt-0.5 block truncate font-mono text-[12px] text-ink-soft">
                    {invNo(i.id)} <span aria-hidden="true">·</span> <time dateTime={i.createdAt}>{relDay(i.createdAt)}</time>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum flex items-baseline justify-end gap-1 text-[17px] leading-none">
                    {formatUsdc(i.amount)} <small className="text-[11px] text-ink-soft">USDC</small>
                  </span>
                  <span className="mt-1.5 flex justify-end">
                    <StatusBadge status={i.status} />
                  </span>
                </span>
                <ChevronIcon className="h-4 w-4 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
