import { isValidElement, type ReactNode } from "react";

/**
 * Count the words in a React tree before it renders. The legal pages are written as JSX rather
 * than Markdown, so the "N min read" figure in their header is derived from the same tree that is
 * rendered, with the same 220 words per minute the docs use (see lib/content.ts).
 */
export function wordCount(node: ReactNode): number {
  if (node == null || typeof node === "boolean") return 0;
  if (typeof node === "string") return node.split(/\s+/).filter(Boolean).length;
  if (typeof node === "number") return 1;
  if (Array.isArray(node)) return node.reduce<number>((sum, child) => sum + wordCount(child), 0);
  if (isValidElement<{ children?: ReactNode; rows?: unknown }>(node)) {
    // Data-driven blocks (the privacy table) carry their text in `rows`, not `children`.
    return wordCount(node.props.children) + wordCount(rowsText(node.props.rows));
  }
  return 0;
}

function rowsText(rows: unknown): ReactNode {
  if (!Array.isArray(rows)) return null;
  return rows.map((row) =>
    row && typeof row === "object" ? (Object.values(row as Record<string, unknown>) as ReactNode[]) : null
  );
}

export function readingMinutes(node: ReactNode): number {
  return Math.max(1, Math.round(wordCount(node) / 220));
}
