import type { Fund, Investor, Region } from "@/lib/schema";

export type DirectoryRow = {
  id: string;
  name: string;
  region: Region | null;
  latestFundSizeUsd: number | null;
  latestFundYear: number | null;
  seedListCount: number;
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
): DirectoryRow[] {
  const fundsByInvestor = new Map<string, Fund[]>();
  for (const f of funds) {
    const list = fundsByInvestor.get(f.investor_id) ?? [];
    list.push(f);
    fundsByInvestor.set(f.investor_id, list);
  }
  return investors.map((inv) => {
    const latest = latestFund(fundsByInvestor.get(inv.id) ?? []);
    return {
      id: inv.id,
      name: inv.name,
      region: inv.region,
      latestFundSizeUsd: latest?.size_usd ?? null,
      latestFundYear: latest?.vintage_year ?? null,
      seedListCount: inv.seed_list_count,
    };
  });
}
