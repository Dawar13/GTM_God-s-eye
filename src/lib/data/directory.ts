import { fitScore } from "@/lib/fit/score";
import type { FitFeatures, Fund, Investor, Region, ResearchTier } from "@/lib/schema";

export type DirectoryRow = {
  id: string;
  name: string;
  tier: ResearchTier | null;
  region: Region | null;
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
      id: inv.id,
      name: inv.name,
      tier: inv.tier,
      region: inv.region,
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
