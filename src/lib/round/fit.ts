/**
 * Fit scores for our round. Only the check size feature depends on the raise, so every place
 * that computes or shows a fit score re-scores that one feature here and keeps the other five
 * as stored. At the pipeline's $1M raise the result equals the stored record.
 */
import { checkFeature, withRaise, type CheckInput } from "@/lib/fit/check";
import { fitScore, type FitFeatureName, type FitScore, type FitWeights } from "@/lib/fit/score";
import type { FitFeatures, Investor } from "@/lib/schema";
import { FIT_FEATURE_ORDER } from "@/lib/viz/transforms/topByFit";

export { checkFeature };

/** The stored fit record with `features.check` re-scored for `raiseUsd`; nothing else changes. */
export function fitForRound(
  fit: FitFeatures,
  checkInputs: CheckInput,
  raiseUsd: number,
): FitFeatures {
  return withRaise(fit, checkInputs, raiseUsd);
}

/** Every fit record re-scored for the raise, using each investor's check range and `leads`. */
export function fitsForRound(
  investors: readonly Investor[],
  fits: readonly FitFeatures[],
  raiseUsd: number,
): FitFeatures[] {
  const byId = new Map(investors.map((i) => [i.id, i]));
  return fits.map((f) => {
    const inv = byId.get(f.investor_id);
    if (!inv) return f;
    return fitForRound(
      f,
      { checkMinUsd: inv.check_min_usd, checkMaxUsd: inv.check_max_usd, leads: inv.leads },
      raiseUsd,
    );
  });
}

/** The compact fit fields the Directory and Strategy rows carry. */
export type CompactFitRow = CheckInput & {
  id: string;
  /** Stored feature values in FIT_FEATURE_ORDER (null = unknown); null with no fit record. */
  features: (number | null)[] | null;
  flags: FitFeatures["flags"];
};

/** A row's fit record rebuilt from its compact values, check re-scored for `raiseUsd`. */
export function compactFit(row: CompactFitRow, raiseUsd: number): FitFeatures | null {
  if (!row.features) return null;
  const features = Object.fromEntries(
    FIT_FEATURE_ORDER.map((n, i) => {
      const v = row.features![i] ?? null;
      return [n, v === null ? null : { value: v, method: "stored by the pipeline", inputs: [] }];
    }),
  ) as FitFeatures["features"];
  const base: FitFeatures = {
    id: `fit_${row.id.slice(4)}`,
    investor_id: row.id,
    features,
    flags: row.flags,
    raise_size_usd: raiseUsd,
  };
  return fitForRound(base, row, raiseUsd);
}

/** Weighted score of a compact row for our raise; null when it has no fit record. */
export function scoreCompact(
  row: CompactFitRow,
  weights: FitWeights,
  raiseUsd: number,
): FitScore | null {
  const fit = compactFit(row, raiseUsd);
  return fit ? fitScore(fit, weights) : null;
}

export type { FitFeatureName };
