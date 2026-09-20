import type { ReactNode } from "react";
import { CheckIcon } from "@/components/Icons";
import { shortAddr } from "@/lib/usdc";
import { txUrl } from "@/lib/chains";
import { fmtBlock, fmtDate, fmtDateTime } from "./format";

type Payment = { txHash: string; payer: string; amount: string; paidAt: string; blockNumber: string };

type Event = {
  key: string;
  title: string;
  when?: string;
  body?: ReactNode;
  /** done: filled dot. live: hollow dot with a pulse. off: hollow, muted. */
  state: "done" | "live" | "off";
};

/**
 * The life of an invoice as a vertical list: created, link ready, then paid / cancelled /
 * expired, or still waiting. Every row is derived from the record; nothing here is a guess
 * about what the merchant did with the link.
 */
export default function InvoiceTimeline({
  status,
  createdAt,
  dueAt,
  chainId,
  payment,
  explorerName = "explorer",
}: {
  status: string;
  createdAt: string;
  dueAt?: string | null;
  chainId: number;
  payment?: Payment | null;
  explorerName?: string;
}) {
  const events: Event[] = [
    {
      key: "created",
      title: "Invoice created",
      when: fmtDateTime(createdAt),
      body: "Payment key derived from the merchant address and the amount.",
      state: "done",
    },
    {
      key: "link",
      title: "Link ready",
      body: "Send the link or show the QR. The invoice does not know when that happens.",
      state: "done",
    },
  ];

  if (payment) {
    const url = txUrl(chainId, payment.txHash);
    events.push({
      key: "paid",
      title: "Paid",
      when: fmtDateTime(payment.paidAt),
      state: "done",
      body: (
        <span className="block space-y-1">
          <span className="block">
            From <span className="font-mono text-ink">{shortAddr(payment.payer)}</span>
            {payment.blockNumber ? (
              <>
                {" "}· block <span className="font-mono tabular-nums text-ink">{fmtBlock(payment.blockNumber)}</span>
              </>
            ) : null}
          </span>
          <span className="block break-all font-mono text-[11px]">
            {url ? (
              <a className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink" href={url} target="_blank" rel="noreferrer">
                {payment.txHash}
              </a>
            ) : (
              payment.txHash
            )}
          </span>
          <span className="block">Matched from the PaymentReceived event, not from the buyer.</span>
        </span>
      ),
    });
  } else if (status === "CANCELLED") {
    events.push({
      key: "cancelled",
      title: "Cancelled",
      state: "done",
      body: "Cancelled from the dashboard. The contract does not know: a cancelled invoice can still be paid on chain and then becomes PAID.",
    });
  } else if (status === "EXPIRED") {
    events.push({
      key: "expired",
      title: "Expired",
      when: dueAt ? fmtDate(dueAt) : undefined,
      state: "done",
      body: "Past the due date. The pay page refuses it; duplicate the invoice if the customer still wants to pay.",
    });
  } else {
    events.push({
      key: "waiting",
      title: "Awaiting payment",
      state: "live",
      body: `This page checks every 5 seconds. It flips to PAID from the onchain event, seen on ${explorerName}, not from a click.`,
    });
  }

  return (
    <ol className="relative space-y-0">
      {events.map((e, i) => {
        const last = i === events.length - 1;
        return (
          <li key={e.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-0.75rem)] w-px bg-line" />}
            <span
              aria-hidden="true"
              className={`relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                e.state === "done"
                  ? "bg-ink text-bg"
                  : e.state === "live"
                    ? "border border-ink bg-bg"
                    : "border border-line bg-bg"
              }`}
            >
              {e.state === "done" ? (
                <CheckIcon className="h-3.5 w-3.5" />
              ) : e.state === "live" ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" />
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[15px] font-medium text-ink">{e.title}</span>
                {e.when && <span className="font-mono text-[11px] tabular-nums text-ink-faint">{e.when}</span>}
              </div>
              {e.body && <div className="mt-1 text-[13px] leading-relaxed text-ink-soft">{e.body}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
