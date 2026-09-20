import Link from "next/link";
import { notFound } from "next/navigation";
import { ProseShell, Toc } from "@/components/prose/ProseShell";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import DocsJump from "@/components/docs/DocsJump";
import { stripLeadingH1 } from "@/components/prose/stripTitle";
import { Markdown, headings } from "@/lib/markdown";
import { docsPage, docsPages, docsSections } from "@/lib/content";
import { CONTACT_EMAIL } from "@/lib/links";

type Params = { params: { slug: string } };

export function generateStaticParams() {
  return docsPages().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: Params) {
  const page = docsPage(params.slug);
  if (!page) return { title: "Not found: Payrail" };
  return { title: `${page.title}: Payrail Docs`, description: page.description };
}

export default function DocsPage({ params }: Params) {
  const { slug } = params;
  const page = docsPage(slug);
  if (!page) notFound();

  const pages = docsPages();
  const sections = docsSections();
  const index = pages.findIndex((p) => p.slug === slug);
  const prev = pages[index - 1];
  const next = pages[index + 1];
  const section = page.section ?? "Docs";
  const toc = headings(page.body);
  // The page header renders the title itself, so the body's leading `# Title` line is dropped.
  const body = stripLeadingH1(page.body);

  const jumpOptions = sections.flatMap((g) => g.pages.map((p) => ({ slug: p.slug, title: p.title, section: g.section })));

  return (
    <ProseShell active="/docs">
      <div className="mx-auto grid w-full max-w-[1180px] gap-x-12 gap-y-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[220px_minmax(0,1fr)_200px]">
        {/* left: pages by section (lg and up) */}
        <div className="hidden lg:row-span-2 lg:block">
          <DocsSidebar sections={sections} current={slug} />
        </div>

        {/* article header: first on every screen size */}
        <header className="order-first min-w-0 lg:order-none lg:col-start-2">
          <DocsJump options={jumpOptions} current={slug} />

          <nav aria-label="Breadcrumb" className="mt-6 lg:mt-0">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11.5px] tracking-[0.04em] text-ink-faint">
              <li>
                <Link href="/docs" className="transition-colors hover:text-ink">
                  Docs
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>{section}</li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-ink-soft">
                {page.title}
              </li>
            </ol>
          </nav>

          <h1 className="mt-4 text-[34px] leading-[1.1] font-semibold tracking-[-0.025em] text-ink sm:text-[40px]">
            {page.title}
          </h1>
          {page.description && (
            <p className="mt-4 max-w-[64ch] text-[16.5px] leading-relaxed text-ink-soft">{page.description}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-line pb-6 text-[12.5px] text-ink-faint">
            <span className="rounded-full bg-field px-2.5 py-1 font-semibold text-ink-soft">{section}</span>
            <span className="tnum">
              {String(index + 1).padStart(2, "0")} of {String(pages.length).padStart(2, "0")}
            </span>
            <span aria-hidden>·</span>
            <span className="tnum">{page.minutes} min read</span>
          </div>
        </header>

        {/* right: table of contents; a disclosure above the article on small screens */}
        {toc.length >= 3 && (
          <div className="order-first min-w-0 lg:order-none lg:col-start-3 lg:row-span-2 lg:[&>div]:h-full">
            <Toc items={toc} />
          </div>
        )}

        <article className="min-w-0 lg:col-start-2">
          <Markdown source={body} />

          {/* previous / next across the whole reading order */}
          <nav aria-label="Previous and next page" className="mt-16 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
            {prev ? (
              <Link href={`/docs/${prev.slug}`} className="surface-interactive group rounded-2xl border border-line p-4">
                <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-ink-faint uppercase">
                  <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
                    ←
                  </span>
                  Previous
                </div>
                <div className="mt-1.5 text-[15px] font-semibold text-ink">{prev.title}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-faint">{prev.section ?? "Docs"}</div>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next && (
              <Link
                href={`/docs/${next.slug}`}
                className="surface-interactive group rounded-2xl border border-line p-4 sm:text-right"
              >
                <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-ink-faint uppercase sm:justify-end">
                  Next
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
                <div className="mt-1.5 text-[15px] font-semibold text-ink">{next.title}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-faint">{next.section ?? "Docs"}</div>
              </Link>
            )}
          </nav>

          {/* feedback */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl bg-surface px-5 py-4 text-[13.5px] text-ink-soft">
            <span>
              Was this useful?{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Docs: ${page.title}`)}`}
                className="font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
              >
                Email {CONTACT_EMAIL}
              </a>
            </span>
            <Link href="/docs" className="inline-flex min-h-10 items-center font-medium text-ink-soft transition-colors hover:text-ink">
              All docs →
            </Link>
          </div>
        </article>
      </div>
    </ProseShell>
  );
}
