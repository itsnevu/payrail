"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import StatusBadge from "@/components/StatusBadge";
import { Chip } from "@/components/Logo";
import NotifyButton from "@/components/NotifyButton";
import { ChevronIcon, PlusIcon } from "@/components/Icons";
import { formatUsdc, shortAddr } from "@/lib/usdc";
import { LINKS } from "@/lib/links";

type Merchant = { id: string; name: string; walletAddress: string };
type Invoice = {
  id: string; description: string; customerName?: string; amount: string;
  status: string; createdAt: string; merchant: Merchant;
  payment?: { txHash: string; paidAt: string; blockNumber?: string } | null;
};
type Stats = { total: number; paid: number; pending: number; totalReceived: string; totalOutstanding: string };

const EMPTY_STATS: Stats = { total: 0, paid: 0, pending: 0, totalReceived: "0", totalOutstanding: "0" };

/** Same tile colours as the phone mockup on the landing page. */
const STATUS_COLORS: Record<string, string> = {
  PAID: "#e6e6e6",
  PENDING: "#6e6e6e",
  EXPIRED: "#2c2c2c",
  CANCELLED: "#2c2c2c",
};

/** Short human label: the last 4 chars of the cuid, upper-cased ("INV-K3P9"). */
function invNo(id: string) {
  return `INV-${id.slice(-4).toUpperCase()}`;
}

