import { assertPositive } from "./rounding";

/** mulberry32: a small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Outcome multiples for one company. */
export type OutcomeDistribution =
  | {
      kind: "buckets";
      /** e.g. [{ p: 0.5, multiple: 0 }, { p: 0.3, multiple: 1 }, …]; p sums to 1. */
      buckets: { p: number; multiple: number }[];
    }
  | {
      kind: "pareto";
      /** Shape; lower = fatter tail. */
      alpha: number;
      /** Minimum multiple for companies that don't fail. */
      xm: number;
      /** Share of companies that return 0. */
      lossRate: number;
    };

export type PortfolioSimulation = {
  fundMultiples: number[];
  mean: number;
  median: number;
  p10: number;
  p90: number;
  /** Share of simulated funds returning at least 1x / 3x. */
  pAtLeast1x: number;
  pAtLeast3x: number;
  histogram: { from: number; to: number; count: number }[];
};

function drawOne(d: OutcomeDistribution, rand: () => number): number {
  if (d.kind === "buckets") {
    let u = rand();
    for (const b of d.buckets) {
      if (u < b.p) return b.multiple;
      u -= b.p;
    }
    return (d.buckets[d.buckets.length - 1] as { multiple: number }).multiple;
  }
  if (rand() < d.lossRate) return 0;
  // Inverse-CDF sampling: x = xm / U^(1/alpha).
  return d.xm / (1 - rand()) ** (1 / d.alpha);
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (pos - lo);
}

/**
 * Monte Carlo of fund multiples for an equal-weighted portfolio of `n`
 * companies, each drawing an outcome multiple from `distribution`. Seeded, so
 * the same inputs always give the same result.
 */
export function simulatePortfolio(args: {
  n: number;
  distribution: OutcomeDistribution;
  trials: number;
  seed: number;
  bins?: number;
}): PortfolioSimulation {
  assertPositive("n", args.n);
  assertPositive("trials", args.trials);
  const d = args.distribution;
  if (d.kind === "buckets") {
    const total = d.buckets.reduce((a, b) => a + b.p, 0);
    if (Math.abs(total - 1) > 1e-9) throw new RangeError("bucket probabilities must sum to 1");
  } else {
    assertPositive("alpha", d.alpha);
    assertPositive("xm", d.xm);
  }
  const rand = mulberry32(args.seed);
  const fundMultiples: number[] = [];
  for (let t = 0; t < args.trials; t++) {
    let sum = 0;
    for (let i = 0; i < args.n; i++) sum += drawOne(d, rand);
    fundMultiples.push(sum / args.n);
  }
  const sorted = [...fundMultiples].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1] as number;
  const bins = args.bins ?? 20;
  const width = max > 0 ? max / bins : 1;
  const histogram = Array.from({ length: bins }, (_, i) => ({
    from: i * width,
    to: (i + 1) * width,
    count: 0,
  }));
  for (const m of fundMultiples) {
    const i = Math.min(bins - 1, Math.floor(m / width));
    (histogram[i] as { count: number }).count++;
  }
  return {
    fundMultiples,
    mean: fundMultiples.reduce((a, b) => a + b, 0) / fundMultiples.length,
    median: quantile(sorted, 0.5),
    p10: quantile(sorted, 0.1),
    p90: quantile(sorted, 0.9),
    pAtLeast1x: fundMultiples.filter((m) => m >= 1).length / fundMultiples.length,
    pAtLeast3x: fundMultiples.filter((m) => m >= 3).length / fundMultiples.length,
    histogram,
  };
}
