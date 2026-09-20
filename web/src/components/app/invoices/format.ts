/** Small formatting helpers shared by the invoice pages. Pure, no React. */

export { invNo } from "../format";

/** "17 Sep 2026, 14:03" */
export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "17 Sep 2026" */
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "18,204,311" from a decimal string, or the input untouched when it is not a number. */
export function fmtBlock(n: string | number | undefined | null) {
  if (n == null || n === "") return "";
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("en-US") : String(n);
}

/** Six decimals, always, the way the token counts. "250" -> "250.000000". */
export function fmtSixDecimals(amount: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0.000000";
  return n.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}
