"use client";

import { useState } from "react";
import { shortAddr } from "@/lib/usdc";

/** The connected wallet, shortened, in a mono pill that copies the full address on tap. */
export default function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={address}
      aria-label={`Copy wallet address ${address}`}
      className="tnum relative inline-flex min-h-[34px] items-center gap-2 rounded-full border border-line bg-surface px-3 font-mono text-[12.5px] text-ink transition-colors hover:border-ink after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']"
    >
      {shortAddr(address)}
      <span className="font-sans text-[11px] text-ink-faint" aria-live="polite">
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}
