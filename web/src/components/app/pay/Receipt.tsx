import StatusBadge from "@/components/StatusBadge";
import { CheckIcon } from "@/components/Icons";
import { formatUsdc, shortAddr } from "@/lib/usdc";
import HashLink from "./HashLink";
import { DetailList, DetailRow } from "./DetailRow";

/**
 * The paid state of the pay page. It is the receipt the buyer keeps: what was paid, to whom,
 * and the transaction that proves it. Everything shown here comes from the chain or from the
 * verified Payment row, never from the click that started the flow.
 */
export default function Receipt({
  amount,
  chainId,
  merchantName,
  txHash,
  blockNumber,
  paidAt,
  payer,
}: {
  amount: string;
  chainId: number;
  merchantName: string;
  txHash?: string;
  blockNumber?: string;
  paidAt?: string;
  payer?: string;
}) {
  const when = paidAt ? new Date(paidAt) : null;
  const whenValid = when !== null && !Number.isNaN(when.getTime());
  return (
    <section aria-label="Receipt" className="surface-inset space-y-4 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-bg">
            <CheckIcon className="h-4 w-4" />
          </span>
          <div>
            <div className="font-semibold leading-tight">Payment confirmed</div>
            <div className="text-[12.5px] text-ink-soft">Verified from the chain, not from this page.</div>
          </div>
        </div>
        <StatusBadge status="PAID" />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="tnum text-2xl font-semibold tracking-tight">{formatUsdc(amount)}</span>
        <span className="text-sm text-ink-soft">USDC</span>
        <span className="text-sm text-ink-soft">to {merchantName}</span>
      </div>

      {(blockNumber || whenValid || payer) && (
        <DetailList className="border-t border-line/70">
          {whenValid && (
            <DetailRow label="Paid" mono={false}>
              {when!.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </DetailRow>
          )}
          {blockNumber && <DetailRow label="Block">{blockNumber}</DetailRow>}
          {payer && <DetailRow label="From">{shortAddr(payer)}</DetailRow>}
        </DetailList>
      )}

      {txHash && (
        <div className="border-t border-line/70 pt-4">
          <HashLink chainId={chainId} hash={txHash} />
        </div>
      )}
    </section>
  );
}
