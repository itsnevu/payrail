import Link from "next/link";
import type { Doc } from "@/lib/content";
import PostMeta from "./PostMeta";

/**
 * One post on the blog index. The whole card is the link; "Read" is the visible affordance.
 *
 * `featured` is the newest post: it spans the full width of the grid and, from `md`, sets the
 * title on the left and the description on the right so it reads as the lead item rather than as
 * a bigger copy of the others.
 */
export default function PostCard({ post, featured = false }: { post: Doc; featured?: boolean }) {
  const href = `/blog/${post.slug}`;

  if (featured) {
    return (
      <li className="sm:col-span-2">
        <Link
          href={href}
          className="surface-interactive group grid gap-6 rounded-[28px] border border-line p-6 sm:p-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10 lg:p-10"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="badge bg-ink text-bg">Latest</span>
              <PostMeta date={post.date} minutes={post.minutes} />
            </div>
            <h2 className="mt-4 text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] text-ink sm:text-[36px] lg:text-[40px]">
              {post.title}
            </h2>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-6 md:pt-1">
            <p className="text-[16px] leading-[1.65] text-ink-soft md:text-[17px]">{post.description}</p>
            <ReadCue />
          </div>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Link href={href} className="surface-interactive group flex h-full flex-col rounded-[28px] border border-line p-6 sm:p-7">
        <PostMeta date={post.date} minutes={post.minutes} />
        <h2 className="mt-3 text-[22px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink sm:text-[24px]">
          {post.title}
        </h2>
        <p className="mt-3 text-[15px] leading-[1.6] text-ink-soft">{post.description}</p>
        <div className="mt-auto pt-6">
          <ReadCue />
        </div>
      </Link>
    </li>
  );
}

/** "Read →" in the card's bottom corner. The arrow nudges right on hover of the parent link. */
function ReadCue() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft transition-colors group-hover:text-ink">
      Read
      <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </span>
  );
}
