/**
 * The global investor filters: one state shape, one filter function, one
 * facet-count function. The Directory, the chips in the filter bar and later
 * charts all call these, so a count on a chip is the number of rows the
 * Directory shows when that chip is selected.
 *
 * Pure and client-safe: no data access here.
 */
import {
  FRESHNESS,
  INVESTOR_STAGES,
  INVESTOR_TYPES,
  MATURITY,
  REGIONS,
  RESEARCH_TIERS,
  SECTORS,
  type Freshness,
  type InvestorStage,
  type InvestorType,
  type Maturity,
  type Region,
  type ResearchTier,
  type Sector,
} from "@/lib/schema/enums";
import {
  FRESHNESS_LABELS,
  INVESTOR_STAGE_LABELS,
  INVESTOR_TYPE_LABELS,
  MATURITY_LABELS,
  REGION_LABELS,
  SECTOR_LABELS,
  TIER_LABELS,
} from "@/lib/format/labels";

/**
 * Tag values the pipeline writes to `user_tags` today: one per group of the 2026-11-01
 * physical-AI list, and one for the 2026-11-12 "VC investing in India" list.
 */
export const USER_TAGS = [
  "Robotics and hard-tech",
  "Emerging and specialist",
  "Big names",
  "Strategic and corporate",
  "VC investing in India",
] as const;
export type UserTag = (typeof USER_TAGS)[number];

