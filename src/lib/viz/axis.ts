import { formatCount, formatMonthYear, formatPercent, formatUsd, UNKNOWN } from "@/lib/format";

/** Axis tick formatters. They only delegate to src/lib/format so formats never drift. */
export const axisFormat = {
  usd: formatUsd,
  percent: formatPercent,
  count: formatCount,
  /** ISO date or year string → "Mar 2026" / "2026". */
  date: formatMonthYear,
  year: (year: number | null | undefined) =>
    year === null || year === undefined ? UNKNOWN : String(year),
} as const;

/** Log axes must say so in the axis title (PHASE_2 §2.2). */
export function logAxisTitle(title: string): string {
  return `${title} (log scale)`;
}
