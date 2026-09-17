/** Skeleton shown while an app page's bundle or data is on its way. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-24 animate-pulse rounded bg-field" />
      <div className="card space-y-4">
        <div className="h-6 w-2/3 animate-pulse rounded bg-field" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-field" />
        <div className="h-10 w-1/2 animate-pulse rounded bg-field" />
        <div className="h-24 animate-pulse rounded-lg bg-field" />
      </div>
    </div>
  );
}
