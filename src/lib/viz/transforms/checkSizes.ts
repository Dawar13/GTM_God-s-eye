/**
 * Check sizes (2026-11-13): one row per investor with a check range, on a log scale.
 * A researched range (`check_min_usd` / `check_max_usd`, cited) wins; otherwise the range a
 * user list states as figures (`seed_hints[].listed_check_usd`), which stays a hint and is
 * drawn as one. Rows are built on the server; the view runs on the client as filters change.
 */
import { applyFilters, type FilterableInvestor, type FilterState } from "@/lib/filters";
import { latestFund, toFilterable } from "@/lib/data/directory";
import { formatUsd, UNKNOWN } from "@/lib/format";
import { SEED_LIST_LABELS } from "@/lib/format/labels";
import type { Confidence, Fund, Investor, SeedHint } from "@/lib/schema";
import { domainOf } from "./common";

export type CheckBasis = "researched" | "listed";

export type CheckRow = FilterableInvestor & {
  name: string;
  basis: CheckBasis;
  /** Smallest and largest check, US$. One may be null when the source gives one bound. */
  min: number | null;
  max: number | null;
  /** Middle half of recent checks, when a list gives the percentiles. */
  p25: number | null;
  p75: number | null;
  /** The list the range comes from (listed rows), and its own words for it. */
  list: string | null;
  listedText: string | null;
  /** The source calls these first checks (Map of the Money's axis is "First Cheque Size"). */
  firstCheck: boolean;
  /** Latest fund on record; else the fund size a list states (`fundListed`). */
  fundUsd: number | null;
  fundListed: boolean;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type CheckData = {
  rows: CheckRow[];
  /** Smallest and largest figure among all rows (unfiltered), so the axis does not jump. */
  extent: [number, number] | null;
};

/** Lists whose figures are first checks, by the list's own wording. */
const FIRST_CHECK_LISTS = new Set(["map_of_the_money_singapore_list_2026_11_13"]);

type ListedHint = SeedHint & { listed_check_usd: NonNullable<SeedHint["listed_check_usd"]> };

/** The listed range to draw: one with percentiles first, then one with both ends. */
function bestListed(hints: readonly SeedHint[]): ListedHint | null {
  const withFigures = hints.filter(
    (h): h is ListedHint =>
      h.listed_check_usd !== undefined &&
      (h.listed_check_usd.min !== null || h.listed_check_usd.max !== null),
  );
  const rank = (h: ListedHint) =>
    (h.listed_check_usd.p25 !== null && h.listed_check_usd.p75 !== null ? 0 : 2) +
    (h.listed_check_usd.min !== null && h.listed_check_usd.max !== null ? 0 : 1);
  return [...withFigures].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

function citedDomain(inv: Investor, field: string): string | null {
  const idx = inv.field_sources[field]?.[0];
  const src = idx === undefined ? undefined : inv.sources[idx];
  return src ? domainOf(src.url) : null;
}

export function toCheckRows(investors: readonly Investor[], funds: readonly Fund[]): CheckData {
  const fundsBy = new Map<string, Fund[]>();
  for (const f of funds) fundsBy.set(f.investor_id, [...(fundsBy.get(f.investor_id) ?? []), f]);

  const rows: CheckRow[] = [];
  for (const inv of investors) {
    const listed = bestListed(inv.seed_hints);
    const researched = inv.check_min_usd !== null || inv.check_max_usd !== null;
    if (!researched && !listed) continue;
    const fund = latestFund(fundsBy.get(inv.id) ?? [])?.size_usd ?? null;
    const listedFund = inv.seed_hints.find((h) => h.listed_fund_size_usd)?.listed_fund_size_usd;
    const base = {
      ...toFilterable(inv),
      name: inv.name,
      fundUsd: fund ?? listedFund ?? null,
      fundListed: fund === null && listedFund !== undefined,
    };
    if (researched) {
      rows.push({
        ...base,
        basis: "researched",
        min: inv.check_min_usd,
        max: inv.check_max_usd,
        p25: null,
        p75: null,
        list: null,
        listedText: null,
        firstCheck: false,
        sourceDomain: citedDomain(inv, "check_min_usd") ?? citedDomain(inv, "check_max_usd"),
        confidence: inv.confidence,
      });
    } else if (listed) {
      const c = listed.listed_check_usd;
      rows.push({
        ...base,
        basis: "listed",
        min: c.min,
        max: c.max,
        p25: c.p25,
        p75: c.p75,
        list: SEED_LIST_LABELS[listed.source_id] ?? listed.source_id,
        listedText: listed.listed_check_or_fund,
        firstCheck: FIRST_CHECK_LISTS.has(listed.source_id),
        sourceDomain: "Your list",
        // A list's claim is never better than low confidence.
        confidence: "low",
      });
    }
  }
  const values = rows
    .flatMap((r) => [r.min, r.max])
    .filter((v): v is number => v !== null && v > 0);
  return {
    rows,
    extent: values.length ? [Math.min(...values), Math.max(...values)] : null,
  };
}

export type CheckOrder = "smallest" | "largest" | "name";
export type BasisFilter = "all" | CheckBasis;

const low = (r: CheckRow) => r.min ?? r.max ?? 0;
const high = (r: CheckRow) => r.max ?? r.min ?? 0;

export function sortChecks(rows: readonly CheckRow[], order: CheckOrder): CheckRow[] {
  const byName = (a: CheckRow, b: CheckRow) => a.name.localeCompare(b.name);
  return [...rows].sort((a, b) =>
    order === "name"
      ? byName(a, b)
      : order === "smallest"
        ? low(a) - low(b) || high(a) - high(b) || byName(a, b)
        : high(b) - high(a) || low(b) - low(a) || byName(a, b),
  );
}

export type CheckView = {
  rows: CheckRow[];
  /** Rows with a check range hidden by the URL filters or the basis switch. */
  filteredOut: number;
  /** Investors the Directory lists for these filters with no check range; null until known. */
  notShown: number | null;
  counts: Record<CheckBasis, number>;
  sources: string[];
};

export function checkView(
  data: CheckData,
  filters: FilterState,
  basis: BasisFilter,
  order: CheckOrder,
  universe?: readonly FilterableInvestor[] | null,
): CheckView {
  const matching = applyFilters(data.rows, filters);
  const rows = sortChecks(
    basis === "all" ? matching : matching.filter((r) => r.basis === basis),
    order,
  );
  let notShown: number | null = null;
  if (universe) {
    const withRange = new Set(data.rows.map((r) => r.id));
    notShown = applyFilters(universe, filters).filter((u) => !withRange.has(u.id)).length;
  }
  const sources = new Map<string, number>();
  for (const r of rows) {
    if (r.sourceDomain) sources.set(r.sourceDomain, (sources.get(r.sourceDomain) ?? 0) + 1);
  }
  return {
    rows,
    filteredOut: data.rows.length - rows.length,
    notShown,
    counts: {
      researched: matching.filter((r) => r.basis === "researched").length,
      listed: matching.filter((r) => r.basis === "listed").length,
    },
    sources: [...sources.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([d]) => d),
  };
}

/** 1, 2.5, 5 per decade: the axis ticks, read as "$250K", "$1M". */
const STEPS = [1, 2.5, 5];

function ticksBetween(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let decade = 10 ** Math.floor(Math.log10(lo)); decade <= hi; decade *= 10) {
    for (const s of STEPS) {
      const v = s * decade;
      if (v >= lo && v <= hi) out.push(v);
    }
  }
  return out;
}

/** Axis domain: the nearest 1 / 2.5 / 5 step at or outside the data, within $1K to $1B. */
export function checkDomain(extent: [number, number] | null): [number, number] {
  if (!extent) return [10_000, 10_000_000];
  const lo = Math.max(1_000, extent[0]);
  const hi = Math.min(1_000_000_000, Math.max(extent[1], lo * 10));
  const all = ticksBetween(1_000, 1_000_000_000);
  return [
    [...all].reverse().find((t) => t <= lo) ?? 1_000,
    all.find((t) => t >= hi) ?? 1_000_000_000,
  ];
}

export function checkTicks(domain: [number, number]): { value: number; major: boolean }[] {
  return ticksBetween(domain[0], domain[1]).map((value) => ({
    value,
    major: Number.isInteger(Math.log10(value)),
  }));
}

/** Axis label for a tick, keeping the 2.5 steps exact: 2500 -> "$2.5K", 2.5e6 -> "$2.5M". */
export function tickLabel(value: number): string {
  for (const [size, unit] of [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ] as const) {
    if (value >= size) return `$${Number((value / size).toFixed(2))}${unit}`;
  }
  return `$${value}`;
}

/** Position on the log axis as a share of its width (0–1), clamped to the axis. */
export function checkPosition(value: number, domain: [number, number]): number {
  const [lo, hi] = domain.map(Math.log10) as [number, number];
  const t = (Math.log10(Math.min(Math.max(value, domain[0]), domain[1])) - lo) / (hi - lo);
  return Math.round(t * 10_000) / 10_000;
}

/** "$50K to $300K", "from $10M", "up to $1M", or one figure when both ends match. */
export function rangeText(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return min === max ? formatUsd(min) : `${formatUsd(min)} to ${formatUsd(max)}`;
  }
  if (min !== null) return `from ${formatUsd(min)}`;
  if (max !== null) return `up to ${formatUsd(max)}`;
  return UNKNOWN;
}
