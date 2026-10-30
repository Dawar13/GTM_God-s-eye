import { latestFund, toFilterable } from "@/lib/data/directory";
import { applyFilters, type FilterState, type FilterableInvestor } from "@/lib/filters";
import type { Fund, Investor, Round } from "@/lib/schema";

export type CommandStats = {
  /** Investors passing every filter. */
  investors: number;
  /** All investors, unfiltered. */
  investorsAll: number;
  /** Western share of investors with a known region, region filter ignored; null when none. */
  westernShare: number | null;
  westernCount: number;
  regionKnown: number;
  /** Investors passing the other filters but with no region on record. */
  regionUnknown: number;
  /** Investors (passing the filters) whose latest fund is fresh. */
  freshFunds: number;
  /** Sum of those latest funds' sizes; null when none has a known size. */
  dryPowderUsd: number | null;
  freshWithoutSize: number;
  /** Unfiltered: every round in the dataset. */
  deals: number;
  dealsDated: number;
  /** Unfiltered. */
  competitors: number;
};

export function commandStats(
  investors: readonly Investor[],
  funds: readonly Fund[],
  rounds: readonly Round[],
  competitorCount: number,
  filters: FilterState,
): CommandStats {
  const rows: FilterableInvestor[] = investors.map(toFilterable);
  const filtered = applyFilters(rows, filters);
  const sansRegion = applyFilters(rows, filters, "region");
  const westernCount = sansRegion.filter((r) => r.region === "western").length;
  const regionKnown = sansRegion.filter((r) => r.region !== null).length;

  const byInvestor = new Map<string, Fund[]>();
  for (const f of funds) {
    const list = byInvestor.get(f.investor_id) ?? [];
    list.push(f);
    byInvestor.set(f.investor_id, list);
  }
  const fresh = filtered.filter((r) => r.freshness === "fresh");
  const sizes = fresh.map((r) => latestFund(byInvestor.get(r.id) ?? [])?.size_usd ?? null);
  const known = sizes.filter((s): s is number => s !== null);

  return {
    investors: filtered.length,
    investorsAll: investors.length,
    westernShare: regionKnown === 0 ? null : westernCount / regionKnown,
    westernCount,
    regionKnown,
    regionUnknown: sansRegion.length - regionKnown,
    freshFunds: fresh.length,
    dryPowderUsd: known.length === 0 ? null : known.reduce((a, b) => a + b, 0),
    freshWithoutSize: sizes.length - known.length,
    deals: rounds.length,
    dealsDated: rounds.filter((r) => r.date !== null).length,
    competitors: competitorCount,
  };
}
