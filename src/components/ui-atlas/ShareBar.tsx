import { formatPercent } from "@/lib/format";
import { markStyle } from "@/lib/viz";
import { cn } from "@/lib/utils";

export type ShareSegment = {
  key: string;
  label: string;
  /** Share of the whole, 0..1. Segments should sum to 1. */
  fraction: number;
  color: string;
};

/**
 * A horizontal 100% bar (the replacement for a donut). Segment widths are the shares,
 * so the bar always starts at zero and ends at 100%. The legend below repeats each
 * share to one decimal, and the bar itself is an image with a spoken summary.
 */
export function ShareBar({
  segments,
  ariaLabel,
  className,
}: {
  segments: readonly ShareSegment[];
  ariaLabel: string;
  className?: string;
}) {
  const spoken = segments.map((s) => `${s.label} ${formatPercent(s.fraction)}`).join(", ");
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="img"
        aria-label={`${ariaLabel}: ${spoken}`}
        className="flex h-10 w-full overflow-hidden rounded-md border border-rule"
      >
        {segments.map((s) => {
          const m = markStyle(s.color);
          return (
            <div
              key={s.key}
              style={{
                width: `${Math.max(0, s.fraction) * 100}%`,
                backgroundColor: m.fill,
                boxShadow: `inset -1px 0 0 ${m.stroke}`,
              }}
              className="flex items-center justify-center overflow-hidden text-sm font-medium tabular-nums"
            >
              {s.fraction >= 0.1 && (
                <span className="px-1 text-ink">{formatPercent(s.fraction)}</span>
              )}
            </div>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {segments.map((s) => {
          const m = markStyle(s.color);
          return (
            <li key={s.key} className="flex items-center gap-1.5 text-ink-2">
              <svg width="10" height="10" aria-hidden>
                <rect x="0.5" y="0.5" width="9" height="9" rx="2" fill={m.fill} stroke={m.stroke} />
              </svg>
              <span>{s.label}</span>
              <span className="text-ink tabular-nums">{formatPercent(s.fraction)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
