/**
 * Target customers (the Customers page): rows for the table, the filters, and per-option
 * counts for the filter chips. Pure; the page passes records from src/lib/data.
 */
import {
  CUSTOMER_AREAS,
  CUSTOMER_LISTS,
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

/** Archetype fit as a filter value: lists that do not grade fit read "ungraded". */
export const CUSTOMER_FIT_VALUES = ["high", "medium", "ungraded"] as const;
export type CustomerFitValue = (typeof CUSTOMER_FIT_VALUES)[number];

export type CustomerRow = {
  id: string;
  name: string;
  list: CustomerList;
  tier: CustomerTier;
  category: string;
  sectors: readonly CustomerSector[];
  revenueBand: CustomerRevenueBand | null;
  teamBand: CustomerTeamBand | null;
  /**
   * What the cell says beyond its band: the bracketed qualifier ("est.", "₹603 Cr FY26"), or
   * the whole cell when there is no band ("Not public"). Null when the band says it all.
   */
  revenueNote: string | null;
  teamNote: string | null;
  address: string | null;
  areas: readonly CustomerArea[];
  fit: CustomerFitValue;
  archetype: string | null;
  subSegment: string | null;
  whatTheyMake: string | null;
  whyFit: string | null;
  sizeBasis: string | null;
  /** The same company on another list. */
  alsoListed: readonly { id: string; list: CustomerList }[];
  /** Competitors that publicly name this company (or its group) as a customer. */
  competitors: readonly { id: string; name: string }[];
};

/** The part of a size cell the band does not carry. */
export function sizeNote(asListed: string | null, band: string | null): string | null {
  if (!asListed) return null;
  if (!band) return asListed;
  const bracket = /\((.*)\)\s*$/.exec(asListed);
  return bracket ? bracket[1]!.trim() : null;
}

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
    revenueNote: sizeNote(c.revenue_as_listed, c.revenue_band),
    teamNote: sizeNote(c.team_as_listed, c.team_band),
    address: c.address,
    areas: c.areas,
    fit: c.archetype_fit ?? "ungraded",
    archetype: c.archetype,
    subSegment: c.sub_segment,
    whatTheyMake: c.what_they_make,
    whyFit: c.why_fit,
    sizeBasis: c.size_basis,
    alsoListed: c.also_listed_ids.flatMap((id) => {
      const list = listOf.get(id);
      return list ? [{ id, list }] : [];
    }),
    competitors: c.competitor_ids
      .map((id) => ({ id, name: compName.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** Whether a row has anything for its details panel. */
export const hasCustomerDetails = (r: CustomerRow) =>
  Boolean(r.whatTheyMake || r.whyFit || r.subSegment || r.sizeBasis);

/** Within a filter any selected value passes (OR); across filters all must pass (AND). */
export type CustomerFilters = {
  list: CustomerList | null;
  tier: readonly CustomerTier[];
  fit: readonly CustomerFitValue[];
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
  fit: [],
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
    f.fit.length > 0 ||
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
    (skip === "fit" || anyOf(f.fit, [r.fit])) &&
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
  fit: CUSTOMER_FIT_VALUES,
  area: CUSTOMER_AREAS,
  sector: CUSTOMER_SECTORS,
  revenue: CUSTOMER_REVENUE_BANDS,
  team: CUSTOMER_TEAM_BANDS,
} as const;

function valuesOf(r: CustomerRow, facet: CustomerFacet): readonly string[] {
  switch (facet) {
    case "tier":
      return [r.tier];
    case "fit":
      return [r.fit];
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
    ...(Object.fromEntries(
      CUSTOMER_LISTS.map((l) => [l, byList.filter((r) => r.list === l).length]),
    ) as Record<CustomerList, number>),
  };
  out.rivals = rows.filter((r) => passes(r, { ...f, rivals: true })).length;
  return out;
}

/**
 * What the find box matches: the name, then (as aliases) category, sub-segment, what the
 * company makes, address and competitor names.
 */
export function customerSearchText(r: CustomerRow) {
  return {
    name: r.name,
    aliases: [
      r.category,
      r.subSegment,
      r.whatTheyMake,
      r.address,
      ...r.competitors.map((c) => c.name),
    ],
  };
}
