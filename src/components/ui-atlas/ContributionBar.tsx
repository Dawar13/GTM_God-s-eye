import { markStyle } from "@/lib/viz";
import { cn } from "@/lib/utils";

export type ContributionSegment = {
  key: string;
  label: string;
  /** Points this segment adds. Unknown segments are left out, never drawn as zero. */
  points: number;
  color: string;
};

/**
 * A thin stacked bar on a fixed 0-`max` scale, so bars in a list are comparable: length is the
 * total. An image with a spoken summary; the numbers live next to it in the row.
 */
export function ContributionBar({
  segments,
  max = 100,
  ariaLabel,
  className,
}: {
  segments: readonly ContributionSegment[];
  max?: number;
  ariaLabel: string;
  className?: string;
}) {
  const spoken = segments.map((s) => `${s.label} ${s.points.toFixed(1)}`).join(", ");
  return (
    <div
      role="img"
      aria-label={`${ariaLabel}: ${spoken || "no known features"}`}
      className={cn("flex h-2.5 overflow-hidden rounded-sm bg-panel-sunk", className)}
    >
      {segments.map((s) => {
        const m = markStyle(s.color);
        return (
          <div
            key={s.key}
            style={{
              width: `${(Math.max(0, s.points) / max) * 100}%`,
              backgroundColor: m.fill,
              boxShadow: `inset -1px 0 0 ${m.stroke}`,
            }}
          />
        );
      })}
    </div>
  );
}
