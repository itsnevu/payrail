"use client";

import type { ReactNode } from "react";
import QrCode from "@/components/QrCode";
import ShareLinkButton from "@/components/ShareLinkButton";
import CopyLinkButton from "./CopyLinkButton";

/**
 * The payment link as an object: QR for the customer standing in front of you, the URL
 * and copy / share / open for sending it. Used on the invoice page while PENDING and in
 * the "created" state of the new-invoice page.
 */
export default function PaymentLinkCard({
  url,
  merchantName,
  description,
  amountLabel,
  qrSize = 200,
  heading = "Payment link",
  footer,
  children,
}: {
  url: string;
  merchantName: string;
  description: string;
  /** "250.00 USDG" */
  amountLabel: string;
  qrSize?: number;
  heading?: string;
  /** Muted line under the buttons. */
  footer?: ReactNode;
  /** Extra content rendered below the standard row. */
  children?: ReactNode;
}) {
  const shown = url.replace(/^https?:\/\//, "");
  return (
    <section className="card" aria-labelledby="payment-link-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="payment-link-heading" className="text-[15px] font-medium text-ink-soft">
          {heading}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">scan or send</span>
      </div>

      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="surface-inset shrink-0 rounded-[20px] p-3">
          <QrCode value={url} size={qrSize} className="rounded-xl" />
        </div>

        <div className="w-full min-w-0 space-y-3">
          <label className="block">
            <span className="label">Link</span>
            <input
              readOnly
              className="input truncate font-mono text-xs"
              value={shown}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <CopyLinkButton value={url} className="btn-secondary" />
            <ShareLinkButton
              url={url}
              title={`Invoice from ${merchantName}`}
              text={`${description}: ${amountLabel}`}
              className="btn-secondary"
              label="Share"
            />
            <a className="btn-primary col-span-2 text-center" href={url} target="_blank" rel="noreferrer">
              Open pay page
            </a>
          </div>
          {footer && <p className="text-xs leading-relaxed text-ink-faint">{footer}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
