"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LINKS } from "@/lib/links";

/** Error boundary for app pages: a readable card instead of a blank screen. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Something went wrong</p>
        <h1 className="text-xl font-semibold">This page hit an error</h1>
        <p className="text-sm text-ink-soft">
          Nothing was sent onchain by this screen. Try again, or head back to the dashboard.
        </p>
        {error.digest && <p className="font-mono text-[11px] text-ink-faint">ref {error.digest}</p>}
        <div className="flex justify-center gap-2">
          <button type="button" className="btn-primary" onClick={reset}>Try again</button>
          <Link className="btn-secondary" href={LINKS.app}>Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
