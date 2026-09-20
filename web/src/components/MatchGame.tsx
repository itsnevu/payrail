"use client";

import { useState } from "react";
import { CheckIcon } from "./Icons";

/**
 * The problem, playable. One invoice on the left, a wallet history on the right; the visitor
 * clicks the transfer they think paid it. Two rows carry the same amount on purpose, so the
 * honest answer is "could be either". Then the "Let Payrail match it" button does what the
 * backend does: reads the invoice ID out of the event instead of guessing from the amount.
 */
const INVOICE = { id: "INV-0231", who: "Acme Studio", amount: "250.00", key: "0x7f3a…c21e" };

const TRANSFERS = [
  { id: "t1", from: "0x91b2…4e07", amount: "250.00", when: "2m ago", key: "0x7f3a…c21e" },
  { id: "t2", from: "0x5c0d…a913", amount: "1,180.00", when: "18m ago", key: "0x2b61…9d40" },
  { id: "t3", from: "0xe4a7…10fb", amount: "250.00", when: "41m ago", key: "0xa0c8…5e77" },
  { id: "t4", from: "0x3f19…c2d5", amount: "85.00", when: "2h ago", key: "0x6d1e…03ba" },
];

type Phase = "guess" | "guessed" | "matched";

export default function MatchGame() {
  const [phase, setPhase] = useState<Phase>("guess");
  const [pick, setPick] = useState<string | null>(null);

  const guess = (id: string) => {
    if (phase === "matched") return;
    setPick(id);
    setPhase("guessed");
  };
  const match = () => setPhase("matched");
  const reset = () => {
    setPick(null);
    setPhase("guess");
  };

  const picked = TRANSFERS.find((t) => t.id === pick);
  const pickedRight = picked?.key === INVOICE.key;
  const ambiguous = picked?.amount === INVOICE.amount;

  return (
    <div className={`lp-match lp-match-${phase}`}>
      {/* the invoice */}
      <div className="lp-match-invoice">
        <span className="lp-match-tag">Your invoice</span>
        <span className="lp-match-who">{INVOICE.who}</span>
        <span className="lp-match-amt">
          {INVOICE.amount} <small>USDG</small>
        </span>
        <span className="lp-match-meta">
          {INVOICE.id} · onchain ID <code>{INVOICE.key}</code>
        </span>
        <span className={`lp-match-status${phase === "matched" ? " is-paid" : ""}`}>
          {phase === "matched" ? (
            <>
              <CheckIcon className="h-3.5 w-3.5" /> PAID
            </>
          ) : (
            "PENDING"
          )}
        </span>
      </div>

      {/* the wallet */}
      <div className="lp-match-wallet">
        <span className="lp-match-tag">
          {phase === "matched" ? "Wallet history · matched by ID" : "Wallet history · which one paid it?"}
        </span>
        <ul className="lp-match-list">
          {TRANSFERS.map((t) => {
            const isPick = t.id === pick;
            const isHit = t.key === INVOICE.key;
            const cls = [
              "lp-match-row",
              phase === "matched" ? (isHit ? "is-hit" : "is-dim") : "",
              phase === "guessed" && isPick ? "is-pick" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={t.id}>
                <button type="button" className={cls} onClick={() => guess(t.id)} disabled={phase === "matched"}>
                  <span className="lp-match-from">
                    <b>+{t.amount} USDG</b>
                    <span>from {t.from}</span>
                  </span>
                  <span className="lp-match-when">{t.when}</span>
                  <span className="lp-match-key">
                    <code>{t.key}</code>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="lp-match-foot" aria-live="polite">
          {phase === "guess" && <p className="lp-muted">Tap the transfer you think is Acme&apos;s.</p>}
          {phase === "guessed" && (
            <p>
              {ambiguous ? (
                <>
                  Could be. <span className="lp-muted">There are two 250.00s, and neither says which invoice it pays.</span>
                </>
              ) : (
                <>
                  Wrong amount. <span className="lp-muted">Now imagine forty of these a month.</span>
                </>
              )}
            </p>
          )}
          {phase === "matched" && (
            <p>
              {pickedRight ? "You guessed right this time. " : ""}
              <span className="lp-muted">
                Payrail didn&apos;t guess: the event carries <code>{INVOICE.key}</code>, and only one transfer has it.
              </span>
            </p>
          )}
          <div className="lp-match-actions">
            {phase !== "matched" ? (
              <button type="button" className="lp-pill lp-pill-sm lp-pill-ink" onClick={match}>
                Let Payrail match it
              </button>
            ) : (
              <button type="button" className="lp-pill lp-pill-sm lp-pill-surface" onClick={reset}>
                Play again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
