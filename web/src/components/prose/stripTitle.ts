/**
 * Every Markdown document in `content/` opens with `# Title`, the same title its frontmatter
 * carries. Pages that render the title themselves, in a document header, pass the body through
 * this first so the heading is not printed twice.
 *
 * Only a leading H1 is removed: the first non-blank line, and only when it is a level-one
 * heading. Everything after it, including any later `#` lines, is returned untouched.
 */
export function stripLeadingH1(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && /^#\s+\S/.test(lines[i])) {
    return lines.slice(i + 1).join("\n").trim();
  }
  return body;
}
