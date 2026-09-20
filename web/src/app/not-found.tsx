import Link from "next/link";
import { ProseShell } from "@/components/prose/ProseShell";
import { CONTACT_EMAIL, LINKS } from "@/lib/links";

export const metadata = { title: "Not found: Payrail" };

const ELSEWHERE = [
  { href: LINKS.docs, label: "Docs", note: "How invoices are created, paid and verified on chain." },
  { href: LINKS.faq, label: "FAQ", note: "Short answers to the questions merchants and buyers ask." },
  { href: LINKS.app, label: "Dashboard", note: "Your invoices, their status, and payment history." },
];

export default function NotFound() {
  return (
    <ProseShell>
      <div className="mx-auto w-full max-w-[720px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="flex items-center gap-3">
          <span className="badge tnum bg-field font-mono text-ink-soft">404</span>
          <span className="font-mono text-[12px] tracking-[0.08em] text-ink-faint uppercase">Not found</span>
        </div>
        <h1 className="mt-5 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-ink sm:text-[44px]">
          There is nothing at this address.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16.5px] leading-relaxed text-ink-soft">
          The page either moved or never existed. Nothing was charged and no invoice was touched. Here is where the
          rest of the site is.
        </p>

        <ul className="mt-10 grid gap-3 sm:grid-cols-3">
          {ELSEWHERE.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="surface-interactive group flex h-full flex-col justify-between rounded-[24px] p-5"
              >
                <span>
                  <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{item.label}</span>
                  <span className="mt-1.5 block text-[13.5px] leading-relaxed text-ink-soft">{item.note}</span>
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition-colors group-hover:text-ink">
                  Open
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/" className="btn-primary">
            Back to the front page
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="btn-secondary">
            Report a broken link
          </a>
        </div>
      </div>
    </ProseShell>
  );
}