function relDay(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function Dashboard() {
  const { address } = useAccount();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantId, setMerchantId] = useState<string>("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const q = merchantId ? `?merchantId=${merchantId}` : "";
    const [inv, st] = await Promise.all([
      fetch(`/api/invoices${q}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`/api/stats${q}`).then((r) => (r.ok ? r.json() : EMPTY_STATS)).catch(() => EMPTY_STATS),
    ]);
    setInvoices(Array.isArray(inv) ? inv : []);
    setStats(st && typeof st.total === "number" ? st : EMPTY_STATS);
    setLoaded(true);
  }, [merchantId]);

  useEffect(() => {
    fetch("/api/merchants").then((r) => (r.ok ? r.json() : [])).then((m) => setMerchants(Array.isArray(m) ? m : [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  // Keep the list fresh while something is still awaiting payment.
  useEffect(() => {
    if (!invoices.some((i) => i.status === "PENDING")) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [invoices, load]);

  // Auto-select the merchant whose wallet is connected
  useEffect(() => {
    if (!address) return;
    const m = merchants.find((m) => m.walletAddress.toLowerCase() === address.toLowerCase());
    if (m) setMerchantId(m.id);
  }, [address, merchants]);

  async function registerMerchant(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return alert("Connect a wallet first");
    const r = await fetch("/api/merchants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, walletAddress: address }),
    });
    const m = await r.json();
    setMerchants((prev) => [m, ...prev.filter((x) => x.id !== m.id)]);
    setMerchantId(m.id);
    setName("");
  }

  const myMerchant = merchants.find((m) => m.walletAddress.toLowerCase() === address?.toLowerCase());
  const exportHref = `/api/invoices/export${merchantId ? `?merchantId=${merchantId}` : ""}`;

  const activity = invoices
    .filter((i) => i.payment)
    .sort((a, b) => new Date(b.payment!.paidAt).getTime() - new Date(a.payment!.paidAt).getTime())
    .slice(0, 5);
  const latestPaidId = activity[0]?.id;

  return (
    <div className="space-y-8">
      {/* Header: the big number, like the phone mockup */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[15px] font-medium text-ink-soft">Received</p>
          <p className="mt-2 text-[44px] leading-[0.95] tabular-nums sm:text-[56px]">
            {formatUsdc(stats.totalReceived)} <small className="text-[0.45em] text-ink-soft">USDC</small>
          </p>
          <p className="mt-3 text-[15px] text-ink-soft">
            {stats.total} {stats.total === 1 ? "invoice" : "invoices"} · {stats.pending} awaiting payment
            {stats.pending > 0 && <> · {formatUsdc(stats.totalOutstanding)} USDC outstanding</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {myMerchant && <NotifyButton merchantId={myMerchant.id} className="w-full justify-center sm:w-auto" />}
          <a className="btn-secondary flex-1 text-center sm:flex-none" href={exportHref}>Export CSV</a>
          <Link className="btn-primary flex flex-1 items-center justify-center gap-1.5 sm:flex-none" href={LINKS.newInvoice}>
            <PlusIcon className="h-4 w-4" /> New invoice
          </Link>
        </div>
      </div>

      {address && !myMerchant && (
        <form onSubmit={registerMerchant} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label">Register this wallet as a merchant</label>
            <input className="input" placeholder="Business or freelancer name" value={name}
              onChange={(e) => setName(e.target.value)} required />
          </div>
          <button className="btn-primary">Register</button>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Invoice list */}
        <section className="surface overflow-hidden rounded-[24px] border border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-medium text-ink-soft">Invoices</h2>
            {merchants.length > 0 && (
              <select className="input w-auto py-1.5 text-xs" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}>
                <option value="">All merchants</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({shortAddr(m.walletAddress)})</option>
                ))}
              </select>
            )}
          </div>

          {!loaded ? (
            <ul>
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                  <div className="h-11 w-11 animate-pulse rounded-2xl bg-field" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-field" />
                    <div className="h-3 w-1/4 animate-pulse rounded bg-field" />
                  </div>
                </li>
              ))}
            </ul>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
              <div className="flex items-center gap-2">
                <Chip size={28} color="#0a0a0a" />
                <Chip size={28} color="#ffffff" stroke="#0a0a0a" />
                <Chip size={28} color="#404040" />
              </div>
              <div>
                <p className="font-medium">No invoices yet</p>
                <p className="mt-1 max-w-xs text-sm text-ink-soft">
                  Create one, send the link, and it shows up here as PAID the moment the payment lands.
                </p>
              </div>
              <Link className="btn-primary" href={LINKS.newInvoice}>Create your first invoice</Link>
            </div>
          ) : (
            <ul>
              {invoices.map((i) => {
                const hi = i.id === latestPaidId;
                return (
                  <li key={i.id} className={`border-b border-line last:border-0 ${hi ? "bg-field" : ""}`}>
                    <Link href={`/invoices/${i.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-field">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-field">
                        <Chip size={24} color={STATUS_COLORS[i.status] ?? "#2c2c2c"} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px]">{i.customerName || i.description}</span>
                        <span className="block truncate text-[14px] text-ink-soft">
                          {invNo(i.id)} · {i.customerName ? i.description : i.merchant.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="flex items-baseline justify-end gap-1.5 text-[22px] leading-none tabular-nums">
                          {formatUsdc(i.amount)} <small className="text-[13px] text-ink-soft">USDC</small>
                        </span>
                        <span className="mt-1 flex items-center justify-end gap-2 text-[13px] text-ink-soft">
                          <StatusBadge status={i.status} />
                          <span className="hidden sm:inline">{relDay(i.payment?.paidAt ?? i.createdAt)}</span>
                        </span>
                      </span>
                      <ChevronIcon className="h-4 w-4 shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Activity: latest verified payments */}
        <aside className="surface h-fit overflow-hidden rounded-[24px] border border-line">
          <div className="border-b border-line px-5 py-3.5 text-[15px] font-medium text-ink-soft">Activity</div>
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-soft">
              {loaded ? "Verified payments show up here." : "…"}
            </p>
          ) : (
            <ul>
              {activity.map((i) => (
                <li key={i.id} className="border-b border-line last:border-0">
                  <Link href={`/invoices/${i.id}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-field">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink">
                      <Chip size={20} color="#ffffff" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{invNo(i.id)} verified</span>
                      <span className="block truncate text-[13px] text-ink-soft">
                        PaymentReceived{i.payment?.blockNumber ? ` · block ${Number(i.payment.blockNumber).toLocaleString("en-US")}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[15px] tabular-nums">+{formatUsdc(i.amount)}</span>
                      <span className="block text-[13px] text-ink-soft">{relDay(i.payment!.paidAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
