import type { Fund } from "@/lib/schema";
import type { Confidence } from "@/lib/schema";
import { isFreshFund, provenanceOf, topDomains } from "./common";

export type FundYearBar = {
  year: number;
  fresh: number;
  older: number;
  total: number;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type FundsByYear = {
  bars: FundYearBar[];
  /** Funds counted in the bars. */
  counted: number;
  /** Funds of the selected investors with no close date. */
  notShown: number;
  sources: string[];
};

/**
 * Funds of the given investors, counted by the year of their close date and split fresh /
 * older by the pipeline's rule (closed on or after the freshness cutoff). Years with no fund
 * between the first and last are real zeros and stay in the series.
 */
export function fundsByYear(funds: readonly Fund[], investorIds: ReadonlySet<string>): FundsByYear {
  const byYear = new Map<number, Fund[]>();
  let notShown = 0;
  const counted: Fund[] = [];
  for (const f of funds) {
    if (!investorIds.has(f.investor_id)) continue;
    const year = f.close_date === null ? null : Number(f.close_date.slice(0, 4));
    if (year === null) {
      notShown += 1;
      continue;
    }
    counted.push(f);
    const list = byYear.get(year) ?? [];
    list.push(f);
    byYear.set(year, list);
  }
  const years = [...byYear.keys()];
  const bars: FundYearBar[] = [];
  if (years.length > 0) {
    for (let y = Math.min(...years); y <= Math.max(...years); y += 1) {
      const list = byYear.get(y) ?? [];
      const fresh = list.filter((f) => isFreshFund(f) === true).length;
      bars.push({
        year: y,
        fresh,
        older: list.length - fresh,
        total: list.length,
        ...provenanceOf(list),
      });
    }
  }
  return { bars, counted: counted.length, notShown, sources: topDomains(counted, 4) };
}
