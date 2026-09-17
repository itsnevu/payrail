/* eslint-disable @next/next/no-img-element */
/**
 * Payrail mark: the glossy "P" from /public/logo.png (background removed, see
 * scripts in git history). `size` is the box height; width follows the image ratio.
 * `ink` and `fill` are accepted for call-site compatibility but the bitmap ignores them.
 */
export function PactMark({
  size = 44,
  className = "",
}: {
  size?: number;
  ink?: string;
  fill?: string;
  className?: string;
}) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden="true"
      height={size}
      width={Math.round(size * (654 / 771))}
      draggable={false}
      className={`select-none ${className}`}
      style={{ height: size, width: "auto" }}
    />
  );
}

/** Small rounded card: the icon for each step of the flow (invoice, link, paid). */
export function Chip({
  size,
  color = "#e6e6e6",
  stroke,
  className = "",
}: {
  size?: number;
  color?: string;
  stroke?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="4.5"
        fill={color}
        stroke={stroke}
        strokeWidth={stroke ? 1.6 : 0}
      />
    </svg>
  );
}

export function Wordmark({
  size = 26,
  markSize = 44,
  ink,
  fill,
  className = "",
}: {
  size?: number;
  markSize?: number;
  ink?: string;
  fill?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <PactMark size={markSize} ink={ink} fill={fill} />
      <span className="lp-wordmark" style={{ fontSize: size }}>
        payrail
      </span>
    </span>
  );
}
