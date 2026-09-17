"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker in production and shows a small "update ready" bar when
 * a new version has been installed behind the current page. Skipped in development so
 * the SW never serves stale bundles while the dev server is hot-reloading.
 */
export default function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
      } catch (err) {
        console.warn("[pwa] service worker registration failed", err);
      }
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-full border border-line bg-surface px-4 py-2.5 text-sm shadow-lg sm:bottom-6"
    >
      <span className="text-ink-soft">A new version of Payrail is ready.</span>
      <button
        type="button"
        className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-bg"
        onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
      >
        Reload
      </button>
    </div>
  );
}
