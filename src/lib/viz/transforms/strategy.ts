/**
 * Strategy view data (PHASE_2 S9): one row per investor, the ranking, the outreach tiers and
 * the target-list table. Pure; the page and the tests call the same functions.
 *
 * Ranking rule (the Directory's fit-desc sort, src/lib/directory/sort.ts): investors with a
 * reliable score first by score, then investors the pipeline flagged `sparse` (their score is
 * rescaled over two or three known features), ties by name then id. Investors with no fit
 * record are not ranked. The check feature is re-scored for the raise (src/lib/fit/check.ts);
 * the other five features are as stored.
 */
import { withRaise } from "@/lib/fit/check";
import { fitScore, type FitFeatureName, type FitScore, type FitWeights } from "@/lib/fit/score";
import { toFilterable } from "@/lib/data/directory";
import type { FilterableInvestor } from "@/lib/filters";
import type { FitFeatures, Investor } from "@/lib/schema";
import { CATEGORICAL } from "@/lib/viz/palette";
import { FIT_FEATURE_LABELS, fitBreakdown, type FitBreakdown } from "./fitBreakdown";
import { FIT_FEATURE_ORDER } from "./topByFit";

/** One colour per fit feature, the same as the Inspector's breakdown bar. */
export const fitFeatureColor = (n: FitFeatureName): string =>
  CATEGORICAL[FIT_FEATURE_ORDER.indexOf(n)] ?? CATEGORICAL[0];

export type OutreachTier = "A" | "B" | "C";
export const OUTREACH_TIERS: readonly OutreachTier[] = ["A", "B", "C"];

/** Score cut-offs (0-100) for the starting tiers. Sparse investors always start in C. */
export const TIER_A_MIN = 70;
export const TIER_B_MIN = 55;

/** Tier overrides the user made, by investor id. Kept in the browser only, never in data. */
export type TierOverrides = Readonly<Record<string, OutreachTier>>;

export type StrategyRow = FilterableInvestor & {
  name: string;
  checkMinUsd: number | null;
  checkMaxUsd: number | null;
  leads: boolean | null;
  /** Stored feature values in FIT_FEATURE_ORDER (null = unknown); null with no fit record. */
  features: (number | null)[] | null;
  flags: FitFeatures["flags"];
  website: string | null;
  /** Stored `application_url`; null for most investors. */
  applicationUrl: string | null;
};

/** Strategy's own fields, sent by /api/strategy-rows; filter fields come from the filter index. */
export const STRATEGY_DETAIL_KEYS = [
  "id",
  "name",
  "checkMinUsd",
  "checkMaxUsd",
  "leads",
  "features",
  "flags",
  "website",
  "applicationUrl",
] as const satisfies readonly (keyof StrategyRow)[];

export function toStrategyRows(
  investors: readonly Investor[],
  fits: readonly FitFeatures[],
): StrategyRow[] {
  const fitBy = new Map(fits.map((f) => [f.investor_id, f]));
  return investors.map((inv) => {
    const fit = fitBy.get(inv.id);
    return {
      ...toFilterable(inv),
      name: inv.name,
      checkMinUsd: inv.check_min_usd,
      checkMaxUsd: inv.check_max_usd,
      leads: inv.leads,
      features: fit ? FIT_FEATURE_ORDER.map((n) => fit.features[n]?.value ?? null) : null,
      flags: fit?.flags ?? [],
      website: inv.website,
      applicationUrl: inv.application_url,
    };
  });
}

/** The row's fit record with the check feature re-scored for `raiseUsd`; null with no record. */
export function rowFit(row: StrategyRow, raiseUsd: number): FitFeatures | null {
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
  return withRaise(base, row, raiseUsd);
}

export type Ranked = {
  /** 1-based; sparse investors continue the count after the reliable ones. */
  rank: number;
  row: StrategyRow;
  score: FitScore;
  /** False for investors flagged `sparse`. */
  reliable: boolean;
  /** The tier before any manual override. */
  autoTier: OutreachTier;
};

