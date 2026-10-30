import {
  DEFAULT_FIT_WEIGHTS,
  rankByFit,
  type FitFeatureName,
  type FitWeights,
} from "@/lib/fit/score";
import type { Confidence, FitFeatures, Investor } from "@/lib/schema";
import { provenanceOf } from "./common";

export const FIT_FEATURE_ORDER: readonly FitFeatureName[] = [
  "thesis",
  "stage",
  "check",
  "adjacency",
  "geography",
  "dry_powder",
];

export type FitBar = {
  rank: number;
  investorId: string;
  name: string;
  /** 0–100 over the features that are known. */
  total: number;
  /** Share of fit weight whose feature is known (0–1). */
  coverage: number;
  /** Points per feature; null when the feature is unknown (no segment is drawn). */
  contributions: Record<FitFeatureName, number | null>;
  flags: FitFeatures["flags"];
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type TopByFit = {
  bars: FitBar[];
  /** Selected investors that have fit features. */
  scored: number;
  /** Scored investors left out of the ranking because the pipeline flagged them sparse. */
  sparse: number;
  /** Selected investors with no fit-feature record. */
  notShown: number;
  sources: string[];
};

/**
 * The `n` best investors among the given ones by weighted fit score (default weights,
 * src/lib/fit/score.ts), each with the points every known feature contributed. Unknown
 * features have null contributions. Investors flagged `sparse` (3+ of 6 features unknown)
 * are not ranked, as in the Phase 1 report: rescaling over two known features would put them
 * on top. Other flags (conflict) pass through.
 */
export function topByFit(
  investors: readonly Investor[],
  fits: readonly FitFeatures[],
  n = 10,
  weights: FitWeights = DEFAULT_FIT_WEIGHTS,
): TopByFit {
  const byId = new Map(investors.map((i) => [i.id, i]));
  const scored = fits.filter((f) => byId.has(f.investor_id));
  const ranked = scored.filter((f) => !f.flags.includes("sparse"));
  const bars = rankByFit(ranked, weights)
    .slice(0, n)
    .map(({ investorId, score }, i): FitBar => {
      const inv = byId.get(investorId)!;
      return {
        rank: i + 1,
        investorId,
        name: inv.name,
        total: score.total,
        coverage: score.coverage,
        contributions: score.contributions,
        flags: score.flags,
        ...provenanceOf([inv]),
      };
    });
  const domains = new Set<string>();
  for (const b of bars) if (b.sourceDomain) domains.add(b.sourceDomain.split(" +")[0]!);
  return {
    bars,
    scored: scored.length,
    sparse: scored.length - ranked.length,
    notShown: investors.length - scored.length,
    sources: [...domains],
  };
}
