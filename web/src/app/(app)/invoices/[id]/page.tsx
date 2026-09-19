"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import QrCode from "@/components/QrCode";
import ShareLinkButton from "@/components/ShareLinkButton";
import CopyText from "@/components/CopyText";
import Link from "next/link";
import { formatUsdc } from "@/lib/usdc";
import { chainName, txUrl } from "@/lib/chains";

type Invoice = {
  id: string; onchainId: string; chainId: number; description: string; customerName?: string; amount: string;
  status: string; createdAt: string; dueAt?: string | null;
  merchant: { name: string; walletAddress: string };
  payment?: { txHash: string; payer: string; amount: string; paidAt: string; blockNumber: string } | null;
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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

  if (!inv) return <p>Loading…</p>;

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${inv.id}`;

  async function cancel() {
    if (!confirm("Cancel this invoice?")) return;
    await fetch(`/api/invoices/${inv!.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button className="text-sm text-ink-soft hover:underline" onClick={() => router.push("/app")}>← Dashboard</button>

      <div className="card space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{inv.description}</h1>
            <p className="text-sm text-ink-soft">{inv.customerName || "No customer name"}</p>
          </div>
          <StatusBadge status={inv.status} />
        </div>

        <div className="text-3xl font-bold">{formatUsdc(inv.amount)} <span className="text-base font-normal text-ink-soft">USDC</span></div>

        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-ink-soft">Merchant</dt><dd className="col-span-2">{inv.merchant.name}</dd>
          <dt className="text-ink-soft">Network</dt><dd className="col-span-2">{chainName(inv.chainId)}</dd>
          <dt className="text-ink-soft">Merchant wallet</dt><dd className="col-span-2"><CopyText value={inv.merchant.walletAddress} className="font-mono break-all" /></dd>
          <dt className="text-ink-soft">Payment key (onchain)</dt><dd className="col-span-2"><CopyText value={inv.onchainId} className="font-mono break-all text-xs" /></dd>
          <dt className="text-ink-soft">Created</dt><dd className="col-span-2">{new Date(inv.createdAt).toLocaleString("en-GB")}</dd>
          {inv.dueAt && (<><dt className="text-ink-soft">Due</dt><dd className="col-span-2">{new Date(inv.dueAt).toLocaleDateString("en-GB")}</dd></>)}
        </dl>

        {inv.status === "PENDING" && (
          <div className="space-y-3 rounded-lg bg-field p-4">
            <div className="text-sm font-medium">Payment link</div>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {/* For the customer standing in front of you; the link below is for sending. */}
              <QrCode value={link} size={160} className="shrink-0" />
              <div className="w-full min-w-0 space-y-2">
                <input readOnly className="input w-full font-mono text-xs" value={link} onFocus={(e) => e.currentTarget.select()} />
                <div className="flex gap-2">
                  <ShareLinkButton
                    url={link}
                    title={`Invoice from ${inv.merchant.name}`}
                    text={`${inv.description}: ${formatUsdc(inv.amount)} USDC`}
                    className="btn-secondary flex-1"
                  />
                  <a className="btn-primary flex-1 text-center" href={link} target="_blank">Open</a>
                </div>
                <p className="text-xs text-ink-faint">Scan the code or send the link. It is marked paid on its own once the payment lands.</p>
              </div>
            </div>
            <button className="text-xs text-rose-600 hover:underline" onClick={cancel}>Cancel invoice</button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {inv.status === "PENDING" && (
            <ShareLinkButton
              url={link}
              title={`Reminder: invoice from ${inv.merchant.name}`}
              text={`Friendly reminder, this invoice is still open: ${inv.description}, ${formatUsdc(inv.amount)} USDC${inv.dueAt ? `, due ${new Date(inv.dueAt).toLocaleDateString("en-GB")}` : ""}.`}
              className="btn-secondary"
              label="Send reminder"
            />
          )}
          <Link className="btn-secondary" href={`/invoices/new?from=${inv.id}`}>Duplicate</Link>
        </div>

        {inv.payment && (
          <div className="space-y-1 rounded-lg bg-field p-4 text-sm">
            <div className="font-medium text-ink">✓ Paid {new Date(inv.payment.paidAt).toLocaleString("en-GB")}</div>
            <div>Payer: <span className="font-mono">{inv.payment.payer}</span></div>
            <div>Amount: {formatUsdc(inv.payment.amount)} USDC · Block #{inv.payment.blockNumber}</div>
            <div className="break-all">
              Tx:{" "}
              {txUrl(inv.chainId, inv.payment.txHash) ? (
                <a className="text-ink underline decoration-green underline-offset-4 hover:underline font-mono" href={txUrl(inv.chainId, inv.payment.txHash)} target="_blank">{inv.payment.txHash}</a>
              ) : (
                <span className="font-mono">{inv.payment.txHash}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
