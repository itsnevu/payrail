import type { ReactNode } from "react";
import { PactMark, Chip } from "./Logo";
import { CardIcon, CheckIcon, ChevronIcon, ClockIcon, GridIcon, PlusIcon, WalletIcon } from "./Icons";

/**
 * iPhone frame as an SVG <symbol>: bezel, side buttons, dynamic island, status bar
 * (9:41 · signal · wifi · battery) and home indicator. Render once per page; every
 * <IPhone> references it with <use>. Geometry is the 433x882 frame.
 */
export function PhoneDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <mask id="iphone-punch" maskUnits="userSpaceOnUse" x="0" y="0" width="433" height="882">
          <rect width="433" height="882" fill="#fff" />
          <rect x="21.25" y="19.25" width="389.5" height="843.5" rx="55.75" ry="55.75" fill="#000" />
        </mask>
        <symbol id="iphone-frame" viewBox="0 0 433 882">
          <g mask="url(#iphone-punch)">
            <rect x="2" y="0" width="428" height="882" rx="73" ry="73" fill="var(--bezel)" />
            <path d="M0 171C0 170.448 0.447715 170 1 170H3V204H1C0.447715 204 0 203.552 0 203V171Z" fill="var(--bezel)" />
            <path d="M1 234C1 233.448 1.44772 233 2 233H3.5V300H2C1.44772 300 1 299.552 1 299V234Z" fill="var(--bezel)" />
            <path d="M1 319C1 318.448 1.44772 318 2 318H3.5V385H2C1.44772 385 1 384.552 1 384V319Z" fill="var(--bezel)" />
            <path d="M430 279H432C432.552 279 433 279.448 433 280V384C433 384.552 432.552 385 432 385H430V279Z" fill="var(--bezel)" />
            <rect x="5" y="3" width="422" height="876" rx="70" ry="70" fill="#000" />
          </g>
          {/* antenna sliver */}
          <path opacity="0.4" d="M174 5H258V5.5C258 6.60457 257.105 7.5 256 7.5H176C174.895 7.5 174 6.60457 174 5.5V5Z" fill="var(--bezel)" />
          {/* dynamic island */}
          <path d="M154 48.5C154 38.2827 162.283 30 172.5 30H259.5C269.717 30 278 38.2827 278 48.5C278 58.7173 269.717 67 259.5 67H172.5C162.283 67 154 58.7173 154 48.5Z" fill="#0a0a0a" />
          <circle cx="259.5" cy="48.5" r="8" fill="#1a1a1a" />
          <circle cx="259.5" cy="48.5" r="3.6" fill="#2b2b2b" />
          {/* status bar */}
          <text x="61" y="55" fontSize="16" fontWeight="500" fill="var(--bezel-ink)" fontFamily="inherit">
            9:41
          </text>
          <g transform="translate(299, 41)" fill="var(--bezel-ink)">
            <rect x="0" y="11" width="3" height="3" rx="0.6" />
            <rect x="4.5" y="9" width="3" height="5" rx="0.6" />
            <rect x="9" y="6.5" width="3" height="7.5" rx="0.6" />
            <rect x="13.5" y="4" width="3" height="10" rx="0.6" />
          </g>
          <g transform="translate(322, 44)" fill="var(--bezel-ink)">
            <path d="M8 0 A10 10 0 0 1 16 4 L14.2 5.5 A7.5 7.5 0 0 0 8 2.4 A7.5 7.5 0 0 0 1.8 5.5 L0 4 A10 10 0 0 1 8 0 Z" />
            <path d="M8 3.5 A7 7 0 0 1 13 5.7 L11.3 7.2 A4.5 4.5 0 0 0 8 6 A4.5 4.5 0 0 0 4.7 7.2 L3 5.7 A7 7 0 0 1 8 3.5 Z" />
            <circle cx="8" cy="9" r="1.6" />
          </g>
          <g transform="translate(345, 41)">
            <rect x="0.5" y="0.5" width="26" height="12" rx="3.2" ry="3.2" stroke="var(--bezel-ink)" strokeOpacity="0.4" strokeWidth="1" fill="none" />
            <rect x="28" y="4.5" width="1.5" height="4" rx="0.5" fill="var(--bezel-ink)" fillOpacity="0.4" />
            <rect x="2" y="2" width="18" height="9" rx="1.6" fill="var(--bezel-ink)" />
          </g>
          {/* home indicator */}
          <rect x="149.5" y="853" width="134" height="5" rx="2.5" fill="var(--bezel-ink)" opacity="0.5" />
        </symbol>
      </defs>
    </svg>
  );
}

export function IPhone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`ip ${className}`}>
      <div className="ip-screen">
        <div className="ip-app">{children}</div>
      </div>
      <svg className="ip-bezel" viewBox="0 0 433 882" aria-hidden="true">
        <use href="#iphone-frame" />
      </svg>
    </div>
  );
}

function AppHead() {
  return (
    <div className="ip-head">
      <span className="ip-lockup">
        <PactMark />
        <span className="ip-wordmark">
          payrail<span className="ip-beta">beta</span>
        </span>
      </span>
      <span className="ip-wallet">
        <span>
          <WalletIcon />
        </span>
        0x7bE3…72Cf
      </span>
    </div>
  );
}

