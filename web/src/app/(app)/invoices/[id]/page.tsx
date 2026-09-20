"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import ShareLinkButton from "@/components/ShareLinkButton";
import CopyText from "@/components/CopyText";
import { CheckIcon } from "@/components/Icons";
import { formatUsdc, shortAddr } from "@/lib/usdc";
import { addressUrl, chainName, getChain, txUrl } from "@/lib/chains";
import { LINKS } from "@/lib/links";
import PaymentLinkCard from "@/components/app/invoices/PaymentLinkCard";
import InvoiceTimeline from "@/components/app/invoices/InvoiceTimeline";
import { DetailList, DetailRow } from "@/components/app/invoices/DetailRow";
import { fmtBlock, fmtDate, fmtDateTime, invNo } from "@/components/app/invoices/format";
import { explorerName as explorerLabel } from "@/components/app/format";

type Invoice = {
  id: string; onchainId: string; chainId: number; description: string; customerName?: string; amount: string;
  status: string; createdAt: string; dueAt?: string | null;
  merchant: { name: string; walletAddress: string };
  payment?: { txHash: string; payer: string; amount: string; paidAt: string; blockNumber: string } | null;
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/invoices/${id}`);
    if (r.ok) setInv(await r.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);
  // Poll while PENDING (the indexer may mark PAID in the background)
  useEffect(() => {
    if (inv?.status !== "PENDING") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [inv?.status, load]);

  if (!inv) return <DetailSkeleton />;

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${inv.id}`;

  async function cancel() {
    if (!confirm("Cancel this invoice?")) return;
    await fetch(`/api/invoices/${inv!.id}`, { method: "DELETE" });
    load();
  }

  const chain = getChain(inv.chainId);
  const explorer = chain?.explorerUrl ?? "";
  const explorerName = explorerLabel(explorer);
  const tx = inv.payment ? txUrl(inv.chainId, inv.payment.txHash) : "";
  const amountLabel = formatUsdc(inv.amount);
  const pending = inv.status === "PENDING";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link href={LINKS.app} className="inline-flex items-center gap-1.5 hover:text-ink">
          <span aria-hidden="true">←</span> Dashboard
        </Link>
      </nav>

      {/* Header: id, status, amount */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] tracking-[0.02em] text-ink-soft">{invNo(inv.id)}</span>
            <StatusBadge status={inv.status} />
          </div>
          <h1 className="mt-2 break-words text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">{inv.description}</h1>
          <p className="mt-1 text-[15px] text-ink-soft">
            {inv.customerName ? <>Billed to {inv.customerName}</> : <span className="text-ink-faint">No customer name</span>}
            {" · "}{inv.merchant.name}
          </p>
        </div>
        <div className="min-w-0 sm:shrink-0 sm:text-right">
          <p className="text-[13px] text-ink-soft">{inv.status === "PAID" ? "Received" : "Amount"}</p>
          <p className="tnum mt-1 text-[40px] leading-[0.95] tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[48px]">
            {amountLabel} <small className="text-[0.4em] text-ink-soft">USDC</small>
          </p>
        </div>
      </header>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {pending && (
          <ShareLinkButton
            url={link}
            title={`Reminder: invoice from ${inv.merchant.name}`}
            text={`Friendly reminder, this invoice is still open: ${inv.description}, ${amountLabel} USDC${inv.dueAt ? `, due ${new Date(inv.dueAt).toLocaleDateString("en-GB")}` : ""}.`}
            className="btn-secondary"
            label="Send reminder"
          />
        )}
        <Link className="btn-secondary" href={`/invoices/new?from=${inv.id}`}>Duplicate</Link>
        {tx && (
          <a className="btn-secondary" href={tx} target="_blank" rel="noreferrer">Open in {explorerName}</a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: the link while open, the receipt once paid, then the timeline */}
        <div className="min-w-0 space-y-6">
          {pending && (
            <PaymentLinkCard
              url={link}
              merchantName={inv.merchant.name}
              description={inv.description}
              amountLabel={`${amountLabel} USDC`}
              footer="Scan the code or send the link. It is marked PAID on its own once the payment lands."
            />
          )}

          {inv.payment && (
            <section className="card" aria-labelledby="receipt-heading">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-bg" aria-hidden="true">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="receipt-heading" className="text-[15px] font-medium">Paid {fmtDateTime(inv.payment.paidAt)}</h2>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {formatUsdc(inv.payment.amount)} USDC from <span className="font-mono text-ink">{shortAddr(inv.payment.payer)}</span>
                    {inv.payment.blockNumber ? <> · block <span className="tnum font-mono text-ink">{fmtBlock(inv.payment.blockNumber)}</span></> : null}
                  </p>
                  <p className="mt-3 break-all font-mono text-xs text-ink-soft">
                    {tx ? (
                      <a className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink" href={tx} target="_blank" rel="noreferrer">
                        {inv.payment.txHash}
                      </a>
                    ) : (
                      inv.payment.txHash
                    )}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="card" aria-labelledby="timeline-heading">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="timeline-heading" className="text-[15px] font-medium text-ink-soft">Timeline</h2>
              {pending && <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">live · 5s</span>}
            </div>
            <InvoiceTimeline
              status={inv.status}
              createdAt={inv.createdAt}
              dueAt={inv.dueAt}
              chainId={inv.chainId}
              payment={inv.payment}
              explorerName={explorerName}
            />
          </section>

          {pending && (
            <section className="surface-inset rounded-[24px] p-5" aria-labelledby="cancel-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 id="cancel-heading" className="text-[15px] font-medium">Cancel invoice</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                    Cancel only changes the database. A cancelled invoice can still be paid on chain and then becomes PAID.
                  </p>
                </div>
                <button type="button" className="btn-secondary shrink-0 text-rose-600 hover:text-rose-700" onClick={cancel}>
                  Cancel invoice
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Right: the record */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <section className="card" aria-labelledby="details-heading">
            <h2 id="details-heading" className="text-[15px] font-medium text-ink-soft">Details</h2>
            <DetailList className="mt-2">
              <DetailRow label="Merchant">{inv.merchant.name}</DetailRow>
              <DetailRow label="Wallet" mono>
                <CopyText value={inv.merchant.walletAddress} className="break-all" />
              </DetailRow>
              <DetailRow label="Network">
                {chainName(inv.chainId)}
                {chain?.testnet ? <span className="ml-2 badge bg-field text-ink-soft ring-1 ring-line">test</span> : null}
              </DetailRow>
              {chain?.paymentProcessor && (
                <DetailRow label="Contract" mono>
                  {addressUrl(inv.chainId, chain.paymentProcessor) ? (
                    <a className="underline decoration-line underline-offset-4 hover:decoration-ink" href={addressUrl(inv.chainId, chain.paymentProcessor)} target="_blank" rel="noreferrer">
                      {chain.paymentProcessor}
                    </a>
                  ) : (
                    chain.paymentProcessor
                  )}
                </DetailRow>
              )}
              <DetailRow label="Onchain id" mono>
                <CopyText value={inv.onchainId} className="break-all text-xs" />
              </DetailRow>
              <DetailRow label="Created">{fmtDateTime(inv.createdAt)}</DetailRow>
              {inv.dueAt && <DetailRow label="Due">{fmtDate(inv.dueAt)}</DetailRow>}
              {inv.payment && (
                <>
                  <DetailRow label="Paid">{fmtDateTime(inv.payment.paidAt)}</DetailRow>
                  <DetailRow label="Payer" mono>
                    <CopyText value={inv.payment.payer} className="break-all" />
                  </DetailRow>
                  {inv.payment.blockNumber && (
                    <DetailRow label="Block"><span className="tnum font-mono text-[13px]">{fmtBlock(inv.payment.blockNumber)}</span></DetailRow>
                  )}
                  <DetailRow label="Tx hash" mono>
                    {tx ? (
                      <a className="underline decoration-line underline-offset-4 hover:decoration-ink" href={tx} target="_blank" rel="noreferrer">
                        {inv.payment.txHash}
                      </a>
                    ) : (
                      inv.payment.txHash
                    )}
                  </DetailRow>
                </>
              )}
              <DetailRow label="Invoice id" mono>
                <CopyText value={inv.id} className="break-all text-xs" />
              </DetailRow>
            </DetailList>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Same shape as the loaded page so nothing jumps when the record arrives. */
function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6" aria-busy="true" aria-label="Loading invoice">
      <div className="h-4 w-24 animate-pulse rounded bg-field" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="h-4 w-28 animate-pulse rounded bg-field" />
          <div className="h-7 w-64 max-w-full animate-pulse rounded bg-field" />
          <div className="h-4 w-40 animate-pulse rounded bg-field" />
        </div>
        <div className="h-12 w-44 animate-pulse rounded bg-field" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="h-64 animate-pulse rounded-[24px] bg-field" />
          <div className="h-48 animate-pulse rounded-[24px] bg-field" />
        </div>
        <div className="h-80 animate-pulse rounded-[24px] bg-field" />
      </div>
    </div>
  );
}
