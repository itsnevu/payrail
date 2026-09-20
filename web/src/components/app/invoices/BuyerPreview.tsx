import StatusBadge from "@/components/StatusBadge";
import { shortAddr } from "@/lib/usdc";

/**
 * A faithful, non-interactive copy of the top of /pay/[id]: what the customer sees when
 * they open the link. Drives the live preview on the new-invoice page and the "created"
 * state right after. Nothing in here fetches; it renders whatever the form holds.
 */
export default function BuyerPreview({
  merchantName,
  walletAddress,
  description,
  customerName,
  amountLabel,
  amountOk = true,
  chainName,
  contract,
  dueAt,
  status = "PENDING",
  caption,
}: {
  merchantName?: string;
  walletAddress?: string;
  description: string;
  customerName?: string;
  /** "250.00" without the ticker. */
  amountLabel: string;
  amountOk?: boolean;
  chainName: string;
  contract?: string;
  /** ISO or yyyy-mm-dd; rendered as "17 Sep". */
  dueAt?: string;
  status?: string;
  /** Mono line at the top right, for example the path of the link. */
  caption?: string;
}) {
  const due = dueAt ? new Date(dueAt) : null;
  const dueOk = due !== null && !Number.isNaN(due.getTime());
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">Buyer sees</p>
        {caption && <p className="truncate font-mono text-[11px] text-ink-faint">{caption}</p>}
      </div>
      <div className="card space-y-5" aria-label="Preview of the pay page">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-ink-soft">Payment to</div>
            <div className="truncate font-semibold">
              {merchantName || <span className="font-normal text-ink-faint">Your business</span>}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        <div>
          <div className="min-h-[1.25rem] break-words text-sm text-ink-soft">
            {description || <span className="text-ink-faint">What is this for?</span>}
          </div>
          <div className={`tnum mt-1 text-4xl font-bold tracking-[-0.02em] [overflow-wrap:anywhere] ${amountOk ? "" : "text-ink-faint"}`}>
            {amountLabel} <span className="text-lg font-normal tracking-normal text-ink-soft">USDG</span>
          </div>
        </div>

        <dl className="space-y-1.5 text-xs text-ink-soft">
          {customerName && (
            <div className="flex justify-between gap-4">
              <dt>Billed to</dt>
              <dd className="truncate text-right">{customerName}</dd>
            </div>
          )}
          {dueOk && (
            <div className="flex justify-between gap-4">
              <dt>Due</dt>
              <dd>{due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt>Network</dt>
            <dd className="text-right">{chainName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>To wallet</dt>
            <dd className="font-mono">{walletAddress ? shortAddr(walletAddress) : <span className="text-ink-faint">-</span>}</dd>
          </div>
          {contract && (
            <div className="flex justify-between gap-4">
              <dt>Contract</dt>
              <dd className="font-mono">{shortAddr(contract)}</dd>
            </div>
          )}
        </dl>

        <div className="btn-primary w-full py-3 text-center opacity-60" aria-hidden="true">
          Pay {amountLabel} USDG
        </div>
        <p className="text-center text-[11px] text-ink-faint">
          Powered by Payrail · Funds go straight to the merchant and are never held.
        </p>
      </div>
    </div>
  );
}
