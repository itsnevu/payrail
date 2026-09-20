"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon } from "@/components/Icons";
import { txUrl } from "@/lib/chains";
import { explorerName } from "@/components/app/format";

/**
 * A transaction hash the buyer can keep: the full hash in mono (wrapping, never clipped),
 * a real Copy button, and a link to the chain explorer when the chain has one.
 */
export default function HashLink({
  chainId,
  hash,
  label = "Transaction",
}: {
  chainId: number;
  hash: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = txUrl(chainId, hash);

  async function copy() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <div className="space-y-2">
      <div className="text-[12px] text-ink-faint">{label}</div>
      <code className="block break-all font-mono text-[12px] leading-relaxed text-ink">{hash}</code>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} aria-live="polite" className="btn-secondary !px-3.5 !text-[12.5px]">
          {copied ? <CheckIcon className="h-3.5 w-3.5" /> : null}
          {copied ? "Copied" : "Copy hash"}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3.5 !text-[12.5px]">
            <LinkIcon className="h-3.5 w-3.5" />
            View on {explorerName(url, "explorer")}
          </a>
        )}
      </div>
    </div>
  );
}
