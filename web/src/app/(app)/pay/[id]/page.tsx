"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import ConnectButton from "@/components/ConnectButton";
import StatusBadge from "@/components/StatusBadge";
import PayStepper from "@/components/PayStepper";
import AddToHomeHint from "@/components/AddToHomeHint";
import PayNotice from "@/components/app/pay/PayNotice";
import Receipt from "@/components/app/pay/Receipt";
import HashLink from "@/components/app/pay/HashLink";
import TrustRow from "@/components/app/pay/TrustRow";
import { DetailList, DetailRow } from "@/components/app/pay/DetailRow";
import { invNo } from "@/components/app/format";
import { formatUsdc, shortAddr, toSalt } from "@/lib/usdc";
import { paymentProcessorAbi, erc20Abi } from "@/lib/chain";
import { chainName, getChain } from "@/lib/chains";

type Invoice = {
  id: string; onchainId: `0x${string}`; chainId: number; description: string; amount: string; status: string;
  dueAt?: string | null;
  merchant: { name: string; walletAddress: `0x${string}` };
  payment?: { txHash: string; blockNumber?: string; paidAt?: string; payer?: string } | null;
};

type Step = "idle" | "approving" | "paying" | "verifying" | "done" | "error";

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const { address, isConnected, chainId } = useAccount();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [missing, setMissing] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [payHash, setPayHash] = useState<`0x${string}` | undefined>();

  const load = useCallback(async () => {
    const r = await fetch(`/api/invoices/${id}`);
    if (r.ok) setInv(await r.json());
    else if (r.status === 404) setMissing(true);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // Poll while PENDING and idle: the indexer may mark it paid from a payment made elsewhere.
  useEffect(() => {
    if (inv?.status !== "PENDING" || step !== "idle") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [inv?.status, step, load]);

  const amount = inv ? BigInt(inv.amount) : 0n;
  // The invoice pins its chain. Every read and write below is addressed to that chain
  // explicitly, so a wallet sitting on another network never reads the wrong contract.
  const cfg = getChain(inv?.chainId);
  const invChainId = cfg?.id;
  const PP = cfg?.paymentProcessor;
  const USDC = cfg?.usdc;
  const ready = Boolean(cfg && PP && USDC);
  const wrongChain = isConnected && invChainId !== undefined && chainId !== invChainId;

  // Read the buyer USDG balance and allowance
  const { data: balance } = useReadContract({
    address: USDC, abi: erc20Abi, functionName: "balanceOf", chainId: invChainId,
    args: address ? [address] : undefined, query: { enabled: !!address && ready },
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC, abi: erc20Abi, functionName: "allowance", chainId: invChainId,
    args: address && PP ? [address, PP] : undefined, query: { enabled: !!address && ready },
  });
  // Check onchain whether the invoice is already paid (double-check next to the DB)
  const { data: paidOnchain } = useReadContract({
    address: PP, abi: paymentProcessorAbi, functionName: "isPaid", chainId: invChainId,
    args: inv ? [inv.onchainId] : undefined, query: { enabled: !!inv && ready },
  });

  const { writeContractAsync } = useWriteContract();
  const { data: receipt, isSuccess: payMined } = useWaitForTransactionReceipt({ hash: payHash, chainId: invChainId });

  // Once the pay tx is mined, ask the backend to verify (retry until final)
  useEffect(() => {
    if (!payMined || !payHash || !inv) return;
    let cancelled = false;
    setStep("verifying");
    (async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        const r = await fetch(`/api/invoices/${inv.id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: payHash }),
        });
        const data = await r.json();
        if (r.status === 200 && data.ok) { setInv(data.invoice); setStep("done"); return; }
        if (r.status === 202 && data.pending) { await new Promise((res) => setTimeout(res, 3000)); continue; }
        setError(data.reason || data.error || "verification failed"); setStep("error"); return;
      }
      if (!cancelled) { setError("timed out waiting for confirmations, try refreshing"); setStep("error"); }
    })();
    return () => { cancelled = true; };
  }, [payMined, payHash, inv?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePay() {
    if (!inv || !address || !PP || !USDC || invChainId === undefined) return;
    setError("");
    try {
      // 1) Approve if the allowance is short
      if ((allowance ?? 0n) < amount) {
        setStep("approving");
        await writeContractAsync({
          address: USDC, abi: erc20Abi, functionName: "approve", chainId: invChainId,
          args: [PP, amount],
        });
        // wait for the allowance read to catch up
        for (let i = 0; i < 10; i++) {
          const { data } = await refetchAllowance();
          if ((data ?? 0n) >= amount) break;
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      // 2) Call PaymentProcessor.pay
      setStep("paying");
      const hash = await writeContractAsync({
        address: PP, abi: paymentProcessorAbi, functionName: "pay", chainId: invChainId,
        args: [toSalt(inv.id), inv.merchant.walletAddress, amount],
      });
      setPayHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.split("\n")[0]);
      setStep("error");
    }
  }

  // ---------- Not found ----------
  if (missing) {
    return (
      <div className="mx-auto w-full max-w-[560px]">
        <div className="card space-y-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Payment link</p>
          <h1 className="text-xl font-semibold">No invoice here</h1>
          <p className="text-sm text-ink-soft">
            This link does not point to an invoice. It may be incomplete, or the invoice was removed. Ask whoever sent it for a fresh link.
          </p>
          <p className="text-[12px] text-ink-faint">
            <Link href="/docs/paying-an-invoice" className="underline decoration-line underline-offset-4 hover:text-ink">
              What a Payrail payment link looks like
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ---------- Loading ----------
  if (!inv) {
    return (
      <div className="mx-auto w-full max-w-[560px]" aria-busy="true" aria-label="Loading invoice">
        <div className="card space-y-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-field" />
              <div className="h-5 w-40 animate-pulse rounded bg-field" />
            </div>
            <div className="h-5 w-16 animate-pulse rounded-full bg-field" />
          </div>
          <div className="h-4 w-2/3 animate-pulse rounded bg-field" />
          <div className="h-12 w-1/2 animate-pulse rounded bg-field" />
          <div className="h-28 animate-pulse rounded-2xl bg-field" />
        </div>
        <p className="sr-only">Loading invoice</p>
      </div>
    );
  }

  // ---------- Network not configured on this deployment ----------
  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-[560px] space-y-5">
        <div className="card space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Payment to</div>
            <h1 className="mt-1 text-lg font-semibold leading-tight">{inv.merchant.name}</h1>
          </div>
          <PayNotice tone="info" title={`This invoice is on ${chainName(inv.chainId)}`}>
            This Payrail deployment is not configured for that network, so it cannot be paid here. Ask {inv.merchant.name} for a new link.
          </PayNotice>
        </div>
        <TrustRow />
      </div>
    );
  }

  const isPaid = inv.status === "PAID" || paidOnchain === true || step === "done";
  const insufficient = balance !== undefined && balance < amount;
  const busy = step === "approving" || step === "paying" || step === "verifying";
  const needsApprove = (allowance ?? 0n) < amount;
  const due = inv.dueAt ? new Date(inv.dueAt) : null;
  const dueDays = due ? Math.ceil((due.getTime() - Date.now()) / 86_400_000) : null;
  const gasSymbol = cfg!.chain.nativeCurrency.symbol;
  const finalHash = inv.payment?.txHash || payHash;
  const blockNumber = inv.payment?.blockNumber ?? (receipt?.blockNumber !== undefined ? receipt.blockNumber.toString() : undefined);

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-5">
      <article className="card overflow-hidden !rounded-[28px] !p-0" aria-labelledby="pay-title">
        {/* ---------- Head: who, what, how much ---------- */}
        <div className="px-5 pt-5 sm:px-7 sm:pt-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Payment to</div>
              <h1 id="pay-title" className="mt-1 truncate text-lg font-semibold leading-tight">{inv.merchant.name}</h1>
            </div>
            <StatusBadge status={isPaid ? "PAID" : inv.status} />
          </div>

          <div className="mt-6">
            {inv.description && <p className="text-sm text-ink-soft">{inv.description}</p>}
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
              <span className="tnum min-w-0 text-[44px] font-semibold leading-none tracking-[-0.03em] [overflow-wrap:anywhere] sm:text-[52px]">{formatUsdc(inv.amount)}</span>
              <span className="font-mono text-base text-ink-soft">USDG</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11.5px] text-ink-faint">
            <span className="text-ink-soft">{invNo(inv.id)}</span>
            <span aria-hidden="true">·</span>
            <span className="break-all">{inv.id}</span>
          </div>
        </div>

        {/* ---------- Reference rows ---------- */}
        <div className="mt-5 border-t border-line/70 px-5 sm:px-7">
          <DetailList>
            {due && !isPaid && inv.status === "PENDING" && (
              <DetailRow label="Due" mono={false} tone={dueDays !== null && dueDays <= 1 ? "ink" : "soft"}>
                {due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                {dueDays !== null && (dueDays > 1 ? ` · in ${dueDays} days` : dueDays === 1 ? " · tomorrow" : dueDays === 0 ? " · today" : "")}
              </DetailRow>
            )}
            <DetailRow label="Network" mono={false}>{cfg!.name}</DetailRow>
            <DetailRow label="To wallet"><span title={inv.merchant.walletAddress}>{shortAddr(inv.merchant.walletAddress)}</span></DetailRow>
            <DetailRow label="Contract"><span title={PP}>{shortAddr(PP!)}</span></DetailRow>
          </DetailList>
        </div>

        {/* ---------- Action area: exactly one thing to do ---------- */}
        <div className="space-y-4 border-t border-line/70 bg-field/50 px-5 py-5 sm:px-7 sm:py-6">
          {isPaid ? (
            <Receipt
              amount={inv.amount}
              chainId={inv.chainId}
              merchantName={inv.merchant.name}
              txHash={finalHash}
              blockNumber={blockNumber}
              paidAt={inv.payment?.paidAt}
              payer={inv.payment?.payer}
            />
          ) : inv.status === "EXPIRED" ? (
            <PayNotice tone="info" title="This invoice has expired">
              It was due {due?.toLocaleDateString("en-GB")}. Ask {inv.merchant.name} for a new link.
            </PayNotice>
          ) : inv.status !== "PENDING" ? (
            <PayNotice tone="info" title={`This invoice is ${inv.status.toLowerCase()}`}>
              It cannot be paid here. Ask {inv.merchant.name} for a new link.
            </PayNotice>
          ) : !isConnected ? (
            <>
              <PayStepper step={step} needsApprove={needsApprove} connected={false} />
              <div className="flex justify-center pt-1">
                <ConnectButton chainId={invChainId} className="btn-primary !px-6 !py-3 !text-base" />
              </div>
              <p className="text-center text-[12px] text-ink-faint">
                Connecting moves nothing. It lets the page read your balance and allowance.
              </p>
              <PayNotice tone="quiet">
                On a phone? Open this page inside your wallet&apos;s browser, or tap Connect and choose the mobile option.
              </PayNotice>
            </>
          ) : wrongChain ? (
            <>
              <PayStepper step={step} needsApprove={needsApprove} connected={false} />
              <p className="text-center text-sm text-ink-soft">This invoice is paid on {cfg!.name}.</p>
              <div className="flex justify-center">
                <ConnectButton chainId={invChainId} />
              </div>
              <p className="text-center text-[12px] text-ink-faint">
                Your wallet will ask to switch, or to add {cfg!.name} first if it has never seen it.
              </p>
            </>
          ) : (
            <>
              <PayStepper step={step} needsApprove={needsApprove} />

              <DetailList className="border-t border-line/70">
                <DetailRow
                  label="Your balance"
                  tone={insufficient ? "alert" : "ink"}
                  hint={insufficient ? "not enough for this invoice" : undefined}
                >
                  {balance !== undefined ? `${formatUsdc(balance)} USDG` : "…"}
                </DetailRow>
                <DetailRow
                  label="Allowance"
                  tone="soft"
                  hint={allowance === undefined ? undefined : needsApprove ? "approval needed before paying" : "already covers this invoice"}
                >
                  {allowance !== undefined ? `${formatUsdc(allowance)} USDG` : "…"}
                </DetailRow>
              </DetailList>

              <div className="space-y-2">
                <button
                  type="button"
                  className="btn-primary w-full !py-3.5 !text-base"
                  disabled={busy || insufficient}
                  aria-busy={busy || undefined}
                  onClick={handlePay}
                >
                  {step === "approving" && "1/2 Approving USDG… (confirm in wallet)"}
                  {step === "paying" && "2/2 Paying… (confirm in wallet)"}
                  {step === "verifying" && "Verifying onchain…"}
                  {(step === "idle" || step === "error") && (insufficient ? "Insufficient balance" : `Pay ${formatUsdc(inv.amount)} USDG`)}
                </button>
                <p className="text-center text-[12px] text-ink-faint">
                  Gas is paid in {gasSymbol} on {cfg!.name}. {needsApprove ? "Two wallet prompts: approve, then pay." : "One wallet prompt."}
                </p>
              </div>

              {error && (
                <PayNotice tone="error" title="Payment did not go through">
                  <span className="font-mono text-[12px]">{error}</span>
                </PayNotice>
              )}

              {payHash && (
                <div className="rounded-2xl border border-line/80 bg-surface px-4 py-3">
                  <HashLink chainId={inv.chainId} hash={payHash} label={step === "verifying" ? "Transaction mined, verifying" : "Transaction sent"} />
                </div>
              )}
            </>
          )}
        </div>
      </article>

      <TrustRow />
      <AddToHomeHint />
      <p className="text-center text-[12px] text-ink-faint">
        Powered by Payrail · Funds go straight to the merchant and are never held.
      </p>
    </div>
  );
}
