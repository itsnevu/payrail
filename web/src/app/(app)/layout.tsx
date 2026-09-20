import Link from "next/link";
import type { ReactNode } from "react";
import ConnectButton from "@/components/ConnectButton";
import InstallAppButton from "@/components/InstallAppButton";
import MobileNav from "@/components/MobileNav";
import AppNav from "@/components/app/dashboard/AppNav";
import { Wordmark } from "@/components/Logo";

/**
 * Frame for app pages (/app, /invoices/*, /pay/*): glass header with wordmark, nav and wallet.
 * Effects.tsx toggles `is-scrolled` on <html> past 24px; the bar tightens from 68px to 56px and
 * picks up a soft shadow, the same behaviour as the landing header.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="fx-glass sticky top-0 z-20 transition-shadow duration-300 [.is-scrolled_&]:shadow-[inset_0_-1px_0_rgba(0,0,0,0.06),0_8px_24px_-16px_rgba(10,10,30,0.35)]">
        <div className="mx-auto flex h-[68px] w-full max-w-[1180px] items-center justify-between px-4 transition-[height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:px-8 [.is-scrolled_&]:h-[56px]">
          <Link href="/" aria-label="Payrail home" className="inline-flex items-start gap-1">
            <Wordmark markSize={36} />
            <span className="mt-0.5 rounded-full border border-line px-1.5 py-px font-mono text-[10px] leading-4 text-ink-soft">beta</span>
          </Link>
          <nav aria-label="App" className="flex items-center gap-1">
            <AppNav />
            <InstallAppButton className="hidden sm:inline-flex" />
            <span className="sm:ml-1.5">
              <ConnectButton />
            </span>
          </nav>
        </div>
      </header>
      {/* Extra bottom padding on phones clears the fixed tab bar. */}
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 pb-24 sm:px-8 sm:py-8 sm:pb-8">{children}</main>
      <MobileNav />
    </div>
  );
}
