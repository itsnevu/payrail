"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

export type MenuItem = { href: string; label: string; note?: string };

/**
 * The compact menu the prose header shows below `sm`, where the section links do not fit
 * beside the wordmark. A button toggles a sheet under the header; the sheet closes on Escape,
 * on a click outside, and on navigation.
 */
export default function ProseMenu({ items, active }: { items: MenuItem[]; active?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const pathname = usePathname();

  // Navigating closes the sheet, whichever link was used.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && !el.closest(`[data-prose-menu="${id}"]`)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open, id]);

  return (
    <div data-prose-menu={id} className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-sheet`}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-field"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>

      <div
        id={`${id}-sheet`}
        hidden={!open}
        className="prose-sheet absolute inset-x-0 top-full px-4 pt-2 pb-4"
      >
        <nav aria-label="Site" className="surface rounded-[24px] p-2">
          <ul className="divide-y divide-line/70">
            {items.map((item) => {
              const current = active === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center justify-between gap-4 rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors ${
                      current ? "bg-field text-ink" : "text-ink-soft hover:bg-field/70 hover:text-ink"
                    }`}
                  >
                    <span>
                      {item.label}
                      {item.note && <span className="mt-0.5 block text-[12.5px] font-normal text-ink-faint">{item.note}</span>}
                    </span>
                    <span aria-hidden className="text-ink-faint">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
