"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders `value` as an inline SVG QR code. Dark modules on a white tile so phone
 * cameras lock on quickly against the app's dark surfaces.
 */
export default function QrCode({
  value,
  size = 200,
  className = "",
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then((s) => {
        if (!cancelled) setSvg(s);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!svg) {
    return <div style={{ width: size, height: size }} className={`rounded-xl bg-field ${className}`} aria-hidden="true" />;
  }

  return (
    <div
      role="img"
      aria-label="QR code for the payment link"
      style={{ width: size, height: size }}
      className={`overflow-hidden rounded-xl bg-white [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
