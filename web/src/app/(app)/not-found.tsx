import Link from "next/link";
import { LINKS } from "@/lib/links";

/** 404 inside the app frame (e.g. a mistyped or deleted invoice id). */
export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">404</p>
        <h1 className="text-xl font-semibold">No invoice here</h1>
        <p className="text-sm text-ink-soft">The link may be incomplete, or the invoice was removed.</p>
        <div className="flex justify-center gap-2">
          <Link className="btn-primary" href={LINKS.app}>Dashboard</Link>
          <Link className="btn-secondary" href={LINKS.newInvoice}>New invoice</Link>
        </div>
      </div>
    </div>
  );
}
