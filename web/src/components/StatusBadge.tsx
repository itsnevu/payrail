const styles: Record<string, string> = {
  PAID: "bg-green text-bg",
  PENDING: "bg-field text-ink-soft ring-1 ring-line",
  EXPIRED: "bg-line text-ink-soft",
  CANCELLED: "bg-line text-ink-faint",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${styles[status] ?? "bg-field"}`}>{status}</span>;
}
