import { CheckIcon } from "./Icons";

type Step = "idle" | "approving" | "paying" | "verifying" | "done" | "error";

type Row = { key: string; name: string; sub: string; done: boolean; active: boolean; busy: boolean };

/**
 * Progress for the pay flow: Connect → Approve → Pay → Confirmed.
 *
 * `step` is the page's own state machine, `needsApprove` whether the allowance still has to be
 * raised, `connected` whether a wallet on the right network is attached (defaults to true so
 * existing callers keep the same output). Rows are derived, never stored, so the stepper can
 * never disagree with the page.
 */
export default function PayStepper({
  step,
  needsApprove,
  connected = true,
}: {
  step: Step;
  needsApprove: boolean;
  connected?: boolean;
}) {
  const order: Step[] = ["idle", "approving", "paying", "verifying", "done"];
  const now = order.indexOf(step === "error" ? "idle" : step);
  const busy = step === "approving" || step === "paying" || step === "verifying";
  const finished = step === "done";

  // Once the flow has moved past approve, or the allowance already covers the amount, the
  // approve row is complete. It only "works" while the wallet is signing the approval.
  const approveDone = finished || now > order.indexOf("approving") || (connected && !needsApprove);
  const payDone = finished || now > order.indexOf("paying");

  const rows: Row[] = [
    {
      key: "connect",
      name: "Connect",
      sub: connected ? "wallet attached" : "wallet on the right network",
      done: connected,
      active: !connected,
      busy: false,
    },
    {
      key: "approve",
      name: "Approve",
      sub: connected && !needsApprove && !finished && now < order.indexOf("paying") ? "allowance already covers it" : "allowance for the contract",
      done: approveDone,
      active: connected && !approveDone,
      busy: step === "approving",
    },
    {
      key: "pay",
      name: "Pay",
      sub: "USDC straight to the merchant",
      done: payDone,
      active: connected && approveDone && !payDone,
      busy: step === "paying",
    },
    {
      key: "confirmed",
      name: "Confirmed",
      sub: finished ? "PAID" : "receipt and event match",
      done: finished,
      active: connected && payDone && !finished,
      busy: step === "verifying",
    },
  ];

  return (
    <ol aria-label="Payment progress" className="grid grid-cols-4 gap-1">
      {rows.map((r, i) => {
        const last = i === rows.length - 1;
        return (
          <li key={r.key} aria-current={r.active ? "step" : undefined} className="relative flex flex-col items-center text-center">
            {/* connector to the next step */}
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-3.5 h-px w-full ${r.done ? "bg-ink" : "bg-line"}`}
              />
            )}
            <span
              className={`relative z-[1] flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] transition-colors ${
                r.done
                  ? "bg-ink text-bg"
                  : r.active
                    ? "border border-ink bg-bg text-ink"
                    : "border border-line bg-bg text-ink-faint"
              }`}
            >
              {r.done ? (
                <CheckIcon className="h-3.5 w-3.5" />
              ) : r.busy ? (
                // fx-pulse is the keyframe the PAID badge uses; .animate-pulse is a skeleton shimmer here.
                <span className="h-2 w-2 rounded-full bg-ink animate-[fx-pulse_1.8s_ease-in-out_infinite] motion-reduce:animate-none" />
              ) : (
                i + 1
              )}
            </span>
            <span className={`mt-2 text-[12px] font-medium leading-tight ${r.done || r.active ? "text-ink" : "text-ink-faint"}`}>
              {r.name}
            </span>
            <span className="mt-0.5 hidden text-[10.5px] leading-tight text-ink-faint sm:block">{r.sub}</span>
            {r.busy && <span className="sr-only">in progress</span>}
          </li>
        );
      })}
    </ol>
  );
}
