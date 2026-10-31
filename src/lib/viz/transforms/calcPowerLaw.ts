import type { PortfolioSimulation } from "@/lib/finance";

export type MultipleBin = {
  from: number;
  to: number;
  count: number;
  /** Share of all trials. */
  share: number;
};

export type PowerLawSeries = {
  trials: number;
  mean: number;
  median: number;
  p10: number;
  p90: number;
  pAtLeast1x: number;
  pAtLeast3x: number;
  /** Equal-width bins from zero; the last bin includes its upper edge. */
  bins: MultipleBin[];
  binWidth: number;
  /** Right end of the last bin; also the x scale end. */
  domainMax: number;
  /** Trials above `domainMax`: left out of the bars, counted in the footer. */
  aboveCount: number;
  /** Largest simulated fund multiple. */
  max: number;
};

/** Smallest of 1, 2 or 5 times a power of ten that is at least `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw * (1 - 1e-12)) return m * pow;
  return 10 * pow;
}

function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (pos - lo);
}

/**
 * Histogram of simulated fund multiples. A heavy tail would squash every bar into the first
 * one, so the x scale ends at the 99th percentile rounded up to a clean bin width; the few
 * trials beyond it are counted in `aboveCount` (the chart footer says how many are not shown)
 * and never drawn as part of another bar. Bars start at zero on a linear count axis.
 */
export function powerLawSeries(
  sim: Pick<
    PortfolioSimulation,
    "fundMultiples" | "mean" | "median" | "p10" | "p90" | "pAtLeast1x" | "pAtLeast3x"
  >,
  bins = 24,
): PowerLawSeries {
  const values = sim.fundMultiples;
  const trials = values.length;
  if (trials === 0) throw new RangeError("no simulated funds to draw");
  const sorted = [...values].sort((a, b) => a - b);
  const max = sorted[trials - 1] as number;
  const p99 = quantile(sorted, 0.99);
  const binWidth = niceStep(p99 > 0 ? p99 / bins : 1 / bins);
  const domainMax = binWidth * bins;
  const counts = new Array<number>(bins).fill(0);
  let aboveCount = 0;
  for (const v of values) {
    if (v > domainMax) aboveCount++;
    else counts[Math.min(bins - 1, Math.floor(v / binWidth))]!++;
  }
  return {
    trials,
    mean: sim.mean,
    median: sim.median,
    p10: sim.p10,
    p90: sim.p90,
    pAtLeast1x: sim.pAtLeast1x,
    pAtLeast3x: sim.pAtLeast3x,
    bins: counts.map((count, i) => ({
      from: i * binWidth,
      to: (i + 1) * binWidth,
      count,
      share: count / trials,
    })),
    binWidth,
    domainMax,
    aboveCount,
    max,
  };
}
