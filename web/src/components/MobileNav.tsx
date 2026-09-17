"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, PlusIcon, ReceiptIcon } from "./Icons";
import { LINKS } from "@/lib/links";

const TABS = [
  { href: LINKS.app, label: "Dashboard", Icon: GridIcon, match: (p: string) => p === LINKS.app },
  { href: LINKS.newInvoice, label: "New", Icon: PlusIcon, match: (p: string) => p === LINKS.newInvoice },
  { href: LINKS.docs, label: "Docs", Icon: ReceiptIcon, match: (p: string) => p.startsWith(LINKS.docs) },
];

/**
 * Bottom tab bar for phones (the header nav is hidden below `sm`). Pads itself for the
 * iOS home indicator when installed (`viewportFit: cover` is set in the root layout).
 */
export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-14 items-stretch">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active ? "text-ink" : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
