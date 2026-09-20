import Link from "next/link";
import type { ReactNode } from "react";
import CopyCode from "@/components/prose/CopyCode";

/**
 * A small Markdown renderer for the prose pages (docs, whitepaper, FAQ, blog).
 *
 * The content is ours and lives in `content/`, so this covers the subset we actually write,
 * headings, paragraphs, lists, tables, code, blockquotes, rules, rather than pulling in a full
 * parser. It produces React elements directly, so nothing is ever passed to
 * `dangerouslySetInnerHTML`: even a mistake in the content cannot become an injected script.
 *
 * On top of the plain constructs:
 * - every h2 to h4 carries a hover-revealed `#` anchor (the id is unchanged),
 * - a blockquote whose first bold run is `Note:`, `Warning:` or `Tip:` becomes a callout,
 * - a fenced block shows its language and a copy button,
 * - a table scrolls sideways inside its card, with a header that stays put.
 */

export type Heading = { id: string; text: string; level: number };

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // Numbered headings ("## 1. Motivation") would produce an id starting with a digit. That is legal
  // HTML but not addressable by a plain CSS selector, so anchors and any styling by id break.
  return /^\d/.test(slug) ? `s-${slug}` : slug;
}

/** Headings in a document, for a table of contents. */
export function headings(markdown: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.*)$/.exec(line);
    if (m) out.push({ level: m[1].length, text: stripInline(m[2]), id: slugify(m[2]) });
  }
  return out;
}

