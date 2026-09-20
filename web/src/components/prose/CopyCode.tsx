"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The copy button on a fenced code block. Receives the code as a plain string from the server
 * renderer, so no DOM reading is needed and the button is correct even before hydration
 * finishes (it simply does nothing until then, which is the honest state).
 */
export default function CopyCode({ text, className = "" }: { text: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1600);
  }

  const label = state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : "Copy";

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={`relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] font-medium tracking-[0.02em] text-ink-soft ring-1 ring-line transition-colors hover:bg-bg hover:text-ink after:absolute after:-inset-2 after:content-[''] ${className}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state === "copied" ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="3" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
      {label}
    </button>
  );
}
