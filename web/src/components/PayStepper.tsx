import { CheckIcon } from "./Icons";

type Step = "idle" | "approving" | "paying" | "verifying" | "done" | "error";

/**
 * Visual progress for the pay flow, mirroring the "Payment progress" list in the landing
 * page phone mockup: Approve USDC → pay(invoiceId) → Verify onchain → Status PAID.
 * The approve row is dropped when the allowance already covers the amount.
 */
export default function PayStepper({ step, needsApprove }: { step: Step; needsApprove: boolean }) {
  const rows = [
    ...(needsApprove ? [{ key: "approving", name: "Approve USDC", sub: "allowance for the contract" }] : []),
    { key: "paying", name: "pay(invoiceId)", sub: "USDC straight to the merchant" },
    { key: "verifying", name: "Verify onchain", sub: "receipt + event match" },
    { key: "done", name: "Status PAID", sub: "history updated" },
  ] as const;

  const order: string[] = ["idle", "approving", "paying", "verifying", "done"];
  const now = order.indexOf(step === "error" ? "idle" : step);

  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-field text-sm">
      {rows.map((r, i) => {
        const idx = order.indexOf(r.key);
        const done = now > idx || step === "done";
        const active = now === idx && step !== "done";
        return (
          <li key={r.key} className={`flex items-center gap-3 px-3.5 py-2.5 ${active ? "bg-[#202020]" : ""}`}>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
                done ? "bg-ink text-bg" : active ? "border border-ink text-ink" : "border border-line text-ink-faint"
              }`}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block font-mono ${done || active ? "text-ink" : "text-ink-soft"}`}>{r.name}</span>
              <span className="block text-xs text-ink-faint">{r.sub}</span>
            </span>
            {active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" aria-label="in progress" />}
          </li>
        );
      })}
    </ol>
  );
}
