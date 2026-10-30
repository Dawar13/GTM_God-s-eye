import type { ReactNode } from "react";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConfidenceDot, type ConfidenceLevel } from "./SourceBadge";

/**
 * One headline number. `value` arrives formatted (use Metric or src/lib/format);
 * `delta` is a fraction (0.12 = +12.0%); the dot carries source confidence.
 */
export function Stat({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  confidence,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: number | null;
  deltaLabel?: string;
  confidence?: ConfidenceLevel | null;
  className?: string;
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-1.5 text-sm text-ink-2">
        <span>{label}</span>
        {confidence !== undefined && <ConfidenceDot confidence={confidence} />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {unit && <span className="text-sm text-ink-2">{unit}</span>}
      </div>
      {hasDelta && (
        <div className="flex items-baseline gap-1.5 text-sm tabular-nums">
          <span className={delta >= 0 ? "text-positive" : "text-negative"}>
            {delta >= 0 ? "+" : "−"}
            {formatPercent(Math.abs(delta))}
          </span>
          {deltaLabel && <span className="text-muted">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}
