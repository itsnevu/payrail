import fs from "node:fs";
import path from "node:path";

/**
 * Filesystem-backed content for the prose pages. Everything lives in `content/` as Markdown with a
 * small YAML-ish frontmatter block, so writing a post or a docs page is adding a file: no route,
 * no component, no build step.
 */

export type Doc = {
  slug: string;
  title: string;
  description: string;
  /** ISO date, blog only. */
  date?: string;
  /** Sort order within a section, docs only. */
  order: number;
  /** Group label in the docs sidebar and index, docs only (`section:` in frontmatter). */
  section?: string;
  /** Estimated reading time in minutes. */
  minutes: number;
  body: string;
};

const ROOT = path.join(process.cwd(), "content");

/** Parse `key: value` frontmatter delimited by `---` lines. Values are plain strings. */
function parse(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) return { meta: {}, body: raw.trim() };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw.trim() };

  const meta: Record<string, string> = {};
  for (const line of raw.slice(4, end).split("\n")) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    meta[line.slice(0, at).trim()] = line
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return { meta, body: raw.slice(end + 4).trim() };
}

function readDoc(dir: string, file: string): Doc {
  const raw = fs.readFileSync(path.join(ROOT, dir, file), "utf8");
  const { meta, body } = parse(raw);
  const words = body.split(/\s+/).length;
  return {
    slug: file.replace(/\.md$/, ""),
    title: meta.title ?? file,
    description: meta.description ?? "",
    date: meta.date,
    order: Number(meta.order ?? 999),
    section: meta.section || undefined,
    minutes: Math.max(1, Math.round(words / 220)),
    body,
  };
}

function list(dir: string): Doc[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".md"))
    .map((f) => readDoc(dir, f));
}

/** Docs pages, in reading order. */
export function docsPages(): Doc[] {
  return list("docs").sort((a, b) => a.order - b.order);
}

/** A section is the first-seen `section:` label of a page, or "Docs" for pages that set none. */
const UNSECTIONED = "Docs";

/**
 * Docs pages grouped by section. Sections appear in the order their first page has after sorting
 * by `order`, and the pages inside each keep that same order, so the sidebar reads top to bottom
 * exactly like the flat list does.
 */
export function docsSections(): Array<{ section: string; pages: Doc[] }> {
  const out: Array<{ section: string; pages: Doc[] }> = [];
  for (const page of docsPages()) {
    const label = page.section ?? UNSECTIONED;
    let group = out.find((g) => g.section === label);
    if (!group) {
      group = { section: label, pages: [] };
      out.push(group);
    }
    group.pages.push(page);
  }
  return out;
}

/** Blog posts, newest first. */
export function blogPosts(): Doc[] {
  return list("blog").sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function docsPage(slug: string): Doc | undefined {
  return docsPages().find((d) => d.slug === slug);
}

export function blogPost(slug: string): Doc | undefined {
  return blogPosts().find((d) => d.slug === slug);
}

/** A single top-level document (`content/<file>.md`) rather than a page inside a section. */
function single(file: string, slug: string, fallbackTitle: string): Doc {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const { meta, body } = parse(raw);
  return {
    slug,
    title: meta.title ?? fallbackTitle,
    description: meta.description ?? "",
    date: meta.date,
    order: 0,
    minutes: Math.max(1, Math.round(body.split(/\s+/).length / 220)),
    body,
  };
}

/** The whitepaper is a single document rather than a section. */
export function whitepaper(): Doc {
  return single("whitepaper.md", "whitepaper", "Whitepaper");
}

/** The FAQ is a single document too, parsed exactly like the whitepaper. */
export function faq(): Doc {
  return single("faq.md", "faq", "FAQ");
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
