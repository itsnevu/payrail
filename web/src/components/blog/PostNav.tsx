import Link from "next/link";
import type { Doc } from "@/lib/content";
import PostMeta from "./PostMeta";

/**
 * Previous and next post, in publication order: "Previous" is the post published before this one,
 * "Next" the one published after. Each card shows the date so the direction is never a guess.
 * Renders nothing when there is only one post.
 */
export default function PostNav({ prev, next }: { prev?: Doc; next?: Doc }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Previous and next posts" className="mt-16 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
      {prev ? <NavCard post={prev} label="Previous" /> : <span className="hidden sm:block" />}
      {next && <NavCard post={next} label="Next" align="right" />}
    </nav>
  );
}

function NavCard({ post, label, align = "left" }: { post: Doc; label: string; align?: "left" | "right" }) {
  const right = align === "right";
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`surface-interactive group flex flex-col rounded-2xl border border-line p-5 ${right ? "sm:items-end sm:text-right" : ""}`}
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
        {!right && (
          <span aria-hidden="true" className="inline-block transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
        )}
        {label}
        {right && (
          <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
            →
          </span>
        )}
      </span>
      <span className="mt-2 text-[16px] leading-snug font-semibold text-ink">{post.title}</span>
      <PostMeta date={post.date} minutes={post.minutes} className={`mt-2 ${right ? "sm:justify-end" : ""}`} />
    </Link>
  );
}
