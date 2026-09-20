"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { CONTACT_EMAIL } from "@/lib/links";

export type FaqBrowserItem = {
  id: string;
  question: string;
  /** Plain text of the answer, for matching. */
  text: string;
  /** The answer, already rendered on the server. */
  answer: ReactNode;
};

export type FaqBrowserSection = {
  id: string;
  title: string;
  lede?: ReactNode;
  items: FaqBrowserItem[];
};

/** Header (56px once scrolled) plus the sticky chip row, so anchors land below both. */
const SCROLL_MARGIN = "scroll-mt-[124px]";

/**
 * The interactive part of the FAQ: a filter box, a sticky row of section chips and the
 * accordions. Answers arrive as rendered nodes from the server, so this component only decides
 * which of them are shown and which are open. Without JavaScript every question is still a
 * native details element and the chips are plain anchors.
 */
export default function FaqBrowser({ sections }: { sections: FaqBrowserSection[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const chipRow = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // The open set from before a search began, restored when the box is cleared.
  const beforeSearch = useRef<Record<string, boolean> | null>(null);

  const total = useMemo(() => sections.reduce((n, s) => n + s.items.length, 0), [sections]);

  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sections) for (const it of s.items) map.set(it.id, `${it.question} ${it.text}`.toLowerCase());
    return map;
  }, [sections]);

  const terms = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const searching = terms.length > 0;

  const visible = useMemo(() => {
    return sections
      .map((s) => ({
        ...s,
        items: searching
          ? s.items.filter((it) => {
              const hay = haystacks.get(it.id) ?? "";
              return terms.every((t) => hay.includes(t));
            })
          : s.items,
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, searching, terms, haystacks]);

  const shown = visible.reduce((n, s) => n + s.items.length, 0);

  /* ---- search opens what it finds, and clearing it puts things back ---- */
  useEffect(() => {
    if (searching) {
      if (beforeSearch.current === null) beforeSearch.current = open;
      const next: Record<string, boolean> = {};
      for (const s of visible) for (const it of s.items) next[it.id] = true;
      setOpen(next);
    } else if (beforeSearch.current !== null) {
      setOpen(beforeSearch.current);
      beforeSearch.current = null;
    }
    // The open set is deliberately not a dependency: this runs when the query changes, not on toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, visible]);

  /* ---- a question in the URL hash opens itself ---- */
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id || !haystacks.has(id)) return;
      setOpen((o) => (o[id] ? o : { ...o, [id]: true }));
      // The element exists, but the browser may have scrolled before layout settled.
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [haystacks]);

  /* ---- which section is in view, for the chip row ---- */
  useEffect(() => {
    let raf = 0;
    const line = 132; // just under the sticky chrome
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        let current = visible[0]?.id ?? "";
        for (const s of visible) {
          const el = document.getElementById(s.id);
          if (el && el.getBoundingClientRect().top <= line) current = s.id;
          else break;
        }
        setActive(current);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [visible]);

  // Keep the active chip within the row on narrow screens.
  useEffect(() => {
    const row = chipRow.current;
    const chip = row?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!row || !chip) return;
    const left = chip.offsetLeft - 16;
    const right = chip.offsetLeft + chip.offsetWidth + 16;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      row.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
    }
  }, [active]);

  const go = useCallback((e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
  }, []);

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const s of visible) for (const it of s.items) next[it.id] = value;
    setOpen((o) => ({ ...o, ...next }));
  };

  const clear = () => {
    setQuery("");
    input.current?.focus();
  };

  return (
    <div>
      {/* ---- filter ---- */}
      <div className="relative">
        <label htmlFor="faq-filter" className="sr-only">
          Filter questions
        </label>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-faint"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={input}
          id="faq-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              clear();
            }
          }}
          placeholder="Filter, for example refund, gas, cancel, webhook"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="surface-inset h-12 w-full rounded-full border border-line pr-12 pl-11 text-[15px] text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear filter"
            className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-field hover:text-ink"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-1">
        <p aria-live="polite" className="tnum font-mono text-[11.5px] tracking-[0.06em] text-ink-faint uppercase">
          {searching ? `${shown} of ${total} match` : `${total} questions · ${sections.length} sections`}
        </p>
        <div className="flex items-center gap-3 text-[13px] font-medium">
          <button type="button" onClick={() => setAll(true)} className="inline-flex min-h-10 items-center text-ink-soft transition-colors hover:text-ink">
            Expand all
          </button>
          <span aria-hidden="true" className="text-ink-faint">
            ·
          </span>
          <button type="button" onClick={() => setAll(false)} className="inline-flex min-h-10 items-center text-ink-soft transition-colors hover:text-ink">
            Collapse all
          </button>
        </div>
      </div>

      {/* ---- section chips ---- */}
      {visible.length > 0 && (
        <nav
          aria-label="Sections"
          className="sticky top-[56px] z-30 -mx-5 mt-6 bg-bg/85 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)] backdrop-blur-md sm:-mx-8"
        >
          <div
            ref={chipRow}
            className="flex gap-2 overflow-x-auto px-5 py-2.5 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden"
          >
            {visible.map((s) => {
              const current = s.id === active;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  data-chip={s.id}
                  onClick={(e) => go(e, s.id)}
                  aria-current={current ? "location" : undefined}
                  className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium whitespace-nowrap transition-colors ${
                    current
                      ? "border-ink bg-ink text-bg"
                      : "border-line bg-surface text-ink-soft hover:border-ink-faint hover:text-ink"
                  }`}
                >
                  {s.title}
                  {searching && (
                    <span className={`tnum font-mono text-[11px] ${current ? "text-bg/70" : "text-ink-faint"}`}>
                      {s.items.length}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </nav>
      )}

      {/* ---- sections ---- */}
      {visible.length === 0 ? (
        <div className="surface-inset mt-8 rounded-[24px] p-6 sm:p-8">
          <div className="text-[19px] font-semibold tracking-[-0.01em] text-ink">No matches</div>
          <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
            Nothing here mentions <span className="font-medium text-ink">{query.trim()}</span>. Try a shorter word, or
            ask us directly. We answer, and we add the question here if it belongs.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn-primary h-10 px-4 text-[14px]">
              {CONTACT_EMAIL}
            </a>
            <button type="button" onClick={clear} className="btn-secondary h-10 px-4 text-[14px]">
              Clear filter
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-10 space-y-14 sm:mt-12">
          {visible.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className={SCROLL_MARGIN}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2
                  id={`${s.id}-heading`}
                  className="text-[23px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink sm:text-[26px]"
                >
                  {s.title}
                </h2>
                <span className="tnum font-mono text-[11px] tracking-[0.08em] text-ink-faint uppercase">
                  {s.items.length} {s.items.length === 1 ? "question" : "questions"}
                </span>
              </div>
              {s.lede && <div className="mt-2 max-w-[62ch]">{s.lede}</div>}

              <div className="mt-5 grid gap-3">
                {s.items.map((it, i) => (
                  <details
                    key={it.id}
                    id={it.id}
                    open={!!open[it.id]}
                    onToggle={(e) => {
                      const now = e.currentTarget.open;
                      setOpen((o) => (o[it.id] === now ? o : { ...o, [it.id]: now }));
                    }}
                    className={`surface-interactive group rounded-[24px] border border-line ${SCROLL_MARGIN}`}
                  >
                    <summary className="flex cursor-pointer list-none items-start gap-3 rounded-[24px] px-5 py-4 select-none sm:gap-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                      <span className="tnum mt-[3px] w-6 shrink-0 font-mono text-[12px] text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 text-[16px] leading-snug font-semibold tracking-[-0.01em] text-ink sm:text-[17px]">
                        {it.question}
                      </span>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="mt-[3px] shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-180 group-hover:text-ink"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 sm:pl-16">
                      <div className="border-t border-line/70">{it.answer}</div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <a
                          href={`#${it.id}`}
                          onClick={(e) => go(e, it.id)}
                          className="inline-flex min-h-10 items-center font-mono text-[11px] text-ink-faint transition-colors hover:text-ink [overflow-wrap:anywhere]"
                        >
                          #{it.id}
                        </a>
                        <button
                          type="button"
                          onClick={() => setOpen((o) => ({ ...o, [it.id]: false }))}
                          className="inline-flex min-h-10 items-center px-1 text-[12.5px] font-medium text-ink-faint transition-colors hover:text-ink"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
