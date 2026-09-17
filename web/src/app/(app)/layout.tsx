import Link from "next/link";
import type { ReactNode } from "react";
import ConnectButton from "@/components/ConnectButton";
import InstallAppButton from "@/components/InstallAppButton";
import MobileNav from "@/components/MobileNav";
import { Wordmark } from "@/components/Logo";
import { LINKS } from "@/lib/links";

/** Frame for app pages (/app, /invoices/*, /pay/*): header with wordmark, nav and wallet. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-[68px] w-full max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Payrail home" className="inline-flex items-start gap-1">
            <Wordmark markSize={36} />
            <span className="mt-0.5 rounded-full border border-line px-1.5 py-px font-mono text-[10px] leading-4 text-ink-soft">beta</span>
          </Link>
          <nav className="flex items-center gap-1">
            <span className="hidden items-center gap-1 sm:flex">
              <Link href={LINKS.app} className="rounded-full px-3.5 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink">
                Dashboard
              </Link>
              <Link href={LINKS.newInvoice} className="rounded-full px-3.5 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink">
                New invoice
              </Link>
              <Link href={LINKS.docs} className="rounded-full px-3.5 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink">
                Docs
              </Link>
            </span>
            <InstallAppButton className="hidden sm:inline-flex" />
            <span className="sm:ml-1.5">
              <ConnectButton />
            </span>
          </nav>
        </div>
      </header>
      {/* Extra bottom padding on phones clears the fixed tab bar. */}
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 py-8 pb-24 sm:px-8 sm:pb-8">{children}</main>
      <MobileNav />
    </div>
  );
}
