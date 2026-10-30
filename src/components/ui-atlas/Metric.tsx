import { formatCount, formatInrCrore, formatPercent, formatUsd, UNKNOWN } from "@/lib/format";
import { cn } from "@/lib/utils";

const FORMATTERS = {
  usd: formatUsd,
  inr: formatInrCrore,
  /** Takes a fraction: 0.091 renders as 9.1%. */
  percent: formatPercent,
  count: formatCount,
} as const;

export type MetricKind = keyof typeof FORMATTERS;

/** A number formatted through src/lib/format. Unknown renders as a dash, never zero. */
export function Metric({
  kind,
  value,
  className,
}: {
  kind: MetricKind;
  value: number | null | undefined;
  className?: string;
}) {
  const text = FORMATTERS[kind](value);
  return (
    <span
      className={cn("tabular-nums", className)}
      title={text === UNKNOWN ? "Not available" : undefined}
    >
      {text}
    </span>
  );
}
