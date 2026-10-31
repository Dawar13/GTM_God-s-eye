import {
  DEFAULT_FIT_WEIGHTS,
  fitScore,
  type FitFeatureName,
  type FitWeights,
} from "@/lib/fit/score";
import type { FitFeatures } from "@/lib/schema";
import { FIT_FEATURE_ORDER } from "./topByFit";

export const FIT_FEATURE_LABELS: Record<FitFeatureName, string> = {
  thesis: "Thesis match",
  stage: "Stage fit",
  check: "Check size fit",
  adjacency: "Adjacency",
  geography: "Geography",
  dry_powder: "Dry powder",
};

export type FitSegment = {
  feature: FitFeatureName;
  label: string;
  /** Points this feature contributes to the 0-100 total. */
  points: number;
  /** Most it could contribute given the weights of the known features. */
  maxPoints: number;
  /** The feature itself, 0-1. */
  value: number;
  method: string;
  inputs: string[];
};

export type FitBreakdown = {
  /** 0-100 over the known features; equals the Directory's score. */
  total: number;
  /** Share of fit weight whose feature is known (0-1). */
  coverage: number;
  flags: FitFeatures["flags"];
  /** Known features only, in the standard order. Segments sum to `total`. */
  segments: FitSegment[];
  /** Features with no value: listed, never drawn as a zero-width segment. */
  unknown: { feature: FitFeatureName; label: string }[];
  /** Our round size the check feature assumed (stored on the fit record). */
  raiseSizeUsd: number;
};

/**
 * One investor's fit score split into feature contributions, with the same function and
 * weights as the Directory column (src/lib/fit/score.ts), so the bar's length equals the
 * Directory's number. Null when the investor has no fit record.
 */
export function fitBreakdown(
  fit: FitFeatures | null,
  weights: FitWeights = DEFAULT_FIT_WEIGHTS,
): FitBreakdown | null {
  if (!fit) return null;
  const score = fitScore(fit, weights);
  const knownWeight = FIT_FEATURE_ORDER.reduce(
    (a, n) => a + (fit.features[n] === null ? 0 : weights[n]),
    0,
  );
  const segments: FitSegment[] = [];
  const unknown: FitBreakdown["unknown"] = [];
  for (const feature of FIT_FEATURE_ORDER) {
    const f = fit.features[feature];
    const points = score.contributions[feature];
    if (f === null || points === null) {
      unknown.push({ feature, label: FIT_FEATURE_LABELS[feature] });
      continue;
    }
    segments.push({
      feature,
      label: FIT_FEATURE_LABELS[feature],
      points,
      maxPoints: knownWeight > 0 ? (100 * weights[feature]) / knownWeight : 0,
      value: f.value,
      method: f.method,
      inputs: f.inputs,
    });
  }
  return {
    total: score.total,
    coverage: score.coverage,
    flags: fit.flags,
    segments,
    unknown,
    raiseSizeUsd: fit.raise_size_usd,
  };
}
