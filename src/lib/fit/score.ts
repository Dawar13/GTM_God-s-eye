import type { FitFeatures } from "@/lib/schema";

export type FitFeatureName = keyof FitFeatures["features"];

export type FitWeights = Record<FitFeatureName, number>;

/** PROJECT_CONTEXT §4 defaults (points out of 100). */
export const DEFAULT_FIT_WEIGHTS: FitWeights = {
  thesis: 30,
  stage: 20,
  check: 15,
  adjacency: 15,
  geography: 10,
  dry_powder: 10,
};

export type FitScore = {
  /** 0–100 over the features that are known. */
  total: number;
  /** Points each feature contributed, after normalising weights. */
  contributions: Record<FitFeatureName, number | null>;
  /** Share of total weight whose feature is known (0–1). */
  coverage: number;
  flags: FitFeatures["flags"];
};

/**
 * Weighted fit score. Weights are normalised to sum to 100 over the features
 * that are known, so a missing input neither counts as zero nor inflates the
 * rest silently: `coverage` says how much of the weight was usable, and the
 * pipeline's `sparse` flag passes through. Monotonic in every feature.
 */
export function fitScore(fit: FitFeatures, weights: FitWeights = DEFAULT_FIT_WEIGHTS): FitScore {
  const names = Object.keys(weights) as FitFeatureName[];
  for (const n of names) {
    if (!(weights[n] >= 0) || !Number.isFinite(weights[n]))
      throw new RangeError(`weight for ${n} must be a non-negative number`);
  }
  const totalWeight = names.reduce((a, n) => a + weights[n], 0);
  if (totalWeight <= 0) throw new RangeError("at least one weight must be positive");
  const known = names.filter((n) => fit.features[n] !== null);
  const knownWeight = known.reduce((a, n) => a + weights[n], 0);
  const contributions = Object.fromEntries(
    names.map((n) => [n, null]),
  ) as FitScore["contributions"];
  let total = 0;
  if (knownWeight > 0) {
    for (const n of known) {
      const points =
        (100 * weights[n] * (fit.features[n] as { value: number }).value) / knownWeight;
      contributions[n] = points;
      total += points;
    }
  }
  return { total, contributions, coverage: knownWeight / totalWeight, flags: fit.flags };
}

/** Investors ranked by fit score; ties broken by coverage, then id. */
export function rankByFit(
  fits: readonly FitFeatures[],
  weights: FitWeights = DEFAULT_FIT_WEIGHTS,
): { investorId: string; score: FitScore }[] {
  return fits
    .map((f) => ({ investorId: f.investor_id, score: fitScore(f, weights) }))
    .sort(
      (a, b) =>
        b.score.total - a.score.total ||
        b.score.coverage - a.score.coverage ||
        a.investorId.localeCompare(b.investorId),
    );
}
