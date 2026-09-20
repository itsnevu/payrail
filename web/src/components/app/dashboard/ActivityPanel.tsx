import Link from "next/link";
import { Chip } from "@/components/Logo";
import { formatUsdc } from "@/lib/usdc";
import { invNo, relDay } from "./format";
import type { Invoice } from "./types";

/** Latest verified payments, newest first. Each row is a PaymentReceived event the backend has verified. */
export default function ActivityPanel({ activity, loaded }: { activity: Invoice[]; loaded: boolean }) {
  return (
    <aside className="surface h-fit overflow-hidden rounded-[24px] border border-line" aria-label="Activity">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-[15px] font-medium text-ink-soft">Activity</h2>
        <span className="font-mono text-[11px] text-ink-faint">PaymentReceived</span>
      </div>
      {activity.length === 0 ? (
        <p className="px-5 py-8 text-center text-[14px] text-ink-soft">{loaded ? "Verified payments show up here." : "…"}</p>
      ) : (
        <ul>
          {activity.map((i) => (
            <li key={i.id} className="border-b border-line last:border-0">
              <Link href={`/invoices/${i.id}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-field">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink">
                  <Chip size={20} color="var(--on-ink)" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{invNo(i.id)} verified</span>
                  <span className="block truncate font-mono text-[12px] text-ink-soft">
                    {i.payment?.blockNumber ? `block ${Number(i.payment.blockNumber).toLocaleString("en-US")}` : "onchain"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum block text-[15px]">+{formatUsdc(i.amount)}</span>
                  <span className="block text-[13px] text-ink-soft">{relDay(i.payment!.paidAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