export const FILTER_KEYS = [
  "region",
  "stage",
  "type",
  "freshness",
  "maturity",
  "sector",
  "tier",
  "tag",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** Selected values per filter. Empty means no restriction; values within one filter are OR-ed. */
export type FilterState = {
  region: Region[];
  stage: InvestorStage[];
  type: InvestorType[];
  freshness: Freshness[];
  maturity: Maturity[];
  sector: Sector[];
  tier: ResearchTier[];
  tag: UserTag[];
};

/** Western is the default view; India is one click away, not hidden (PROJECT_CONTEXT §2). */
export const DEFAULT_FILTER_STATE: FilterState = {
  region: ["western"],
  stage: [],
  type: [],
  freshness: [],
  maturity: [],
  sector: [],
  tier: [],
  tag: [],
};

/** An investor sector counts toward the sector filter at this thesis weight or higher. */
export const SECTOR_MATCH_MIN = 0.15;

/** The fields the filters read. Built once per investor on the server. */
export type FilterableInvestor = {
  id: string;
  region: Region | null;
  stages: InvestorStage[];
  type: InvestorType | null;
  freshness: Freshness | null;
  maturity: Maturity | null;
  sectors: Sector[];
  tier: ResearchTier | null;
  /** The user's own tags (a list's group); empty when untagged. */
  tags: UserTag[];
};

export type FilterDef = {
  key: FilterKey;
  label: string;
  options: readonly { value: string; label: string }[];
};

const opts = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

export const FILTER_DEFS: readonly FilterDef[] = [
  { key: "region", label: "Region", options: opts(REGIONS, REGION_LABELS) },
  { key: "stage", label: "Stage", options: opts(INVESTOR_STAGES, INVESTOR_STAGE_LABELS) },
  { key: "type", label: "Type", options: opts(INVESTOR_TYPES, INVESTOR_TYPE_LABELS) },
  { key: "freshness", label: "Fund age", options: opts(FRESHNESS, FRESHNESS_LABELS) },
  { key: "maturity", label: "Maturity", options: opts(MATURITY, MATURITY_LABELS) },
  { key: "sector", label: "Sector", options: opts(SECTORS, SECTOR_LABELS) },
  { key: "tier", label: "Research tier", options: opts(RESEARCH_TIERS, TIER_LABELS) },
  { key: "tag", label: "Tag", options: USER_TAGS.map((t) => ({ value: t, label: t })) },
];

/** The values a row has for one filter. Several for stages and sectors; none when unknown. */
export function valuesOf(row: FilterableInvestor, key: FilterKey): readonly string[] {
  switch (key) {
    case "region":
      return row.region ? [row.region] : [];
    case "stage":
      return row.stages;
    case "type":
      return row.type ? [row.type] : [];
    case "freshness":
      return row.freshness ? [row.freshness] : [];
    case "maturity":
      return row.maturity ? [row.maturity] : [];
    case "sector":
      return row.sectors;
    case "tier":
      return row.tier ? [row.tier] : [];
    case "tag":
      return row.tags;
  }
}

function matchesKey(row: FilterableInvestor, key: FilterKey, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  // Unknown never matches an active filter.
  return valuesOf(row, key).some((v) => selected.includes(v));
}

/** Rows that satisfy every filter, optionally skipping one key (for facet counts). */
export function applyFilters<T extends FilterableInvestor>(
  rows: readonly T[],
  state: FilterState,
  skip?: FilterKey,
): T[] {
  return rows.filter((row) =>
    FILTER_KEYS.every((key) => key === skip || matchesKey(row, key, state[key])),
  );
}

export type FacetCounts = Record<FilterKey, Record<string, number>>;

/**
 * For each option of each filter: how many rows the list would show if that
 * option alone were selected in its filter and every other filter stayed as is.
 */
export function facetCounts(rows: readonly FilterableInvestor[], state: FilterState): FacetCounts {
  const out = {} as FacetCounts;
  for (const def of FILTER_DEFS) {
    const counts: Record<string, number> = Object.fromEntries(def.options.map((o) => [o.value, 0]));
    for (const row of applyFilters(rows, state, def.key)) {
      for (const v of new Set(valuesOf(row, def.key))) {
        if (v in counts) counts[v] = (counts[v] ?? 0) + 1;
      }
    }
    out[def.key] = counts;
  }
  return out;
}

export function isDefaultState(state: FilterState): boolean {
  return FILTER_KEYS.every((key) => sameSet(state[key], DEFAULT_FILTER_STATE[key]));
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

const STAGE_SHORT: Record<InvestorStage, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "A",
  series_b: "B",
  series_c_plus: "C+",
  growth: "Growth",
};

/** "Seed–A" for a contiguous run of stages, otherwise a count. */
export function summarizeStages(stages: readonly InvestorStage[]): string {
  if (stages.length === 1) return INVESTOR_STAGE_LABELS[stages[0]!];
  const idx = stages.map((s) => INVESTOR_STAGES.indexOf(s)).sort((a, b) => a - b);
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1]! + 1);
  if (contiguous) {
    return `${STAGE_SHORT[INVESTOR_STAGES[idx[0]!]!]}–${STAGE_SHORT[INVESTOR_STAGES[idx[idx.length - 1]!]!]}`;
  }
  return `${stages.length} stages`;
}

const PLURAL: Record<FilterKey, string> = {
  region: "regions",
  stage: "stages",
  type: "types",
  freshness: "fund ages",
  maturity: "maturities",
  sector: "sectors",
  tier: "tiers",
  tag: "tags",
};

function summarizeKey(key: FilterKey, state: FilterState): string {
  const values = state[key];
  const def = FILTER_DEFS.find((d) => d.key === key)!;
  const label = (v: string) => def.options.find((o) => o.value === v)?.label ?? v;
  if (key === "stage") return summarizeStages(state.stage);
  if (key === "freshness" && values.length === 1) {
    return values[0] === "fresh" ? "Fresh funds" : label(values[0]!);
  }
  if (values.length === 1) return label(values[0]!);
  return `${values.length} ${PLURAL[key]}`;
}

/** "Western · Seed–A · Fresh funds · 3 more". Shows up to `shown` active filters. */
export function summarizeFilters(state: FilterState, shown = 3): string {
  const active = FILTER_KEYS.filter((k) => state[k].length > 0);
  if (active.length === 0) return "All investors";
  const parts = active.slice(0, shown).map((k) => summarizeKey(k, state));
  const more = active.length - shown;
  if (more > 0) parts.push(`${more} more`);
  return parts.join(" · ");
}
