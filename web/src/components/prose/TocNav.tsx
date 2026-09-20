"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

export type TocItem = { id: string; text: string; level: number };

/**
 * Table of contents for a long document.
 *
 * Above `lg` it is a sticky column that marks the heading currently in view. Below `lg` it is a
 * closed "On this page" disclosure that sits above the article. Both share one active id, kept
 * with an IntersectionObserver over the headings, so nothing runs on scroll.
 */
export default function TocNav({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const targets = items.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    if (window.location.hash) {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (items.some((h) => h.id === id)) setActive(id);
    }

    // The band between the header and 60% down the viewport is "in view". Of the headings in it
    // the first in document order wins; if none is, the last one above the band stays active.
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        if (visible.size > 0) {
          const first = items.find((h) => visible.has(h.id));
          if (first) setActive(first.id);
          return;
        }
        // Nothing in the band: pick the last heading whose top is above it.
        const line = window.innerHeight * 0.4;
        let last: string | undefined;
        for (const el of targets) {
          if (el.getBoundingClientRect().top < line) last = el.id;
          else break;
        }
        if (last) setActive(last);
      },
      { rootMargin: "-88px 0px -60% 0px", threshold: 0 },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  function go(e: MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id);
    if (!el) return; // let the browser handle it
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.history.pushState(null, "", `#${id}`);
    setActive(id);
    if (details.current) details.current.open = false;
  }

  const list = (
    <ul className="space-y-0.5 border-l border-line">
      {items.map((h) => {
        const current = h.id === active;
        return (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => go(e, h.id)}
              aria-current={current ? "location" : undefined}
              className={`-ml-px block border-l-2 py-1.5 text-[13px] leading-snug transition-colors ${
                h.level === 3 ? "pl-6" : "pl-3.5"
              } ${current ? "border-ink font-medium text-ink" : "border-transparent text-ink-soft hover:border-ink-faint hover:text-ink"}`}
            >
              {h.text}
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="order-first min-w-0 lg:order-none">
      <details ref={details} className="prose-toc surface-inset rounded-2xl lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold text-ink select-none [&::-webkit-details-marker]:hidden">
          <span className="font-mono text-[11px] tracking-[0.12em] text-ink-faint uppercase">On this page</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="prose-toc-chevron text-ink-faint transition-transform">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="px-4 pb-4">{list}</div>
      </details>

      <nav aria-label="On this page" className="sticky top-[92px] hidden max-h-[calc(100vh-120px)] overflow-y-auto lg:block">
        <div className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase">On this page</div>
        <div className="mt-3">{list}</div>
      </nav>
    </div>
  );
}
