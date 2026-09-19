"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import ConnectButton from "@/components/ConnectButton";
import StatusBadge from "@/components/StatusBadge";
import PayStepper from "@/components/PayStepper";
import AddToHomeHint from "@/components/AddToHomeHint";
import { formatUsdc, shortAddr, toSalt } from "@/lib/usdc";
import { paymentProcessorAbi, erc20Abi } from "@/lib/chain";
import { chainName, getChain, txUrl } from "@/lib/chains";

type Invoice = {
  id: string; onchainId: `0x${string}`; chainId: number; description: string; amount: string; status: string;
  dueAt?: string | null;
  merchant: { name: string; walletAddress: `0x${string}` };
  payment?: { txHash: string } | null;
};

type Step = "idle" | "approving" | "paying" | "verifying" | "done" | "error";

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const { address, isConnected, chainId } = useAccount();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [payHash, setPayHash] = useState<`0x${string}` | undefined>();

  const load = useCallback(async () => {
    const r = await fetch(`/api/invoices/${id}`);
    if (r.ok) setInv(await r.json());
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

  // Read the buyer USDC balance and allowance
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
  const { isSuccess: payMined } = useWaitForTransactionReceipt({ hash: payHash, chainId: invChainId });

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
        // tunggu allowance ter-update
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

  if (!inv) return <p>Loading invoice…</p>;
  if (!ready) {
    return (
      <div className="card mx-auto max-w-md space-y-2 text-sm">
        <div className="font-semibold">This invoice is on {chainName(inv.chainId)}</div>
        <p className="text-ink-soft">This Payrail deployment is not configured for that network, so it cannot be paid here. Ask {inv.merchant.name} for a new link.</p>
      </div>
    );
  }

  const isPaid = inv.status === "PAID" || paidOnchain === true || step === "done";
  const insufficient = balance !== undefined && balance < amount;
  const busy = step === "approving" || step === "paying" || step === "verifying";
  const needsApprove = (allowance ?? 0n) < amount;
  const due = inv.dueAt ? new Date(inv.dueAt) : null;
  const dueDays = due ? Math.ceil((due.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="card space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-soft">Payment to</div>
            <div className="font-semibold">{inv.merchant.name}</div>
          </div>
          <StatusBadge status={isPaid ? "PAID" : inv.status} />
        </div>

        <div>
          <div className="text-sm text-ink-soft">{inv.description}</div>
          <div className="mt-1 text-4xl font-bold">{formatUsdc(inv.amount)} <span className="text-lg font-normal text-ink-soft">USDC</span></div>
        </div>

        <dl className="space-y-1 text-xs text-ink-soft">
          {due && !isPaid && inv.status === "PENDING" && (
            <div className="flex justify-between">
              <dt>Due</dt>
              <dd className={dueDays !== null && dueDays <= 1 ? "text-ink" : ""}>
                {due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                {dueDays !== null && (dueDays > 1 ? ` · in ${dueDays} days` : dueDays === 1 ? " · tomorrow" : dueDays === 0 ? " · today" : "")}
              </dd>
            </div>
          )}
          <div className="flex justify-between"><dt>Network</dt><dd>{cfg!.name}</dd></div>
          <div className="flex justify-between"><dt>To wallet</dt><dd className="font-mono">{shortAddr(inv.merchant.walletAddress)}</dd></div>
          <div className="flex justify-between"><dt>Contract</dt><dd className="font-mono">{shortAddr(PP!)}</dd></div>
        </dl>

        {isPaid ? (
          <div className="rounded-lg bg-field p-4 text-sm text-ink">
            <div className="font-semibold">✓ Invoice paid</div>
            {(inv.payment?.txHash || payHash) && (
              <div className="mt-1 break-all font-mono text-xs">
                {txUrl(inv.chainId, inv.payment?.txHash || payHash!) ? (
                  <a className="underline" target="_blank" href={txUrl(inv.chainId, inv.payment?.txHash || payHash!)}>{inv.payment?.txHash || payHash}</a>
                ) : (inv.payment?.txHash || payHash)}
              </div>
            )}
          </div>
        ) : inv.status === "EXPIRED" ? (
          <div className="rounded-lg bg-field p-4 text-sm">
            <div className="font-medium text-ink">This invoice has expired</div>
            <p className="mt-1 text-ink-soft">It was due {due?.toLocaleDateString("en-GB")}. Ask {inv.merchant.name} for a new link.</p>
          </div>
        ) : inv.status !== "PENDING" ? (
          <div className="rounded-lg bg-field p-4 text-sm">This invoice is {inv.status.toLowerCase()} and cannot be paid.</div>
        ) : !isConnected ? (
          <div className="flex justify-center"><ConnectButton chainId={invChainId} /></div>
        ) : wrongChain ? (
          <div className="space-y-2 text-center">
            <p className="text-sm text-ink-soft">This invoice is paid on {cfg!.name}.</p>
            <div className="flex justify-center"><ConnectButton chainId={invChainId} /></div>
          </div>
        ) : (
          <div className="space-y-4">
            <PayStepper step={step} needsApprove={needsApprove} />
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Your USDC balance</span>
              <span className={`font-mono ${insufficient ? "text-rose-600" : ""}`}>
                {balance !== undefined ? formatUsdc(balance) : "…"}
              </span>
            </div>
            <button className="btn-primary w-full py-3 text-base" disabled={busy || insufficient} onClick={handlePay}>
              {step === "approving" && "1/2 Approving USDC… (confirm in wallet)"}
              {step === "paying" && "2/2 Paying… (confirm in wallet)"}
              {step === "verifying" && "Verifying onchain…"}
              {(step === "idle" || step === "error") && (insufficient ? "Insufficient balance" : `Pay ${formatUsdc(inv.amount)} USDC`)}
            </button>
            {payHash && (
              <p className="break-all text-center font-mono text-xs text-ink-soft">tx {payHash}</p>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </div>
      {!isConnected && !isPaid && inv.status === "PENDING" && (
        <p className="text-center text-xs text-ink-soft">
          On a phone? Open this page inside your wallet&apos;s browser, or tap Connect and choose the mobile option.
        </p>
      )}
      <AddToHomeHint />
      <p className="text-center text-xs text-ink-faint">Powered by Payrail · Funds go straight to the merchant and are never held.</p>
    </div>
  );
}
