"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PayPhone, PAY_STEPS } from "./Phone";
import { ArrowIcon } from "./Icons";

/**
 * The pay walkthrough, running. The phone plays the four steps once when it scrolls into view,
 * the copy on the right lights up in step with it, and the button on the phone replays it.
 * Timings are theatrical, not measured: the point is the order, and that PAID is the last thing
 * to happen, after the chain has spoken.
 */
const BEATS = [900, 1100, 1300, 700];

const NOTES = [
  ["Approve USDC", "The wallet grants the contract an allowance for exactly this amount."],
  ["pay(invoiceId)", "One call. USDC goes straight to the merchant; the contract keeps nothing."],
  ["Verify onchain", "The backend reads the receipt and the PaymentReceived event, never the browser's claim."],
  ["Marked PAID", "ID, merchant and amount match. The invoice closes itself."],
] as const;

export default function PayDemo() {
  const [step, setStep] = useState(0); // 0 = idle, 1..4 = running/finished
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const played = useRef(false);

  const play = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(true);
    setStep(0);
    let at = 300;
    PAY_STEPS.forEach((_, i) => {
      at += BEATS[i];
      timers.current.push(window.setTimeout(() => setStep(i + 1), at));
    });
    timers.current.push(window.setTimeout(() => setPlaying(false), at + 200));
  };

  // autoplay once, when the phone is mostly on screen
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(PAY_STEPS.length);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !played.current) {
          played.current = true;
          play();
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="lp-col lp-col-left order-1">
        <h2 className="lp-head">
          Send the link.
          <br />
          <span className="lp-muted">Receive USDC. Marked paid.</span>
        </h2>
      </div>
      <div className="lp-portal order-2" ref={rootRef}>
        <PayPhone step={step} playing={playing} onPay={play} />
      </div>
      <div className="lp-col lp-col-right order-3 flex flex-col items-start gap-6">
        <ol className="lp-beats" aria-label="Payment steps">
          {NOTES.map(([t, sub], i) => {
            const n = i + 1;
            const state = step >= n ? "is-done" : step === n - 1 && playing ? "is-live" : "";
            return (
              <li key={t} className={`lp-beat ${state}`}>
                <span className="lp-beat-num">{n}</span>
                <span className="lp-beat-text">
                  <b>{t}</b>
                  <span>{sub}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/docs/payment-flow" className="lp-pill lp-pill-surface">
            See how it works <ArrowIcon />
          </Link>
          <button type="button" className="lp-link-button" onClick={play} disabled={playing}>
            {playing ? "Running…" : "Replay"}
          </button>
        </div>
      </div>
    </>
  );
}
