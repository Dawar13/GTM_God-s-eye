import {
  payoutCurve,
  type Breakpoint,
  type DistributeInput,
  type DistributeResult,
} from "@/lib/finance";
import { formatUsd } from "@/lib/format";

type Base = Omit<DistributeInput, "exitValue">;

export type PayoutSeries = { key: string; label: string };

export type PayoutRow = { exit: number } & Record<string, number>;

/** Line keys: common first, then each preferred class as c0, c1, … in input order. */
export function payoutSeriesKeys(base: Base): PayoutSeries[] {
  return [
    { key: "common", label: "Common" },
    ...base.classes.map((c, i) => ({ key: `c${i}`, label: c.name })),
  ];
}

function toRow(r: DistributeResult): PayoutRow {
  const row: PayoutRow = { exit: r.exitValue, common: r.common };
  r.classes.forEach((c, i) => {
    row[`c${i}`] = c.total;
  });
  return row;
}

/**
 * Payout per class across exit values. Linear: from 0 to maxExit. Log: from maxExit/1000
 * to maxExit, geometrically spaced (a log axis cannot show 0). The breakpoint exits are
 * added to the sample so each kink is drawn exactly.
 */
export function payoutSeries(args: {
  base: Base;
  maxExit: number;
  scale: "linear" | "log";
  breakpoints: readonly Breakpoint[];
  points?: number;
}): PayoutRow[] {
  const { base, maxExit, scale, breakpoints, points = 120 } = args;
  const min = scale === "log" ? maxExit / 1000 : 0;
  const exits = new Set<number>();
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    exits.add(scale === "log" ? min * (maxExit / min) ** t : min + (maxExit - min) * t);
  }
  for (const b of breakpoints) if (b.exit >= min && b.exit <= maxExit) exits.add(b.exit);
  return payoutCurve(
    base,
    [...exits].sort((a, b) => a - b),
  ).map(toRow);
}

export type BreakpointLabel = { exit: number; label: string; kind: Breakpoint["kind"] };

/** Plain labels for the dashed lines, e.g. "Series A converts above $28M". */
export function breakpointLabels(breakpoints: readonly Breakpoint[]): BreakpointLabel[] {
  return breakpoints.map((b) => {
    const at = formatUsd(b.exit);
    const label =
      b.kind === "converts"
        ? `${b.className} converts above ${at}`
        : b.kind === "cap_reached"
          ? `${b.className} reaches its cap at ${at}`
          : `${b.className} preference covered at ${at}`;
    return { exit: b.exit, label, kind: b.kind };
  });
}

/** Rows for the table alternative: eight evenly spaced exits plus every breakpoint. */
export function payoutTable(
  base: Base,
  maxExit: number,
  breakpoints: readonly Breakpoint[],
): PayoutRow[] {
  const exits = new Set<number>();
  for (let k = 1; k <= 8; k++) exits.add((maxExit * k) / 8);
  for (const b of breakpoints) exits.add(b.exit);
  return payoutCurve(
    base,
    [...exits].sort((a, b) => a - b),
  ).map(toRow);
}
