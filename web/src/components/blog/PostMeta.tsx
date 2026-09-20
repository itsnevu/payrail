import { formatDate } from "@/lib/content";

/**
 * Date and reading time for a post, in mono with tabular figures. Used on the index cards, the
 * post header and the previous/next cards so the three always read the same.
 */
export default function PostMeta({
  date,
  minutes,
  className = "",
}: {
  date?: string;
  minutes: number;
  className?: string;
}) {
  return (
    <div className={`tnum flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[12px] tracking-[0.02em] text-ink-faint ${className}`}>
      {date && (
        <>
          <time dateTime={date}>{formatDate(date)}</time>
          <span aria-hidden="true">·</span>
        </>
      )}
      <span>{minutes} min read</span>
    </div>
  );
}
