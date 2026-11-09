/**
 * Target customers (the Customers page): rows for the table, the filters, and per-option
 * counts for the filter chips. Pure; the page passes records from src/lib/data.
 */
import {
  CUSTOMER_AREAS,
  CUSTOMER_REVENUE_BANDS,
  CUSTOMER_SECTORS,
  CUSTOMER_TEAM_BANDS,
  type CustomerArea,
  type CustomerList,
  type CustomerRevenueBand,
  type CustomerSector,
  type CustomerTeamBand,
} from "@/lib/schema/enums";
import type { Competitor, TargetCustomer } from "@/lib/schema";

export const CUSTOMER_TIERS = ["1", "2", "3"] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export type CustomerRow = {
  id: string;
  name: string;
  list: CustomerList;
  tier: CustomerTier;
  category: string;
  sectors: readonly CustomerSector[];
  revenueBand: CustomerRevenueBand | null;
  teamBand: CustomerTeamBand | null;
  address: string | null;
  areas: readonly CustomerArea[];
  /** The same company on the other list. */
  alsoListed: readonly { id: string; list: CustomerList }[];
  /** Competitors that publicly name this company (or its group) as a customer. */
  competitors: readonly { id: string; name: string }[];
};

export function toCustomerRows(
  customers: readonly TargetCustomer[],
  competitors: readonly Pick<Competitor, "id" | "name">[],
): CustomerRow[] {
  const compName = new Map(competitors.map((c) => [c.id, c.name]));
  const listOf = new Map(customers.map((c) => [c.id, c.list]));
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    list: c.list,
    tier: String(c.tier) as CustomerTier,
    category: c.category,
    sectors: c.sectors,
    revenueBand: c.revenue_band,
    teamBand: c.team_band,
    address: c.address,
    areas: c.areas,
    alsoListed: c.also_listed_ids.flatMap((id) => {
      const list = listOf.get(id);
      return list ? [{ id, list }] : [];
    }),
    competitors: c.competitor_ids
      .map((id) => ({ id, name: compName.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** Within a filter any selected value passes (OR); across filters all must pass (AND). */
export type CustomerFilters = {
  list: CustomerList | null;
  tier: readonly CustomerTier[];
  area: readonly CustomerArea[];
  sector: readonly CustomerSector[];
  revenue: readonly CustomerRevenueBand[];
  team: readonly CustomerTeamBand[];
  /** Only companies a competitor already names as a customer. */
  rivals: boolean;
};

export const NO_CUSTOMER_FILTERS: CustomerFilters = {
  list: null,
  tier: [],
  area: [],
  sector: [],
  revenue: [],
  team: [],
  rivals: false,
};

export type CustomerFacet = Exclude<keyof CustomerFilters, "list" | "rivals">;

export function hasCustomerFilters(f: CustomerFilters): boolean {
  return (
    f.list !== null ||
    f.rivals ||
    f.tier.length > 0 ||
    f.area.length > 0 ||
    f.sector.length > 0 ||
    f.revenue.length > 0 ||
    f.team.length > 0
  );
}

const anyOf = <T>(selected: readonly T[], values: readonly T[]) =>
  selected.length === 0 || values.some((v) => selected.includes(v));

function passes(r: CustomerRow, f: CustomerFilters, skip?: keyof CustomerFilters): boolean {
  return (
    (skip === "list" || f.list === null || r.list === f.list) &&
    (skip === "tier" || anyOf(f.tier, [r.tier])) &&
    (skip === "area" || anyOf(f.area, r.areas)) &&
    (skip === "sector" || anyOf(f.sector, r.sectors)) &&
    (skip === "revenue" || anyOf(f.revenue, r.revenueBand ? [r.revenueBand] : [])) &&
    (skip === "team" || anyOf(f.team, r.teamBand ? [r.teamBand] : [])) &&
    (skip === "rivals" || !f.rivals || r.competitors.length > 0)
  );
}

export function filterCustomers(rows: readonly CustomerRow[], f: CustomerFilters): CustomerRow[] {
  return rows.filter((r) => passes(r, f));
}

const FACET_VALUES = {
  tier: CUSTOMER_TIERS,
  area: CUSTOMER_AREAS,
  sector: CUSTOMER_SECTORS,
  revenue: CUSTOMER_REVENUE_BANDS,
  team: CUSTOMER_TEAM_BANDS,
} as const;

function valuesOf(r: CustomerRow, facet: CustomerFacet): readonly string[] {
  switch (facet) {
    case "tier":
      return [r.tier];
    case "area":
      return r.areas;
    case "sector":
      return r.sectors;
    case "revenue":
      return r.revenueBand ? [r.revenueBand] : [];
    case "team":
      return r.teamBand ? [r.teamBand] : [];
  }
}

export type CustomerFacetCounts = {
  [K in CustomerFacet]: Record<(typeof FACET_VALUES)[K][number], number>;
} & { list: Record<CustomerList | "all", number>; rivals: number };

/**
 * For each option, the rows shown if that option alone were picked in its own filter (the
 * other filters as they are). A company in two areas counts in both.
 */
export function customerFacetCounts(
  rows: readonly CustomerRow[],
  f: CustomerFilters,
): CustomerFacetCounts {
  const out = {} as CustomerFacetCounts;
  for (const facet of Object.keys(FACET_VALUES) as CustomerFacet[]) {
    const counts: Record<string, number> = Object.fromEntries(
      FACET_VALUES[facet].map((v) => [v, 0]),
    );
    for (const r of rows) {
      if (!passes(r, f, facet)) continue;
      for (const v of new Set(valuesOf(r, facet))) counts[v] = (counts[v] ?? 0) + 1;
    }
    (out as Record<string, unknown>)[facet] = counts;
  }
  const byList = rows.filter((r) => passes(r, f, "list"));
  out.list = {
    all: byList.length,
    mumbai_pune: byList.filter((r) => r.list === "mumbai_pune").length,
    bengaluru: byList.filter((r) => r.list === "bengaluru").length,
  };
  out.rivals = rows.filter((r) => passes(r, { ...f, rivals: true })).length;
  return out;
}

/** What the find box matches: the name, with category, address and competitor names as aliases. */
export function customerSearchText(r: CustomerRow) {
  return {
    name: r.name,
    aliases: [r.category, r.address, ...r.competitors.map((c) => c.name)],
  };
}
