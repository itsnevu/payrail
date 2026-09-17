"use client";

import { useState } from "react";

/** Inline text that copies itself on tap. Shows a brief "copied" state, no layout shift. */
export default function CopyText({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className={`group inline text-left hover:text-ink ${className}`}
    >
      {value}
      <span className={`ml-2 text-[11px] font-sans ${copied ? "text-ink" : "text-ink-faint opacity-0 group-hover:opacity-100"}`}>
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}
