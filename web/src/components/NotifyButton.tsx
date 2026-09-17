"use client";

import { useEffect, useState } from "react";

type State = "unsupported" | "loading" | "off" | "on" | "denied";

function base64ToUint8Array(b64: string) {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * "Notify me when paid" toggle for a merchant. Renders nothing when the browser has no
 * push support or the server has no VAPID keys, so it never shows a dead button.
 */
export default function NotifyButton({ merchantId, className = "" }: { merchantId: string; className?: string }) {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState("unsupported");
      }
      const cfg = await fetch("/api/push/subscribe").then((r) => r.json()).catch(() => null);
      if (cancelled) return;
      if (!cfg?.enabled || !cfg.publicKey) return setState("unsupported");
      setPublicKey(cfg.publicKey);
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!cancelled) setState(sub ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(publicKey),
      });
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, subscription: sub.toJSON() }),
      });
      setState(r.ok ? "on" : "off");
    } catch (e) {
      console.warn("[push] subscribe failed", e);
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }

  if (state === "unsupported") return null;

  const label =
    state === "loading" ? "…" : state === "on" ? "Notifications on" : state === "denied" ? "Notifications blocked" : "Notify me when paid";

  return (
    <button
      type="button"
      onClick={state === "on" ? disable : enable}
      disabled={state === "loading" || state === "denied"}
      title={state === "denied" ? "Allow notifications for this site in your browser settings" : undefined}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
        state === "on" ? "border-ink bg-ink text-bg" : "border-line text-ink-soft hover:border-ink hover:text-ink"
      } disabled:opacity-60 ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${state === "on" ? "bg-bg" : "bg-ink-faint"}`} />
      {label}
    </button>
  );
}
