import { slugify } from "@/lib/markdown";

/**
 * Splits `content/faq.md` into sections and question/answer pairs.
 *
 * The body is a run of `## Section` headings, each followed by `### Question` headings whose
 * Markdown continues until the next heading. Lines inside a fenced code block are never treated
 * as headings. Everything before the first `##` is the intro (the h1, a lede paragraph and the
 * USDC/USDG note); a horizontal rule after the last answer starts the outro.
 */

export type FaqItem = {
  /** Anchor id, unique across the whole document. */
  id: string;
  /** Question with inline Markdown removed. */
  question: string;
  /** Answer, as Markdown. */
  answer: string;
};

export type FaqSection = {
  id: string;
  title: string;
  /** Markdown between the section heading and its first question, usually empty. */
  lede: string;
  items: FaqItem[];
};

export type ParsedFaq = {
  /** First plain paragraph of the intro, with inline Markdown removed. */
  lede: string;
  /** The rest of the intro as Markdown, without the h1 and the lede. */
  intro: string;
  sections: FaqSection[];
  /** Markdown after the closing horizontal rule. */
  outro: string;
};

/** Remove inline Markdown: links keep their label, emphasis and code keep their text. */
export function inlinePlain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * Flatten a Markdown fragment to one line of plain text, for the search index and the
 * structured data. Table rows become "cell: cell." so the facts in reference tables stay
 * searchable; code blocks keep their text; everything else drops its markers.
 */
export function plainText(md: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
    if (raw.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(raw.trim());
      continue;
    }
    let line = raw.trim();
    if (line === "") continue;
    if (/^\|[\s:|-]+\|$/.test(line)) continue; // table separator row
    if (/^(-{3,}|\*{3,})$/.test(line)) continue; // horizontal rule
    if (line.startsWith("|")) {
      const cells = line
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      line = `${cells.join(": ")}.`;
    }
    line = line
      .replace(/^>\s?/, "")
      .replace(/^#{1,6}\s+/, "")
      .replace(/^([-*]|\d+\.)\s+/, "");
    out.push(inlinePlain(line));
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export function parseFaq(body: string): ParsedFaq {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const sections: FaqSection[] = [];
  const introLines: string[] = [];
  const outroLines: string[] = [];
  const used = new Set<string>();

  const unique = (text: string) => {
    const base = slugify(text) || "q";
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
  };

  // Where the current non-heading line goes: the intro, a section lede, an answer or the outro.
  let sink: string[] = introLines;
  type RawItem = { id: string; question: string; answer: string[] };
  type RawSection = { id: string; title: string; lede: string[]; items: RawItem[] };
  let section: RawSection | null = null;
  const raw: RawSection[] = [];
  let inFence = false;
  let inOutro = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      sink.push(line);
      continue;
    }
    if (inFence || inOutro) {
      sink.push(line);
      continue;
    }

    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      const title = inlinePlain(h2[1]).trim();
      section = { id: unique(title), title, lede: [], items: [] };
      raw.push(section);
      sink = section.lede;
      continue;
    }

    const h3 = /^###\s+(.*)$/.exec(line);
    if (h3 && section) {
      const question = inlinePlain(h3[1]).trim();
      const item: RawItem = { id: unique(question), question, answer: [] };
      section.items.push(item);
      sink = item.answer;
      continue;
    }

    if (section && /^(-{3,}|\*{3,})$/.test(line.trim())) {
      inOutro = true;
      sink = outroLines;
      continue;
    }

    sink.push(line);
  }

  for (const s of raw) {
    sections.push({
      id: s.id,
      title: s.title,
      lede: s.lede.join("\n").trim(),
      items: s.items.map((it) => ({ id: it.id, question: it.question, answer: it.answer.join("\n").trim() })),
    });
  }

  // Intro: drop the h1, lift the first plain paragraph out as the lede, keep the rest as Markdown.
  const blocks = introLines
    .join("\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b !== "" && !/^#\s/.test(b));
  const ledeAt = blocks.findIndex((b) => !/^[>#|`\-*]/.test(b));
  const lede = ledeAt === -1 ? "" : inlinePlain(blocks[ledeAt].replace(/\n/g, " "));
  const intro = blocks.filter((_, i) => i !== ledeAt).join("\n\n");

  return { lede, intro, sections, outro: outroLines.join("\n").trim() };
}
