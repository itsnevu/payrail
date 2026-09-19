"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUsdc, shortAddr } from "@/lib/usdc";
import { CHAINS, DEFAULT_CHAIN_ID, getChain } from "@/lib/chains";
import { LINKS } from "@/lib/links";

type Merchant = { id: string; name: string; walletAddress: string };
type Form = { merchantId: string; chainId: number; description: string; customerName: string; amount: string; dueAt: string };
type FieldErrors = Partial<Record<keyof Form, string>>;

const QUICK_AMOUNTS = ["50", "100", "250", "500", "1000"];

export default function NewInvoicePage() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={null}>
      <NewInvoice />
    </Suspense>
  );
}

function NewInvoice() {
  const router = useRouter();
  const search = useSearchParams();
  const duplicateFrom = search.get("from");
  const { address, chainId: walletChainId } = useAccount();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [form, setForm] = useState<Form>({ merchantId: "", chainId: DEFAULT_CHAIN_ID, description: "", customerName: "", amount: "", dueAt: "" });
  const [chainTouched, setChainTouched] = useState(false);

  // Follow the connected wallet's network until the merchant picks one explicitly.
  useEffect(() => {
    if (chainTouched || !walletChainId || !getChain(walletChainId)) return;
    setForm((f) => (f.chainId === walletChainId ? f : { ...f, chainId: walletChainId }));
  }, [walletChainId, chainTouched]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/merchants").then((r) => r.json()).then((ms: Merchant[]) => {
      setMerchants(ms);
      const mine = ms.find((m) => m.walletAddress.toLowerCase() === address?.toLowerCase());
      // Connected wallet's merchant first; a lone merchant second.
      const pick = mine ?? (ms.length === 1 ? ms[0] : undefined);
      if (pick) setForm((f) => (f.merchantId ? f : { ...f, merchantId: pick.id }));
    });
  }, [address]);

  // "Duplicate": prefill from an existing invoice (monthly retainers, repeat customers).
  useEffect(() => {
    if (!duplicateFrom) return;
    fetch(`/api/invoices/${duplicateFrom}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((inv) => {
        if (!inv) return;
        setForm((f) => ({
          ...f,
          merchantId: inv.merchant?.id ?? f.merchantId,
          chainId: getChain(inv.chainId) ? inv.chainId : f.chainId,
          description: inv.description ?? "",
          customerName: inv.customerName ?? "",
          amount: formatUsdc(inv.amount).replace(/,/g, ""),
        }));
      })
      .catch(() => {});
  }, [duplicateFrom]);

  const merchant = merchants.find((m) => m.id === form.merchantId);
  const chain = getChain(form.chainId) ?? CHAINS[0];
  const amountOk = /^\d+(\.\d{1,6})?$/.test(form.amount) && Number(form.amount) > 0;
  const previewAmount = amountOk
    ? Number(form.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    : "0.00";

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setErrors({});
    const r = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantId: form.merchantId,
        chainId: form.chainId,
        description: form.description.trim(),
        customerName: form.customerName.trim() || undefined,
        amount: form.amount,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      // zod's flatten(): { fieldErrors: { amount: ["..."] }, formErrors: [] }
      const fe = data?.error?.fieldErrors as Record<string, string[]> | undefined;
      if (fe) {
        const next: FieldErrors = {};
        for (const [k, v] of Object.entries(fe)) if (v?.length) next[k as keyof Form] = v[0];
        setErrors(next);
        return setError("Check the highlighted fields.");
      }
      return setError(typeof data?.error === "string" ? data.error : "Could not create the invoice.");
    }
    router.push(`/invoices/${data.id}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">New invoice</h1>
          <p className="text-ink-soft">{duplicateFrom ? "Copied from an existing invoice. Adjust and create." : "Takes about ten seconds."}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="card space-y-5">
          {/* Merchant: hidden when there is only one choice. */}
          {merchants.length > 1 ? (
            <div>
              <label className="label">Merchant</label>
              <select className="input" required value={form.merchantId} onChange={(e) => set("merchantId", e.target.value)}>
                <option value="">Select a merchant…</option>
                {merchants.map((m) => <option key={m.id} value={m.id}>{m.name} ({shortAddr(m.walletAddress)})</option>)}
              </select>
              <FieldError msg={errors.merchantId} />
            </div>
          ) : merchants.length === 0 ? (
            <div className="rounded-xl border border-line bg-field p-4 text-sm">
              <p className="font-medium">No merchant yet</p>
              <p className="mt-1 text-ink-soft">Connect a wallet and register it on the <Link className="text-ink underline underline-offset-4" href={LINKS.app}>Dashboard</Link> first.</p>
            </div>
          ) : (
            <input type="hidden" value={form.merchantId} />
          )}

          {/* Network: hidden when this deployment offers only one. */}
          {CHAINS.length > 1 ? (
            <div>
              <label className="label">Network</label>
              <div className="flex flex-wrap gap-1.5">
                {CHAINS.map((c) => (
                  <button key={c.id} type="button"
                    onClick={() => { setChainTouched(true); set("chainId", c.id); }}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      form.chainId === c.id ? "border-ink bg-ink text-bg" : "border-line text-ink-soft hover:border-ink hover:text-ink"
                    }`}>
                    {c.name}{c.testnet ? " · test" : ""}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-faint">The buyer pays USDC on this network. It cannot be changed after the link is created.</p>
              <FieldError msg={errors.chainId} />
            </div>
          ) : null}

          <div>
            <label className="label">Description</label>
            <input className="input" required maxLength={500} placeholder="Website redesign, milestone 1"
              value={form.description} onChange={(e) => set("description", e.target.value)} />
            <FieldError msg={errors.description} />
          </div>

          <div>
            <label className="label">Customer name <span className="font-normal text-ink-faint">(optional)</span></label>
            <input className="input" maxLength={200} placeholder="Acme Studio"
              value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
            <FieldError msg={errors.customerName} />
          </div>

          <div>
            <label className="label">Amount (USDC)</label>
            <div className="relative">
              <input className="input pr-16 font-mono text-base" required inputMode="decimal" placeholder="250.00"
                pattern="^\d+(\.\d{1,6})?$" value={form.amount}
                onChange={(e) => set("amount", e.target.value.replace(/,/g, ""))} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-soft">USDC</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button key={q} type="button"
                  onClick={() => set("amount", q)}
                  className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                    form.amount === q ? "border-ink bg-ink text-bg" : "border-line text-ink-soft hover:border-ink hover:text-ink"
                  }`}>
                  {Number(q).toLocaleString("en-US")}
                </button>
              ))}
            </div>
            <FieldError msg={errors.amount} />
          </div>

          <div>
            <label className="label">Due date <span className="font-normal text-ink-faint">(optional)</span></label>
            <input className="input" type="date" min={today} value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
            <p className="mt-1 text-xs text-ink-faint">Past the due date the link stops accepting payment and the invoice is marked expired.</p>
            <FieldError msg={errors.dueAt} />
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button className="btn-primary w-full py-3" disabled={busy || !form.merchantId}>
            {busy ? "Creating…" : "Create invoice & payment link"}
          </button>
        </form>

        {/* Live preview: what the buyer sees at /pay/:id */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Buyer sees</p>
          <div className="card space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-soft">Payment to</div>
                <div className="font-semibold">{merchant?.name || <span className="text-ink-faint">Your business</span>}</div>
              </div>
              <span className="badge bg-field text-ink-soft ring-1 ring-line">PENDING</span>
            </div>
            <div>
              <div className="min-h-[1.25rem] text-sm text-ink-soft">
                {form.description || <span className="text-ink-faint">What is this for?</span>}
              </div>
              <div className={`mt-1 text-4xl font-bold tabular-nums ${amountOk ? "" : "text-ink-faint"}`}>
                {previewAmount} <span className="text-lg font-normal text-ink-soft">USDC</span>
              </div>
            </div>
            <dl className="space-y-1 text-xs text-ink-soft">
              {form.customerName && <div className="flex justify-between"><dt>Billed to</dt><dd>{form.customerName}</dd></div>}
              {form.dueAt && <div className="flex justify-between"><dt>Due</dt><dd>{new Date(form.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</dd></div>}
              <div className="flex justify-between"><dt>Network</dt><dd>{chain.name}</dd></div>
              <div className="flex justify-between"><dt>To wallet</dt><dd className="font-mono">{merchant ? shortAddr(merchant.walletAddress) : "-"}</dd></div>
            </dl>
            <div className="btn-primary w-full py-3 text-center opacity-60">Pay {previewAmount} USDC</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-rose-500">{msg}</p> : null;
}
