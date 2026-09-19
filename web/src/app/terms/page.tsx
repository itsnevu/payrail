import { ProseShell } from "@/components/prose/ProseShell";
import { CONTACT_EMAIL } from "@/lib/links";

export const metadata = { title: "Terms: Payrail" };

export default function Page() {
  return (
    <ProseShell>
      <div className="mx-auto max-w-[70ch] px-5 py-16 sm:px-8 md:py-24">
        <h1 className="text-[40px] font-semibold tracking-[-0.025em] text-ink">Terms</h1>
        <div className="mt-8 space-y-5 text-[16px] leading-relaxed text-ink-soft">
          <p>Payrail is reconciliation software, not a payment service provider, bank or custodian. It is provided as is, without warranty, and responsibility for your funds stays with you.</p>
          <p>USDC moves directly from the buyer&apos;s wallet to the merchant&apos;s wallet through the PaymentProcessor contract. The contract never holds a balance, and Payrail never has access to anyone&apos;s funds. Blockchain transactions are final; there is no cancellation or refund mechanism on our side.</p>
          <p>The PAID status is granted only after the payment transaction has been verified from the onchain receipt and event, with the configured number of confirmations. Until then an invoice is PENDING even if the buyer says they have paid.</p>
          <p>Merchants are responsible for the correctness of the wallet address they register and for the content of the invoices they create. An invoice with the wrong address will be paid to the wrong address, and cannot be reversed.</p>
          <p>This software is in beta. It runs on Arc and on Robinhood Chain, and each invoice is pinned to one of them; some of these networks are test networks. There has been no independent security audit. Features, data schema and parameters may change.</p>
          <p>You are responsible for your own tax position and for the laws that apply where you live.</p>
          <p>
            Questions:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:text-ink">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
        <p className="mt-12 border-t border-line pt-6 text-[14px] text-ink-faint">Last updated 17 September 2026</p>
      </div>
    </ProseShell>
  );
}
