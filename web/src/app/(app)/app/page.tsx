"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import NotifyButton from "@/components/NotifyButton";
import { PlusIcon } from "@/components/Icons";
import { formatUsdc, shortAddr } from "@/lib/usdc";
import { DEFAULT_CHAIN } from "@/lib/chains";
import { LINKS } from "@/lib/links";
import StatTile from "@/components/app/dashboard/StatTile";
import CopyAddress from "@/components/app/dashboard/CopyAddress";
import ChainPill from "@/components/app/dashboard/ChainPill";
import StatusFilter, { type StatusFilterValue } from "@/components/app/dashboard/StatusFilter";
import InvoiceList, { EmptyState, FilteredEmpty, InvoiceSkeleton } from "@/components/app/dashboard/InvoiceList";
import RegisterMerchantCard from "@/components/app/dashboard/RegisterMerchantCard";
import ActivityPanel from "@/components/app/dashboard/ActivityPanel";
import type { Invoice, Merchant, Stats } from "@/components/app/dashboard/types";

const EMPTY_STATS: Stats = { total: 0, paid: 0, pending: 0, totalReceived: "0", totalOutstanding: "0" };

export default function Dashboard() {
  const { address } = useAccount();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantId, setMerchantId] = useState<string>("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  // Client-side status filter over the loaded list; the fetch itself is unchanged.
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("");

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
  const selectedMerchant = merchants.find((m) => m.id === merchantId);
  const exportHref = `/api/invoices/export${merchantId ? `?merchantId=${merchantId}` : ""}`;

  const activity = invoices
    .filter((i) => i.payment)
    .sort((a, b) => new Date(b.payment!.paidAt).getTime() - new Date(a.payment!.paidAt).getTime())
    .slice(0, 5);
  const latestPaidId = activity[0]?.id;

  const statusCounts = invoices.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});
  const visible = statusFilter ? invoices.filter((i) => i.status === statusFilter) : invoices;

  const title = selectedMerchant?.name ?? (address && !myMerchant ? "Welcome" : "Dashboard");

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page header: who, which wallet, which chain, and the two actions. */}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-faint">Merchant dashboard</p>
          <h1 className="mt-1.5 truncate text-[30px] leading-[1.05] tracking-[-0.03em] sm:text-[38px]">{title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {address ? (
              <CopyAddress address={address} />
            ) : (
              <span className="text-[13.5px] text-ink-soft">Connect a wallet to register as a merchant and create invoices.</span>
            )}
            <ChainPill name={DEFAULT_CHAIN.name} testnet={DEFAULT_CHAIN.testnet} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {myMerchant && <NotifyButton merchantId={myMerchant.id} className="w-full justify-center sm:w-auto" />}
          <a className="btn-secondary flex-1 text-center sm:flex-none" href={exportHref}>
            Export CSV
          </a>
          <Link className="btn-primary flex flex-1 items-center justify-center gap-1.5 sm:flex-none" href={LINKS.newInvoice}>
            <PlusIcon className="h-4 w-4" /> New invoice
          </Link>
        </div>
      </div>

      {address && !myMerchant && (
        <RegisterMerchantCard address={address} name={name} onNameChange={setName} onSubmit={registerMerchant} />
      )}

      {/* Stat tiles: 2 across on phones, 4 across from sm. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile
          tag="received"
          figure={formatUsdc(stats.totalReceived)}
          unit="USDG"
          note={`${stats.paid} ${stats.paid === 1 ? "payment" : "payments"} verified`}
          loading={!loaded}
        />
        <StatTile
          tag="outstanding"
          figure={formatUsdc(stats.totalOutstanding)}
          unit="USDG"
          note={`${stats.pending} awaiting payment`}
          loading={!loaded}
        />
        <StatTile tag="paid" figure={String(stats.paid)} note="marked from the onchain event" loading={!loaded} />
        <StatTile
          tag="invoices"
          figure={String(stats.total)}
          note={`${stats.paid} paid · ${stats.pending} pending`}
          loading={!loaded}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Invoice list */}
        <section className="surface overflow-hidden rounded-[24px] border border-line" aria-label="Invoices">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-medium text-ink-soft">Invoices</h2>
              {merchants.length > 0 && (
                <label className="flex items-center gap-2">
                  <span className="sr-only">Merchant</span>
                  <select className="input h-10 w-auto max-w-[220px] py-0 text-[13px]" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}>
                    <option value="">All merchants</option>
                    {merchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({shortAddr(m.walletAddress)})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {loaded && invoices.length > 0 && <StatusFilter value={statusFilter} counts={statusCounts} onChange={setStatusFilter} />}
          </div>

          {!loaded ? (
            <InvoiceSkeleton />
          ) : invoices.length === 0 ? (
            <EmptyState />
          ) : visible.length === 0 ? (
            <FilteredEmpty label={statusFilter} onClear={() => setStatusFilter("")} />
          ) : (
            <InvoiceList invoices={visible} latestPaidId={latestPaidId} />
          )}
        </section>

        {/* Activity: latest verified payments */}
        <ActivityPanel activity={activity} loaded={loaded} />
      </div>
    </div>
  );
}
