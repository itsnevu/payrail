import type { ReactNode } from "react";

type Tone = "error" | "info" | "quiet";

const TONES: Record<Tone, string> = {
  // The only place the pay page uses colour: a failure the buyer must read.
  error: "border-rose-200 bg-rose-50 text-rose-700",
  // A state the buyer cannot change from here (expired, cancelled, unsupported network).
  info: "border-line bg-field text-ink",
  // A hint (phone tip, gas note) that must not compete with the button.
  quiet: "border-transparent bg-field/70 text-ink-soft",
};

/**
 * One banner style for every message on the pay page, so an error, a closed invoice and a
 * hint all read as the same voice at different volumes. `title` is the sentence in bold;
 * children carry the detail (the exact error text, the next step).
 */
export default function PayNotice({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${TONES[tone]} ${className}`}
    >
      {title && <div className="font-semibold">{title}</div>}
      {children && (
        <div className={`break-words ${title ? "mt-0.5" : ""} ${tone === "error" ? "" : "text-ink-soft"}`}>{children}</div>
      )}
    </div>
  );
}
