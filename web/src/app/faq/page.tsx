import type { Metadata } from "next";
import Link from "next/link";
import { ProseShell } from "@/components/prose/ProseShell";
import FaqBrowser, { type FaqBrowserSection } from "@/components/faq/FaqBrowser";
import { parseFaq, plainText } from "@/components/faq/parse";
import { faq, formatDate } from "@/lib/content";
import { CONTACT_EMAIL, LINKS } from "@/lib/links";
import { Markdown } from "@/lib/markdown";

export function generateMetadata(): Metadata {
  const doc = faq();
  return {
    title: "FAQ: Payrail",
    description: doc.description,
    openGraph: { title: "FAQ: Payrail", description: doc.description },
  };
}

/**
 * /faq. The Markdown in `content/faq.md` is split into sections and question/answer pairs on
 * the server; each answer is rendered here and handed to the client component that filters and
 * folds them. The same pairs feed the FAQPage structured data.
 */
export default function FaqPage() {
  const doc = faq();
  const parsed = parseFaq(doc.body);

  const sections: FaqBrowserSection[] = parsed.sections.map((s) => ({
    id: s.id,
    title: s.title,
    lede: s.lede ? <Markdown source={s.lede} /> : undefined,
    items: s.items.map((it) => ({
      id: it.id,
      question: it.question,
      text: plainText(it.answer),
      answer: <Markdown source={it.answer} />,
    })),
  }));

  const total = parsed.sections.reduce((n, s) => n + s.items.length, 0);

  // Built entirely from our own content; JSON.stringify output, with "<" escaped so the
  // script element can never be closed early by anything in the text.
  const structured = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: parsed.sections.flatMap((s) =>
      s.items.map((it) => ({
        "@type": "Question",
        name: it.question,
        acceptedAnswer: { "@type": "Answer", text: plainText(it.answer) },
      })),
    ),
  };
  const structuredJson = JSON.stringify(structured).replace(/</g, "\\u003c");

  return (
    <ProseShell active={LINKS.faq}>
      <div className="mx-auto w-full max-w-[880px] px-5 py-14 sm:px-8 md:py-20">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredJson }} />

        {/* ---- header ---- */}
        <header>
          <p className="lp-kicker">FAQ</p>
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink sm:text-[44px]">
            Frequently asked questions
          </h1>
          <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-ink-soft">{parsed.lede || doc.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-faint">
            <span className="tnum rounded-full bg-field px-2.5 py-1 font-mono font-medium text-ink-soft">
              {total} questions
            </span>
            {doc.date && (
              <>
                <span>Updated {formatDate(doc.date)}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="tnum">{doc.minutes} min read</span>
          </div>
          {parsed.intro && (
            <div className="mt-2">
              <Markdown source={parsed.intro} />
            </div>
          )}
        </header>

        {/* ---- filter, chips and accordions ---- */}
        <div className="mt-10">
          <FaqBrowser sections={sections} />
        </div>

        {/* ---- not answered here ---- */}
        <div className="surface-inset mt-16 rounded-[24px] p-6 sm:p-8">
          <div className="text-[19px] font-semibold tracking-[-0.01em] text-ink">Not answered here?</div>
          {parsed.outro ? (
            <div className="max-w-[58ch] [&_em]:not-italic [&_p]:mt-2 [&_p]:text-[15px]">
              <Markdown source={parsed.outro} />
            </div>
          ) : (
            <p className="mt-2 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
              Write to {CONTACT_EMAIL} and we will answer.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn-primary h-10 px-4 text-[14px]">
              {CONTACT_EMAIL}
            </a>
            <Link href={LINKS.docs} className="btn-secondary h-10 px-4 text-[14px]">
              Read the docs
            </Link>
            <Link href={LINKS.whitepaper} className="btn-secondary h-10 px-4 text-[14px]">
              Whitepaper
            </Link>
          </div>
        </div>
      </div>
    </ProseShell>
  );
}
