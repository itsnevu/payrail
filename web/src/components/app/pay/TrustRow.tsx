import Link from "next/link";

const POINTS = [
  { title: "Funds go directly to the merchant wallet", body: "One transferFrom, buyer to merchant." },
  { title: "Verified from the chain", body: "PAID comes from the receipt and event, not a click." },
  { title: "Payrail never holds funds", body: "The contract balance is zero by construction." },
] as const;

/** The three facts a buyer should know before signing, and where to read the rest. */
export default function TrustRow() {
  return (
    <aside aria-label="How this payment works" className="space-y-3">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {POINTS.map((p) => (
          <li key={p.title} className="rounded-2xl border border-line/80 bg-surface/60 px-3.5 py-3">
            <div className="text-[12.5px] font-semibold leading-snug text-ink">{p.title}</div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-ink-soft">{p.body}</div>
          </li>
        ))}
      </ul>
      <p className="text-center text-[12px] text-ink-faint">
        Not sure what your wallet will ask?{" "}
        <Link href="/docs/paying-an-invoice" className="text-ink-soft underline decoration-line underline-offset-4 hover:text-ink">
          Read the buyer guide
        </Link>
      </p>
    </aside>
  );
}
