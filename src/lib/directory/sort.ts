/**
 * Directory sort: one pure function, one URL contract (`?sort=fit-desc`).
 * Unknown values always sort last, in either direction, so a missing field never
 * reads as the smallest or the largest. For the fit column, investors the pipeline
 * flagged `sparse` come after every other scored investor in both directions: their
 * score is rescaled over two or three known features and would otherwise top a
 * descending list (the S2 chart leaves them out for the same reason).
 */
import type { DirectoryRow } from "@/lib/data/directory";
import { INVESTOR_STAGES } from "@/lib/schema/enums";

export const SORT_COLUMNS = [
  "name",
  "type",
  "region",
  "stages",
  "check",
  "fund",
  "freshness",
  "tier",
  "fit",
  "sources",
  "tags",
  "seedLists",
  "confidence",
] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDir = "asc" | "desc";

export const SORT_KEYS = SORT_COLUMNS.flatMap((c) => [`${c}-asc`, `${c}-desc`] as const);
export type SortKey = `${SortColumn}-${SortDir}`;

export const DEFAULT_SORT: SortKey = "name-asc";
export const SORT_PARAM = "sort";

export function parseSortKey(key: SortKey): { column: SortColumn; dir: SortDir } {
  const i = key.lastIndexOf("-");
  return { column: key.slice(0, i) as SortColumn, dir: key.slice(i + 1) as SortDir };
}

export function sortKeyOf(column: SortColumn, dir: SortDir): SortKey {
  return `${column}-${dir}`;
}

const FRESHNESS_ORDER = { fresh: 0, older: 1, unknown: 2 } as const;
const TIER_ORDER = { A: 0, B: 1, C: 2 } as const;
const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

/** The value a column sorts by; null = unknown (sorts last). Text columns return strings. */
function sortValue(row: DirectoryRow, column: SortColumn): number | string | null {
  switch (column) {
    case "name":
      return row.name;
    case "type":
      return row.type;
    case "region":
      return row.region;
    case "stages": {
      // Earliest stage they write: investors who start earliest lead an ascending sort.
      if (row.stages.length === 0) return null;
      return Math.min(...row.stages.map((s) => INVESTOR_STAGES.indexOf(s)));
    }
    case "check":
      // The upper end of the range, the largest check they write.
      return row.checkMaxUsd ?? row.checkMinUsd;
    case "fund":
      return row.latestFundSizeUsd;
    case "freshness":
      return row.freshness === null || row.freshness === "unknown"
        ? null
        : FRESHNESS_ORDER[row.freshness];
    case "tier":
      return row.tier === null ? null : TIER_ORDER[row.tier];
    case "fit":
      return row.fit;
    case "tags":
      return row.tags.length ? row.tags.join("; ") : null;
    case "sources":
      return row.sourceCount;
    case "seedLists":
      return row.seedListCount;
    case "confidence":
      return CONFIDENCE_ORDER[row.confidence];
  }
}

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en");
}

/** A new array, sorted. Ties fall back to name, then id, so the order is stable. */
export function sortRows(rows: readonly DirectoryRow[], key: SortKey): DirectoryRow[] {
  const { column, dir } = parseSortKey(key);
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (column === "fit") {
      // Reliable scores, then sparse ones, then no score; whatever the direction.
      const ra = a.fit === null ? 2 : a.fitFlags.includes("sparse") ? 1 : 0;
      const rb = b.fit === null ? 2 : b.fitFlags.includes("sparse") ? 1 : 0;
      if (ra !== rb) return ra - rb;
    }
    const va = sortValue(a, column);
    const vb = sortValue(b, column);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null) {
      const c = compareValues(va, vb);
      if (c !== 0) return sign * c;
    }
    return a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id);
  });
}
