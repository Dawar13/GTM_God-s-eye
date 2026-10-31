import type { ReactNode } from "react";
import { markStyle } from "@/lib/viz";
import { cn } from "@/lib/utils";

/**
 * A linear bullet bar from zero: the filled bar is the value you assume, the tick is the
 * value you need. Both sit on one linear scale that starts at zero, so lengths compare
 * honestly. Fractions are 0..1 of the scale; `max` only labels the right end.
 */
export function BulletGauge({
  assumedFrac,
  requiredFrac,
  max,
  assumedLabel,
  requiredLabel,
  formatValue,
  reaches,
  color,
  ariaLabel,
  className,
}: {
  assumedFrac: number;
  requiredFrac: number;
  max: number;
  /** "Assumed exit $500M". */
  assumedLabel: ReactNode;
  /** "Needed to return the fund $781M". */
  requiredLabel: ReactNode;
  formatValue: (n: number) => string;
  reaches: boolean;
  color: string;
  ariaLabel: string;
  className?: string;
}) {
  const m = markStyle(color);
  const requiredRight = requiredFrac > 0.5;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative h-6">
        <span
          className={cn(
            "absolute top-0 text-sm font-medium whitespace-nowrap tabular-nums",
            requiredRight ? "-translate-x-full pr-2" : "pl-2",
          )}
          style={{ left: `${requiredFrac * 100}%` }}
        >
          {requiredLabel}
        </span>
      </div>
      <div
        role="img"
        aria-label={ariaLabel}
        className="relative h-8 w-full overflow-hidden rounded-md border border-rule bg-panel-sunk"
      >
        <div
          className="h-full"
          style={{
            width: `${Math.min(1, Math.max(0, assumedFrac)) * 100}%`,
            backgroundColor: m.fill,
            boxShadow: `inset -1px 0 0 ${m.stroke}`,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-ink"
          style={{ left: `calc(${requiredFrac * 100}% - 1px)` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted tabular-nums">
        <span>{formatValue(0)}</span>
        <span>{formatValue(max)}</span>
      </div>
      <p className="text-sm text-ink-2">
        {assumedLabel}.{" "}
        <span className={reaches ? "text-positive" : "text-negative"}>
          {reaches ? "The bar reaches the tick." : "The bar stops short of the tick."}
        </span>
      </p>
    </div>
  );
}
