/**
 * One figure on the dashboard, in the shape of the landing's closing stats: a mono tag on top,
 * a tabular figure with an optional unit, and a one-line note underneath.
 */
export default function StatTile({
  tag,
  figure,
  unit,
  note,
  loading = false,
}: {
  tag: string;
  figure: string;
  unit?: string;
  note?: string;
  loading?: boolean;
}) {
  return (
    <div className="surface flex min-h-[124px] flex-col justify-between rounded-[24px] border border-line p-4 sm:min-h-[140px] sm:p-5">
      <span className="font-mono text-[12px] tracking-[0.02em] text-ink-faint">{tag}</span>
      {loading ? (
        <div className="mt-3 space-y-2" aria-busy="true">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-field" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-field" />
        </div>
      ) : (
        <span className="mt-3 flex flex-col gap-1">
          <span className="tnum flex items-baseline gap-1.5 text-[28px] leading-none tracking-[-0.03em] sm:text-[34px]">
            <span className="truncate">{figure}</span>
            {unit && <span className="text-[13px] tracking-normal text-ink-soft">{unit}</span>}
          </span>
          {note && <span className="truncate text-[13px] text-ink-soft">{note}</span>}
        </span>
      )}
    </div>
  );
}
