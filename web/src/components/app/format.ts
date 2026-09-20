/**
 * Helpers every app page shares. Pure, no React. The per-page `format.ts` files re-export
 * from here so a label is spelled one way across the dashboard, the invoice pages and /pay.
 */

/** Short human label: the last 4 chars of the cuid, upper-cased ("INV-K3P9"). */
export function invNo(id: string) {
  return `INV-${id.slice(-4).toUpperCase()}`;
}

/** "Blockscout" when the explorer is one, otherwise the generic word. Never guesses a brand. */
export function explorerName(url: string, generic = "the explorer") {
  return /blockscout/i.test(url) ? "Blockscout" : generic;
}
