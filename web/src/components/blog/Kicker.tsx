import Link from "next/link";

/**
 * The eyebrow over a document header: a short mono label with a rule drawn in front of it, the
 * same shape the landing uses for its section kickers. With `href` it is a link back to the
 * section index, otherwise a plain label.
 */
export default function Kicker({ children, href }: { children: string; href?: string }) {
  const cls =
    "inline-flex items-center gap-2.5 font-mono text-[12px] tracking-[0.08em] text-ink-faint uppercase before:h-px before:w-6 before:bg-current before:opacity-60 before:content-['']";
  if (href) {
    return (
      <Link href={href} className={`${cls} relative transition-colors after:absolute after:-inset-y-3 after:-inset-x-1 after:content-[''] hover:text-ink`}>
        {children}
      </Link>
    );
  }
  return <div className={cls}>{children}</div>;
}
