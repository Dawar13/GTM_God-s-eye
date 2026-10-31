/**
 * One investor's deal graph from `rounds.json`: portfolio companies, co-investors and the
 * tracked competitors they backed. All three come from the same pass, so their counts agree.
 */
import type { Round } from "@/lib/schema";
import type { CompetitorLayer, RoundStage } from "@/lib/schema/enums";

export type DealRole = "lead" | "participant" | "unspecified";
const ROLE_RANK: Record<DealRole, number> = { lead: 0, participant: 1, unspecified: 2 };

export type PortfolioRow = {
  companyId: string;
  name: string;
  isCompetitor: boolean;
  rounds: number;
  /** The strongest role across their rounds: lead, then participant, then unspecified. */
  role: DealRole;
  /** Date of the latest dated round (as stored: year, quarter, month or day); null if none is dated. */
  latestDate: string | null;
  /** Stage and round size of that round; of the first listed round when none is dated. */
  latestStage: RoundStage;
  latestAmountUsd: number | null;
};

export type CoInvestor = { id: string; name: string; shared: number };

export type CompetitorExposure = {
  id: string;
  name: string;
  layer: CompetitorLayer;
  rounds: number;
  role: DealRole;
  latestDate: string | null;
};

export type InvestorDeals = {
  portfolio: PortfolioRow[];
  /** Distinct investors who shared at least one round (named ones only). */
  coInvestorTotal: number;
  /** Top by shared rounds, then name. */
  coInvestors: CoInvestor[];
  competitors: CompetitorExposure[];
  /** Rounds the investor appears in. */
  roundCount: number;
};

export const CO_INVESTOR_LIMIT = 10;

export type DealCompany = { id: string; name: string };
export type DealCompetitor = DealCompany & { layer: CompetitorLayer };

function roleIn(r: Round, id: string): DealRole | null {
  if (r.lead_investor_ids.includes(id)) return "lead";
  if (r.participant_investor_ids.includes(id)) return "participant";
  if (r.unspecified_investor_ids.includes(id)) return "unspecified";
  return null;
}

const allInvestors = (r: Round) => [
  ...r.lead_investor_ids,
  ...r.participant_investor_ids,
  ...r.unspecified_investor_ids,
];

/** A round is later than another if it has a date and the other has none, or a later date string. */
function isLater(a: Round, b: Round): boolean {
  if (a.date === null) return false;
  return b.date === null || a.date > b.date;
}

/**
 * Co-investor = another investor named in any role in a round this investor is in; "shared"
 * counts distinct rounds (a company's seed and Series A both count). Competitors are the
 * `competitors` records among the portfolio companies.
 */
export function investorDeals(
  investorId: string,
  rounds: readonly Round[],
  companies: ReadonlyMap<string, DealCompany>,
  competitors: ReadonlyMap<string, DealCompetitor>,
  investorNames: ReadonlyMap<string, string>,
): InvestorDeals {
  const byCompany = new Map<string, { rounds: Round[]; role: DealRole }>();
  const shared = new Map<string, Set<string>>();
  let roundCount = 0;
  for (const r of rounds) {
    const role = roleIn(r, investorId);
    if (role === null) continue;
    roundCount += 1;
    const entry = byCompany.get(r.company_id) ?? { rounds: [], role };
    entry.rounds.push(r);
    if (ROLE_RANK[role] < ROLE_RANK[entry.role]) entry.role = role;
    byCompany.set(r.company_id, entry);
    for (const other of allInvestors(r)) {
      if (other === investorId) continue;
      const set = shared.get(other) ?? new Set<string>();
      set.add(r.id);
      shared.set(other, set);
    }
  }

  const portfolio: PortfolioRow[] = [];
  const exposure: CompetitorExposure[] = [];
  for (const [companyId, entry] of byCompany) {
    const co = competitors.get(companyId) ?? companies.get(companyId);
    const name = co?.name ?? companyId;
    let latest = entry.rounds[0]!;
    for (const r of entry.rounds) if (isLater(r, latest)) latest = r;
    portfolio.push({
      companyId,
      name,
      isCompetitor: competitors.has(companyId),
      rounds: entry.rounds.length,
      role: entry.role,
      latestDate: latest.date,
      latestStage: latest.stage,
      latestAmountUsd: latest.amount_usd,
    });
    const comp = competitors.get(companyId);
    if (comp) {
      exposure.push({
        id: companyId,
        name,
        layer: comp.layer,
        rounds: entry.rounds.length,
        role: entry.role,
        latestDate: latest.date,
      });
    }
  }
  portfolio.sort((a, b) => a.name.localeCompare(b.name));
  exposure.sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name));

  const named = [...shared.entries()]
    .map(([id, set]) => ({ id, name: investorNames.get(id) ?? null, shared: set.size }))
    .filter((c): c is CoInvestor => c.name !== null)
    .sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name));

  return {
    portfolio,
    coInvestorTotal: named.length,
    coInvestors: named.slice(0, CO_INVESTOR_LIMIT),
    competitors: exposure,
    roundCount,
  };
}

export const PORTFOLIO_SORT_KEYS = ["name", "rounds", "role", "latest", "amount"] as const;
export type PortfolioSortKey = (typeof PORTFOLIO_SORT_KEYS)[number];

/** Portfolio rows sorted by a column. Unknown dates and amounts always sort last. */
export function sortPortfolio(
  rows: readonly PortfolioRow[],
  key: PortfolioSortKey,
  dir: "asc" | "desc",
): PortfolioRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const value = (r: PortfolioRow): string | number | null => {
    switch (key) {
      case "name":
        return r.name;
      case "rounds":
        return r.rounds;
      case "role":
        return ROLE_RANK[r.role];
      case "latest":
        return r.latestDate;
      case "amount":
        return r.latestAmountUsd;
    }
  };
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) {
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "en");
      if (c !== 0) return sign * c;
    }
    return a.name.localeCompare(b.name, "en");
  });
}
