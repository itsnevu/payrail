import { CheckIcon, LinkIcon, WalletIcon } from "./Icons";

/**
 * The three illustrations in the "Three steps" section: a tiny invoice card, a payment
 * link, and a paid receipt. Same fake invoice as the phone mockup (Alex, logo design,
 * 85.00 USDG) so the page tells one story. Pure markup and CSS; see .lp-step-* in globals.css.
 */
export type StepKind = "invoice" | "link" | "paid";

export default function StepArt({ kind }: { kind: StepKind }) {
  if (kind === "invoice") {
    return (
      <div className="lp-step lp-step-invoice" aria-hidden="true">
        <div className="lp-step-card">
          <div className="lp-step-field">
            <span className="lp-step-label">Description</span>
            <span className="lp-step-value">Logo design, Alex</span>
          </div>
          <div className="lp-step-field">
            <span className="lp-step-label">Amount</span>
            <span className="lp-step-value lp-step-amount">
              85.00 <span className="lp-step-unit">USDG</span>
            </span>
          </div>
          <div className="lp-step-id">
            <span className="lp-step-label">Onchain ID</span>
            <span className="lp-step-hash">0x7f3a…c21e</span>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "link") {
    return (
      <div className="lp-step lp-step-link" aria-hidden="true">
        <div className="lp-step-url">
          <LinkIcon className="lp-step-url-icon" />
          <span>
            payrail.app<span className="lp-step-url-path">/pay/inv_0231</span>
          </span>
        </div>
        <div className="lp-step-flow">
          <span className="lp-step-dot" />
          <span className="lp-step-dot" />
          <span className="lp-step-dot" />
        </div>
        <div className="lp-step-wallets">
          {["MetaMask", "Rabby", "Any wallet"].map((w) => (
            <span key={w} className="lp-step-wallet">
              <WalletIcon className="lp-step-wallet-icon" />
              {w}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lp-step lp-step-paid" aria-hidden="true">
      <div className="lp-step-card lp-step-receipt">
        <div className="lp-step-receipt-head">
          <span className="lp-step-check">
            <CheckIcon className="lp-step-check-icon" />
          </span>
          <span className="lp-step-badge">PAID</span>
        </div>
        <div className="lp-step-receipt-row">
          <span>Logo design, Alex</span>
          <span className="lp-step-mono">85.00</span>
        </div>
        <div className="lp-step-receipt-row lp-step-receipt-sub">
          <span>Matched onchain</span>
          <span className="lp-step-mono">block 21 004 118</span>
        </div>
        <div className="lp-step-receipt-row lp-step-receipt-sub">
          <span>tx</span>
          <span className="lp-step-mono">0x91b4…e07d</span>
        </div>
      </div>
    </div>
  );
}
