"use client";

import { useEffect, useState } from "react";

/**
 * iOS Safari has no `beforeinstallprompt`, so the only way to install is
 * Share → "Add to Home Screen". Show a one-line hint there (and only there),
 * dismissible, remembered per device.
 */
export default function AddToHomeHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true;
      const dismissed = localStorage.getItem("payrail-a2hs-dismissed") === "1";
      setShow(isIOS && !standalone && !dismissed);
    } catch {
      setShow(false);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink-soft">
      <span className="flex-1">
        Add Payrail to your home screen: tap <span className="text-ink">Share</span> then{" "}
        <span className="text-ink">Add to Home Screen</span>.
      </span>
      <button
        type="button"
        className="text-ink-faint hover:text-ink"
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem("payrail-a2hs-dismissed", "1");
          } catch {}
          setShow(false);
        }}
      >
        ×
      </button>
    </div>
  );
}