function Dock({ active }: { active: "invoices" | "payments" }) {
  return (
    <nav className="ip-dock" aria-hidden="true">
      <span className="ip-dock-list">
        <span className="ip-dock-item" aria-current={active === "invoices" ? "page" : undefined}>
          <GridIcon />
          {active === "invoices" && "Invoices"}
        </span>
        <span className="ip-dock-item" aria-current={active === "payments" ? "page" : undefined}>
          <CardIcon />
          {active === "payments" && "Payments"}
        </span>
        <span className="ip-dock-item">
          <ClockIcon />
        </span>
      </span>
      <span className="ip-dock-fab">
        <PlusIcon />
      </span>
    </nav>
  );
}

const STATUS_COLORS: Record<string, string> = {
  PAID: "#e6e6e6",
  PENDING: "#6e6e6e",
  CANCELLED: "#2c2c2c",
};

const INVOICES = [
  { id: "INV-0231", who: "Acme Studio", amount: "250.00", status: "PAID", when: "Today", hi: true },
  { id: "INV-0230", who: "Orbit Digital", amount: "1,200.00", status: "PENDING", when: "Yesterday" },
  { id: "INV-0229", who: "Alex, logo design", amount: "85.00", status: "PAID", when: "Mon" },
];

/** Merchant dashboard screen: total received, invoice list, latest verification activity. */
export function DashboardPhone() {
  const received = INVOICES.filter((i) => i.status === "PAID").reduce(
    (acc, i) => acc + Number(i.amount.replace(/,/g, "")),
    0,
  );

  return (
    <IPhone>
      <AppHead />
      <div className="ip-body">
        <div>
          <p className="ip-label">Received this month</p>
          <p className="ip-total">
            {received.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <small style={{ fontSize: "0.45em" }}>USDC</small>
          </p>
          <p className="ip-sub">{INVOICES.length} invoices · 1 awaiting payment</p>
        </div>

        <div className="ip-card">
          {INVOICES.map((inv) => (
            <div key={inv.id} className={`ip-row${inv.hi ? " ip-row-hi" : ""}`}>
              <span className="ip-tile">
                <Chip color={STATUS_COLORS[inv.status]} />
              </span>
              <span className="ip-row-main">
                <span className="ip-row-name">{inv.who}</span>
                <span className="ip-row-sub">
                  {inv.id} · {inv.status === "PAID" ? "Paid" : "Pending"}
                </span>
              </span>
              <span className="ip-row-amount">
                <span className="ip-row-big">{inv.amount}</span>
                <span className="ip-row-money">{inv.when}</span>
              </span>
              <ChevronIcon className="ip-chevron" />
            </div>
          ))}
        </div>

        <div className="ip-card">
          <p className="ip-card-head">Activity</p>
          <div className="ip-row ip-row-sm">
            <span className="ip-tile">
              <Chip color={STATUS_COLORS.PAID} />
            </span>
            <span className="ip-row-main">
              <span className="ip-row-name">INV-0231 verified</span>
              <span className="ip-row-sub">PaymentReceived · block 18,204,311</span>
            </span>
            <span className="ip-row-amount">
              <span className="ip-row-count">
                <span className="ip-mark" />
                +250.00
              </span>
              <span className="ip-row-money">Just now</span>
            </span>
          </div>
        </div>
      </div>
      <Dock active="invoices" />
    </IPhone>
  );
}

const STEPS: [string, string, boolean][] = [
  ["Approve USDC", "allowance 250.00", true],
  ["pay(invoiceId)", "USDC to merchant", true],
  ["Verify onchain", "receipt + event match", true],
  ["Status PAID", "history updated", false],
];

/** Buyer screen: one invoice, one button, visible steps. */
export function PayPhone() {
  return (
    <IPhone>
      <AppHead />
      <div className="ip-body">
        <div>
          <p className="ip-back">‹ Invoices</p>
          <p className="ip-title">Pay INV-0231</p>
        </div>

        <div className="ip-card">
          <div className="ip-row">
            <span className="ip-row-main">
              <span className="ip-row-sub">Acme Studio is billing</span>
              <span className="ip-row-big ip-row-big-left">
                250.00 <small>USDC</small>
              </span>
            </span>
            <span className="ip-chip">Arc</span>
          </div>
        </div>

        <div className="ip-card">
          <p className="ip-card-head">Payment progress</p>
          <div className="ip-comp" style={{ gridTemplateColumns: "1fr" }}>
            {STEPS.map(([t, sub, done], i) => (
              <div key={t}>
                <span className="ip-comp-row">
                  <span>
                    {i + 1}. {t}
                  </span>
                  <span>{sub}</span>
                </span>
                <span className="ip-bar">
                  <span style={{ width: done ? "100%" : "35%" }} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="ip-card">
          <div className="ip-row">
            <span className="ip-tile ip-tile-ink">
              <CheckIcon className="ip-check" />
            </span>
            <span className="ip-row-main">
              <span className="ip-row-name">Matched to INV-0231</span>
              <span className="ip-row-sub">tx 0x3a9f…c41e · 2 confirmations</span>
            </span>
            <span className="ip-row-amount">
              <span className="ip-row-count">
                <span className="ip-mark" />
                PAID
              </span>
              <span className="ip-row-money">Just now</span>
            </span>
          </div>
        </div>
      </div>
      <Dock active="payments" />
    </IPhone>
  );
}
