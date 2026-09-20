"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUsdc, shortAddr } from "@/lib/usdc";
import { CHAINS, DEFAULT_CHAIN_ID, getChain } from "@/lib/chains";
import { LINKS } from "@/lib/links";
import BuyerPreview from "@/components/app/invoices/BuyerPreview";
import PaymentLinkCard from "@/components/app/invoices/PaymentLinkCard";
import { fmtSixDecimals, invNo } from "@/components/app/invoices/format";

type Merchant = { id: string; name: string; walletAddress: string };
type Form = { merchantId: string; chainId: number; description: string; customerName: string; amount: string; dueAt: string };
type FieldErrors = Partial<Record<keyof Form, string>>;
/** What POST /api/invoices returns; only the fields the success state shows. */
type Created = {
  id: string;
  chainId: number;
  description: string;
  customerName?: string | null;
  amount: string;
  dueAt?: string | null;
  merchant: { name: string; walletAddress: string };
};

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
  // Set once the invoice exists; the page then shows the link instead of the form.
  const [created, setCreated] = useState<Created | null>(null);
  // window.location.origin, read after mount so server and client render the same markup.
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

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
  const sixDecimals = amountOk ? fmtSixDecimals(form.amount) : "0.000000";
  const onRobinhood = chain.key === "robinhoodMainnet" || chain.key === "robinhoodTestnet";

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
    setCreated(data as Created);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  /** Same merchant and network, empty details: the next invoice for the same business. */
  function createAnother() {
    setCreated(null);
    setError(""); setErrors({});
    setForm((f) => ({ ...f, description: "", customerName: "", amount: "", dueAt: "" }));
  }

  const today = new Date().toISOString().slice(0, 10);
  const noMerchant = merchants.length === 0;

  /* ---------------- created: show the link, not the form ---------------- */
  if (created) {
    const link = `${origin}/pay/${created.id}`;
    const amountLabel = formatUsdc(created.amount);
    const createdChain = getChain(created.chainId) ?? chain;
    return (
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">Invoice created</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em]">
              {invNo(created.id)} <span className="font-normal text-ink-soft">is ready to send</span>
            </h1>
            <p className="mt-1 text-ink-soft">
              {amountLabel} USDC · {created.merchant.name} · {createdChain.name}. It is marked PAID on its own once the payment lands.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={createAnother}>Create another</button>
            <Link className="btn-primary flex-1 text-center sm:flex-none" href={`/invoices/${created.id}`}>Open invoice</Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <PaymentLinkCard
              url={link}
              merchantName={created.merchant.name}
              description={created.description}
              amountLabel={`${amountLabel} USDC`}
              qrSize={220}
              footer="Scan the code or send the link. The buyer approves, then pays; the contract sends the funds to your wallet and Payrail records the event."
            />
          </div>
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <BuyerPreview
              merchantName={created.merchant.name}
              walletAddress={created.merchant.walletAddress}
              description={created.description}
              customerName={created.customerName ?? undefined}
              amountLabel={amountLabel}
              chainName={createdChain.name}
              contract={createdChain.paymentProcessor}
              dueAt={created.dueAt ?? undefined}
              caption={`/pay/${created.id.slice(-6)}`}
            />
          </aside>
        </div>
      </div>
    );
  }

  /* ---------------- the form ---------------- */
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">Invoices</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em]">New invoice</h1>
        <p className="mt-1 text-ink-soft">
          {duplicateFrom ? "Copied from an existing invoice. Adjust and create." : "Takes about ten seconds. You get a link and a QR code."}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="card min-w-0 space-y-6">
          {/* Merchant: hidden when there is only one choice. */}
          {merchants.length > 1 ? (
            <div>
              <label className="label" htmlFor="merchant">Merchant</label>
              <select id="merchant" className="input" required value={form.merchantId} onChange={(e) => set("merchantId", e.target.value)}>
                <option value="">Select a merchant…</option>
                {merchants.map((m) => <option key={m.id} value={m.id}>{m.name} ({shortAddr(m.walletAddress)})</option>)}
              </select>
              <Help>
                {address
                  ? "The wallet that receives the payment. The name is display only; the contract uses the address."
                  : "Connect your wallet and your own merchant is picked for you."}
              </Help>
              <FieldError msg={errors.merchantId} />
            </div>
          ) : noMerchant ? (
            <div className="surface-inset rounded-2xl p-4 text-sm">
              <p className="font-medium">No merchant yet</p>
              <p className="mt-1 text-ink-soft">
                Connect a wallet and register it on the{" "}
                <Link className="text-ink underline underline-offset-4" href={LINKS.app}>Dashboard</Link> first. The invoice is paid to that address.
              </p>
            </div>
          ) : (
            <div className="surface-inset flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-ink-faint">Merchant</div>
                <div className="truncate font-medium">{merchant?.name}</div>
              </div>
              <div className="shrink-0 font-mono text-xs text-ink-soft">{merchant ? shortAddr(merchant.walletAddress) : ""}</div>
              <input type="hidden" value={form.merchantId} />
            </div>
          )}

          {/* Network: hidden when this deployment offers only one. */}
          {CHAINS.length > 1 ? (
            <div>
              <span className="label" id="network-label">Network</span>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="network-label">
                {CHAINS.map((c) => (
                  <button key={c.id} type="button"
                    aria-pressed={form.chainId === c.id}
                    onClick={() => { setChainTouched(true); set("chainId", c.id); }}
                    className={`relative inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] transition-colors after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] ${
                      form.chainId === c.id ? "border-ink bg-ink text-bg" : "border-line text-ink-soft hover:border-ink hover:text-ink"
                    }`}>
                    {c.name}{c.testnet ? " · test" : ""}
                  </button>
                ))}
              </div>
              <Help>The buyer pays on this network. It cannot be changed after the link is created.</Help>
              <FieldError msg={errors.chainId} />
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="description">Description</label>
            <input id="description" className="input" required maxLength={500} placeholder="Website redesign, milestone 1"
              value={form.description} onChange={(e) => set("description", e.target.value)} />
            <Help>What the buyer is paying for. Shown on the pay page and in the CSV export.</Help>
            <FieldError msg={errors.description} />
          </div>

          <div>
            <label className="label" htmlFor="customer">Customer name <span className="font-normal text-ink-faint">(optional)</span></label>
            <input id="customer" className="input" maxLength={200} placeholder="Acme Studio"
              value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
            <Help>For your own records and the dashboard list. Not checked against the paying wallet.</Help>
            <FieldError msg={errors.customerName} />
          </div>

          <div>
            <label className="label" htmlFor="amount">Amount</label>
            <div className="relative">
              <input id="amount" className="input tnum pr-16 font-mono text-base" required inputMode="decimal" placeholder="250.00"
                pattern="^\d+(\.\d{1,6})?$" value={form.amount}
                aria-describedby="amount-preview"
                onChange={(e) => set("amount", e.target.value.replace(/,/g, ""))} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-sm text-ink-soft">USDC</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((q) => (
                <button key={q} type="button"
                  aria-pressed={form.amount === q}
                  onClick={() => set("amount", q)}
                  className={`tnum relative inline-flex min-h-9 items-center rounded-full border px-3.5 font-mono text-[13px] transition-colors after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] ${
                    form.amount === q ? "border-ink bg-ink text-bg" : "border-line text-ink-soft hover:border-ink hover:text-ink"
                  }`}>
                  {Number(q).toLocaleString("en-US")}
                </button>
              ))}
            </div>
            <div id="amount-preview" className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className={`font-mono text-sm tabular-nums ${amountOk ? "text-ink" : "text-ink-faint"}`}>
                {sixDecimals} <span className="text-ink-soft">USDC</span>
              </span>
              <span className="text-xs text-ink-faint">Up to 6 decimals. The buyer must pay this exact amount.</span>
            </div>
            {onRobinhood && (
              <Help>On {chain.name} the token moved is USDG (Global Dollar, 6 decimals); the app labels it USDC.</Help>
            )}
            <FieldError msg={errors.amount} />
          </div>

          <div>
            <label className="label" htmlFor="due">Due date <span className="font-normal text-ink-faint">(optional)</span></label>
            <input id="due" className="input" type="date" min={today} value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
            <Help>Past the due date the pay page stops accepting payment and the invoice is marked EXPIRED.</Help>
            <FieldError msg={errors.dueAt} />
          </div>

          <div className="space-y-3 border-t border-line pt-5">
            {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
            <button className="btn-primary w-full py-3 text-base" disabled={busy || !form.merchantId}>
              {busy ? "Creating…" : "Create invoice & payment link"}
            </button>
            <p className="text-center text-xs text-ink-faint">
              No Payrail fee. Funds go straight to your wallet; the buyer pays gas in ETH.
            </p>
          </div>
        </form>

        {/* Live preview: what the buyer sees at /pay/:id */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <BuyerPreview
            merchantName={merchant?.name}
            walletAddress={merchant?.walletAddress}
            description={form.description}
            customerName={form.customerName}
            amountLabel={previewAmount}
            amountOk={amountOk}
            chainName={chain.name}
            contract={chain.paymentProcessor}
            dueAt={form.dueAt}
            caption="/pay/…"
          />
          <p className="mt-3 px-1 text-xs leading-relaxed text-ink-faint">
            The link is created when you save. The buyer connects a wallet on {chain.name}, approves, then pays; the contract sends the funds to the wallet above.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{children}</p>;
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-rose-600" role="alert">{msg}</p> : null;
}
