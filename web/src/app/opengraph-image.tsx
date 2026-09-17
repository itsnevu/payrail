import { ImageResponse } from "next/og";
export const runtime = "edge";

export const alt = "Payrail: know exactly which invoice got paid";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card that renders when a Payrail link is shared.
 *
 * Drawn from the brand geometry (invoice, check, flow) with no webfont fetch:
 * a network call here would make every build depend on Google Fonts, and the shapes
 * carry the identity more than the typeface does.
 */
export default function OpengraphImage() {
  const ink = "#f2f2f2";
  const green = "#e6e6e6";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(160deg, #1c1c1c 0%, #050505 100%)",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="88" height="88" viewBox="0 0 44 44" fill="none">
            <path d="M3 22H11" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
            <rect x="12" y="8" width="20" height="28" rx="5" fill="#1e1e1e" stroke={ink} strokeWidth="2.6" />
            <path d="M17 16H27M17 21H24" stroke={ink} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
            <path d="M17.5 28.5 L21 32 L28 25" stroke={green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M33 22H41" stroke="#bdbdbd" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-0.02em", color: ink }}>payrail</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 88, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.02, color: ink }}>
            Send the link.
          </span>
          <span
            style={{ fontSize: 88, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.02, color: "#7a7a7a" }}
          >
            Marked paid.
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", height: 6, width: "100%" }}>
            <div style={{ flex: 3, background: green }} />
            <div style={{ flex: 2, background: "#8a8a8a" }} />
            <div style={{ flex: 1, background: ink }} />
          </div>
          <span style={{ fontSize: 27, color: "#a8a8a8", letterSpacing: "-0.01em" }}>
            USDC invoices matched from onchain events. Funds go straight to the merchant and are never held.
          </span>
        </div>
      </div>
    ),
    size,
  );
}
