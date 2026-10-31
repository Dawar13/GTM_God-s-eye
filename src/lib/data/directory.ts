import { fitScore } from "@/lib/fit/score";
import { SECTOR_MATCH_MIN, type FilterableInvestor } from "@/lib/filters";
import { inArea, type Area } from "@/lib/filters/area";
import type { BubblePoint, FitFeatures, Fund, Investor, ThesisPoint } from "@/lib/schema";
import type { Sector } from "@/lib/schema/enums";

/** The fields the global filters read, from one investor record. Used by the Directory and the filter bar. */
export function toFilterable(inv: Investor): FilterableInvestor {
  const weights = inv.sector_weights?.value ?? {};
  const sectors = Object.entries(weights)
    .filter(([, w]) => (w ?? 0) >= SECTOR_MATCH_MIN)
    .map(([sector]) => sector as Sector);
  return {
    id: inv.id,
    region: inv.region,
    stages: inv.stages,
    type: inv.type,
    freshness: inv.category.freshness,
    maturity: inv.category.maturity,
    sectors,
    tier: inv.tier,
  };
}

export type DirectoryRow = FilterableInvestor & {
  name: string;
  checkMinUsd: number | null;
  checkMaxUsd: number | null;
  latestFundSizeUsd: number | null;
  latestFundYear: number | null;
  seedListCount: number;
  /** Fit score with the default weights, 0–100; null when no feature is known. */
  fit: number | null;
  /** Share of fit weight whose feature is known. */
  fitCoverage: number | null;
  fitFlags: string[];
  sourceCount: number;
  confidence: Investor["confidence"];
};

/**
 * The Directory's own fields, sent by /api/directory-rows. The filter fields come from the
 * filter index, which every investor view already loads (`joinFilterable`).
 */
export const DIRECTORY_DETAIL_KEYS = [
  "id",
  "name",
  "checkMinUsd",
  "checkMaxUsd",
  "latestFundSizeUsd",
  "latestFundYear",
  "seedListCount",
  "fit",
  "fitCoverage",
  "fitFlags",
  "sourceCount",
  "confidence",
] as const satisfies readonly (keyof DirectoryRow)[];

/** The most recent fund by vintage year, then close date. */
export function latestFund(funds: readonly Fund[]): Fund | null {
  let best: Fund | null = null;
  for (const f of funds) {
    if (f.vintage_year === null) continue;
    if (
      best === null ||
      f.vintage_year > (best.vintage_year ?? 0) ||
      (f.vintage_year === best.vintage_year && (f.close_date ?? "") > (best.close_date ?? ""))
    ) {
      best = f;
    }
  }
  return best;
}

export function toDirectoryRows(
  investors: readonly Investor[],
  funds: readonly Fund[],
  fits: readonly FitFeatures[] = [],
): DirectoryRow[] {
  const fundsByInvestor = new Map<string, Fund[]>();
  for (const f of funds) {
    const list = fundsByInvestor.get(f.investor_id) ?? [];
    list.push(f);
    fundsByInvestor.set(f.investor_id, list);
  }
  const fitByInvestor = new Map(fits.map((f) => [f.investor_id, f]));
  return investors.map((inv) => {
    const latest = latestFund(fundsByInvestor.get(inv.id) ?? []);
    const fit = fitByInvestor.get(inv.id);
    const score = fit ? fitScore(fit) : null;
    return {
      ...toFilterable(inv),
      name: inv.name,
      checkMinUsd: inv.check_min_usd,
      checkMaxUsd: inv.check_max_usd,
      latestFundSizeUsd: latest?.size_usd ?? null,
      latestFundYear: latest?.vintage_year ?? null,
      seedListCount: inv.seed_list_count,
      fit: score ? score.total : null,
      fitCoverage: score ? score.coverage : null,
      fitFlags: fit?.flags ?? [],
      sourceCount: inv.sources.length,
      confidence: inv.confidence,
    };
  });
}

/**
 * Each placed investor's position in the thesis map's two layouts, so the Directory can
 * resolve a brushed `?area=` to rows. Thesis = layout_thesis x/y; fit = industrial affinity
 * and stage earliness from layout_bubbles, for investors on the thesis map with both known.
 * Only investors on the map are listed (about 560), which keeps the page payload small.
 */
export type AreaCoords = Record<string, { thesis: [number, number]; fit: [number, number] | null }>;

export function toAreaCoords(
  layout: readonly ThesisPoint[],
  bubbles: readonly BubblePoint[],
): AreaCoords {
  const axes = new Map(bubbles.map((b) => [b.id, b]));
  const out: AreaCoords = {};
  for (const p of layout) {
    const b = axes.get(p.id);
    const fit: [number, number] | null =
      b && b.industrial_affinity !== null && b.stage_earliness !== null
        ? [b.industrial_affinity, b.stage_earliness]
        : null;
    out[p.id] = { thesis: [p.x, p.y], fit };
  }
  return out;
}

/** Rows inside a brushed map region; every row when there is no region. */
export function rowsInArea<T extends { id: string }>(
  rows: readonly T[],
  coords: AreaCoords,
  area: Area | null,
): T[] {
  if (!area) return [...rows];
  return rows.filter((r) => inArea(coords[r.id]?.[area.layout], area));
}
