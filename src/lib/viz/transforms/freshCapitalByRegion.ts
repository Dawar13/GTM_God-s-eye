import { latestFund } from "@/lib/data/directory";
import type { Confidence, Fund, Investor } from "@/lib/schema";
import type { Region } from "@/lib/schema/enums";
import { provenanceOf, topDomains } from "./common";

export type RegionKey = Region | "unknown";

export type RegionCapitalBar = {
  region: RegionKey;
  /** Investors whose latest fund is fresh. */
  investors: number;
  /** Sum of those latest funds' sizes; null when none of them has a known size. */
  capitalUsd: number | null;
  /** Fresh investors whose latest fund has no size. */
  withoutSize: number;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type FreshCapitalByRegion = {
  bars: RegionCapitalBar[];
  totalUsd: number | null;
  freshInvestors: number;
  /** Fresh investors whose latest fund has no size (left out of the dollar sums). */
  notShown: number;
  sources: string[];
};

const ORDER: RegionKey[] = ["western", "india", "other", "unknown"];

/**
 * Fresh capital = the size of the latest fund of every investor whose freshness is "fresh"
 * (latest fund closed on or after the cutoff). This is the Directory's "Latest fund" column
 * summed, so chart and table agree. Investors with no region get their own "unknown" bar.
 */
export function freshCapitalByRegion(
  investors: readonly Investor[],
  funds: readonly Fund[],
): FreshCapitalByRegion {
  const byInvestor = new Map<string, Fund[]>();
  for (const f of funds) {
    const list = byInvestor.get(f.investor_id) ?? [];
    list.push(f);
    byInvestor.set(f.investor_id, list);
  }
  const groups = new Map<RegionKey, { inv: Investor; fund: Fund | null }[]>();
  for (const inv of investors) {
    if (inv.category.freshness !== "fresh") continue;
    const key: RegionKey = inv.region ?? "unknown";
    const list = groups.get(key) ?? [];
    list.push({ inv, fund: latestFund(byInvestor.get(inv.id) ?? []) });
    groups.set(key, list);
  }
  const bars: RegionCapitalBar[] = ORDER.map((region) => {
    const list = groups.get(region) ?? [];
    const sized = list.filter((x) => x.fund?.size_usd != null);
    return {
      region,
      investors: list.length,
      capitalUsd:
        list.length === 0
          ? 0
          : sized.length === 0
            ? null
            : sized.reduce((a, x) => a + (x.fund?.size_usd ?? 0), 0),
      withoutSize: list.length - sized.length,
      ...provenanceOf(sized.flatMap((x) => (x.fund ? [x.fund] : []))),
    };
  });
  const known = bars.filter((b) => b.capitalUsd !== null);
  const sizedFunds = [...groups.values()]
    .flat()
    .flatMap((x) => (x.fund?.size_usd != null ? [x.fund] : []));
  return {
    bars,
    totalUsd: known.length === 0 ? null : known.reduce((a, b) => a + (b.capitalUsd ?? 0), 0),
    freshInvestors: bars.reduce((a, b) => a + b.investors, 0),
    notShown: bars.reduce((a, b) => a + b.withoutSize, 0),
    sources: topDomains(sizedFunds, 4),
  };
}
