/** Network the app is on, as a quiet mono pill with a live dot. */
export default function ChainPill({ name, testnet = false }: { name: string; testnet?: boolean }) {
  return (
    <span className="inline-flex min-h-[34px] items-center gap-2 rounded-full border border-line bg-surface px-3 font-mono text-[12px] text-ink-soft">
      <span className={`h-1.5 w-1.5 rounded-full ${testnet ? "bg-ink-faint" : "bg-ink"}`} aria-hidden="true" />
      {name}
    </span>
  );
}