export function autoTier(total: number, flags: FitFeatures["flags"]): OutreachTier {
  if (flags.includes("sparse")) return "C";
  return total >= TIER_A_MIN ? "A" : total >= TIER_B_MIN ? "B" : "C";
}

/** Score for one row (check re-scored for the raise); null when it has no fit record. */
export function scoreRow(row: StrategyRow, weights: FitWeights, raiseUsd: number): FitScore | null {
  const fit = rowFit(row, raiseUsd);
  return fit ? fitScore(fit, weights) : null;
}

export function rankStrategy(
  rows: readonly StrategyRow[],
  weights: FitWeights,
  raiseUsd: number,
): Ranked[] {
  const scored: { row: StrategyRow; score: FitScore; reliable: boolean }[] = [];
  for (const row of rows) {
    const score = scoreRow(row, weights, raiseUsd);
    if (score) scored.push({ row, score, reliable: !row.flags.includes("sparse") });
  }
  scored.sort(
    (a, b) =>
      Number(!a.reliable) - Number(!b.reliable) ||
      b.score.total - a.score.total ||
      a.row.name.localeCompare(b.row.name, "en") ||
      a.row.id.localeCompare(b.row.id),
  );
  return scored.map((s, i) => ({
    rank: i + 1,
    ...s,
    autoTier: autoTier(s.score.total, s.row.flags),
  }));
}

export function effectiveTier(r: Ranked, overrides: TierOverrides): OutreachTier {
  return overrides[r.row.id] ?? r.autoTier;
}

export type TierBoard = Record<OutreachTier, Ranked[]>;

/** Ranked investors in their tiers (overrides applied), each tier in rank order. */
export function toTierBoard(ranked: readonly Ranked[], overrides: TierOverrides): TierBoard {
  const board: TierBoard = { A: [], B: [], C: [] };
  for (const r of ranked) board[effectiveTier(r, overrides)].push(r);
  return board;
}

/** Overrides that still point at a ranked investor (others are stale, e.g. filtered out). */
export function liveOverrides(ranked: readonly Ranked[], overrides: TierOverrides): number {
  return ranked.filter((r) => overrides[r.row.id] !== undefined).length;
}

/** The breakdown of one ranked row, from the same `fitBreakdown` as the Inspector. */
export function breakdownOf(r: Ranked, weights: FitWeights, raiseUsd: number): FitBreakdown | null {
  return fitBreakdown(rowFit(r.row, raiseUsd), weights);
}

export type TargetTable = { header: string[]; rows: (string | number | null)[][] };

const FLAG_LABELS: Record<string, string> = { conflict: "conflict", sparse: "sparse" };

/**
 * The target list as a table: every ranked investor in rank order, with the weighted points of
 * each feature (blank when the feature is unknown), total, coverage, flags, tier (and whether
 * it was changed by hand), website and the stored application URL (blank when none is stored).
 */
export function targetTable(
  ranked: readonly Ranked[],
  weights: FitWeights,
  raiseUsd: number,
  overrides: TierOverrides,
): TargetTable {
  const header = [
    "Rank",
    "Investor",
    ...FIT_FEATURE_ORDER.map((n) => `${FIT_FEATURE_LABELS[n]} points (weight ${weights[n]})`),
    "Fit total (0-100)",
    "Weight known (share)",
    "Flags",
    "Outreach tier",
    "Tier source",
    "Website",
    "Application URL",
    "Raise assumed (USD)",
  ];
  const rows = ranked.map((r) => {
    const manual = overrides[r.row.id] !== undefined;
    return [
      r.rank,
      r.row.name,
      ...FIT_FEATURE_ORDER.map((n: FitFeatureName) => r.score.contributions[n]),
      r.score.total,
      r.score.coverage,
      r.row.flags.map((f) => FLAG_LABELS[f] ?? f).join("; "),
      effectiveTier(r, overrides),
      manual ? "manual" : "auto",
      r.row.website,
      r.row.applicationUrl,
      raiseUsd,
    ];
  });
  return { header, rows };
}
