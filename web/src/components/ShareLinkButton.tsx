"use client";

import { useEffect, useState } from "react";

/**
 * One button for handing a link to someone else.
 * On phones with the Web Share API it opens the native share sheet (WhatsApp, Telegram, …);
 * everywhere else it copies to the clipboard.
 */
export default function ShareLinkButton({
  url,
  title,
  text,
  className = "btn-secondary",
  label,
}: {
  url: string;
  title: string;
  text?: string;
  className?: string;
  /** Override the idle label ("Share"/"Copy"); the copied state still says "✓ Copied". */
  label?: string;
}) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function onClick() {
    if (canShare) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        // The user closed the sheet: nothing to do. Anything else falls through to copy.
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {copied ? "✓ Copied" : label ?? (canShare ? "Share" : "Copy")}
    </button>
  );
}
