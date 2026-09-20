"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LINKS } from "@/lib/links";

const ITEMS = [
  { href: LINKS.app, label: "Dashboard", match: (p: string) => p === LINKS.app },
  { href: LINKS.newInvoice, label: "New invoice", match: (p: string) => p === LINKS.newInvoice },
  { href: LINKS.docs, label: "Docs", match: (p: string) => p.startsWith(LINKS.docs) },
  { href: LINKS.faq, label: "FAQ", match: (p: string) => p.startsWith(LINKS.faq) },
] as const;

/** Desktop links in the app header. Hidden below sm, where MobileNav takes over. */
export default function AppNav() {
  const pathname = usePathname() ?? "";
  return (
    <span className="hidden items-center gap-0.5 sm:flex">
      {ITEMS.map(({ href, label, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors ${
              active ? "bg-field text-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </span>
  );
}