function stripInline(s: string) {
  return s.replace(/\*\*|`|\*/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

// ───────────────────────────── inline ─────────────────────────────

const LINK = "font-medium text-ink underline decoration-line decoration-[1.5px] underline-offset-[3px] transition-colors hover:decoration-ink";

/** `**bold**`, `*italic*`, `` `code` ``, `[text](href)`, applied in that order of precedence. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-md bg-field px-1.5 py-0.5 font-mono text-[0.86em] text-ink ring-1 ring-line/70 [overflow-wrap:anywhere]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      const [, label, href] = linkMatch;
      const external = /^https?:\/\//.test(href);
      nodes.push(
        external ? (
          <a key={key} href={href} target="_blank" rel="noreferrer" className={LINK}>
            {label}
          </a>
        ) : (
          <Link key={key} href={href} className={LINK}>
            {label}
          </Link>
        ),
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ───────────────────────────── blocks ─────────────────────────────

const H = {
  1: "mt-0 text-[34px] leading-[1.1] tracking-[-0.025em] text-ink sm:text-[38px]",
  2: "mt-14 text-[25px] leading-[1.15] tracking-[-0.02em] text-ink",
  3: "mt-10 text-[18px] leading-[1.3] tracking-[-0.01em] text-ink",
  4: "mt-8 text-[13px] uppercase tracking-[0.1em] text-ink-faint",
} as const;

/** Display name for a fence language tag. Anything unknown shows as written. */
const LANG: Record<string, string> = {
  bash: "bash",
  sh: "shell",
  shell: "shell",
  json: "JSON",
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  solidity: "Solidity",
  sol: "Solidity",
  prisma: "Prisma",
  ini: "ini",
  env: "env",
  text: "text",
  txt: "text",
  yaml: "YAML",
  yml: "YAML",
  sql: "SQL",
  http: "HTTP",
};

const CALLOUT: Record<string, { label: string; rule: string; bg: string }> = {
  note: { label: "Note", rule: "border-ink-soft", bg: "bg-surface" },
  tip: { label: "Tip", rule: "border-ink-faint", bg: "bg-surface" },
  warning: { label: "Warning", rule: "border-ink", bg: "bg-field" },
};

/** Render a Markdown document. */
export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const next = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // fenced code
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim().toLowerCase();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++; // closing fence
      const code = body.join("\n");
      out.push(
        <figure key={next()} className="surface-inset mt-6 overflow-hidden rounded-2xl">
          <figcaption className="flex items-center justify-between gap-3 border-b border-line/70 py-1.5 pr-2 pl-5">
            <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">
              {lang ? (LANG[lang] ?? lang) : "code"}
            </span>
            <CopyCode text={code} />
          </figcaption>
          <pre tabIndex={0} className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-relaxed text-ink">
            <code data-lang={lang || undefined}>{code}</code>
          </pre>
        </figure>,
      );
      continue;
    }

    // heading
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3 | 4;
      const id = slugify(heading[2]);
      const Tag = (["h1", "h2", "h3", "h4"] as const)[level - 1];
      out.push(
        <Tag key={next()} id={id} className={`group scroll-mt-28 font-semibold ${H[level]}`}>
          {inline(heading[2], id)}
          {level > 1 && (
            <a
              href={`#${id}`}
              aria-label={`Link to ${stripInline(heading[2])}`}
              className="ml-2 inline-block font-mono text-[0.8em] font-normal text-ink-faint no-underline opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-ink"
            >
              #
            </a>
          )}
        </Tag>,
      );
      i++;
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push(<hr key={next()} className="mt-12 border-line" />);
      i++;
      continue;
    }

    // table
    if (line.trim().startsWith("|") && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      const k = next();
      out.push(
        <div key={k} className="surface mt-6 rounded-2xl border border-line">
          <div className="overflow-x-auto px-5 py-1">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead className="sticky top-0 z-[1] bg-surface">
                <tr className="border-b border-line">
                  {head.map((c, ci) => (
                    <th
                      key={ci}
                      scope="col"
                      className="py-3 pr-4 align-bottom font-mono text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-ink-faint uppercase"
                    >
                      {inline(c, `${k}-h${ci}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-line/60 align-top last:border-0">
                    {row.map((c, ci) => (
                      <td key={ci} className="py-3 pr-4 leading-relaxed text-ink-soft">
                        {inline(c, `${k}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>,
      );
      continue;
    }

    // blockquote: a callout when it opens with **Note:**, **Warning:** or **Tip:**, plain otherwise
    if (line.startsWith("> ") || line === ">") {
      const body: string[] = [];
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) body.push(lines[i++].slice(2));
      const k = next();
      const text = body.join(" ").trim();
      const callout = /^\*\*(Note|Warning|Tip):\*\*\s*/i.exec(text);
      if (callout) {
        const kind = CALLOUT[callout[1].toLowerCase()];
        out.push(
          <aside
            key={k}
            role="note"
            aria-label={kind.label}
            className={`mt-6 rounded-r-2xl border-l-[3px] py-4 pr-5 pl-5 ${kind.rule} ${kind.bg}`}
          >
            <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-ink uppercase">{kind.label}</div>
            <p className="mt-1.5 text-[15.5px] leading-[1.65] text-ink-soft">{inline(text.slice(callout[0].length), k)}</p>
          </aside>,
        );
      } else {
        out.push(
          <blockquote
            key={k}
            className="surface-inset mt-6 rounded-2xl border-l-[3px] border-green px-5 py-4 text-[16px] text-ink-soft italic"
          >
            {inline(text, k)}
          </blockquote>,
        );
      }
      continue;
    }

    // list (unordered or ordered)
    const bullet = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[2]);
      const items: ReactNode[] = [];
      const k = next();
      let n = 0;
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        // continuation lines belong to the item above
        let text = m[3];
        i++;
        while (i < lines.length && lines[i].trim() !== "" && !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) && !lines[i].startsWith("#")) {
          text += ` ${lines[i++].trim()}`;
        }
        items.push(
          <li key={n} className="pl-1.5 marker:font-mono marker:text-[0.9em]">
            {inline(text, `${k}-${n++}`)}
          </li>,
        );
      }
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag
          key={k}
          className={`mt-5 space-y-2 pl-5 text-[16px] leading-[1.65] text-ink-soft ${ordered ? "list-decimal" : "list-disc"} marker:text-ink-faint`}
        >
          {items}
        </Tag>,
      );
      continue;
    }

    // paragraph
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("> ") &&
      lines[i] !== ">" &&
      !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("|")
    ) {
      para.push(lines[i++]);
    }
    const k = next();
    out.push(
      <p key={k} className="mt-5 text-[16.5px] leading-[1.7] text-ink-soft">
        {inline(para.join(" "), k)}
      </p>,
    );
  }

  return <>{out}</>;
}
