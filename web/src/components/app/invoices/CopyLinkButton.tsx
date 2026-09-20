"use client";

import { useState } from "react";

/**
 * A plain copy-to-clipboard button. ShareLinkButton opens the share sheet on phones,
 * so this one exists for the case where the merchant wants the raw link in the clipboard
 * on every device.
 */
export default function CopyLinkButton({
  value,
  className = "btn-secondary",
  label = "Copy link",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context, permissions): the input next to it is selectable.
    }
  }

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {copied ? "✓ Copied" : label}
    </button>
  );
}
