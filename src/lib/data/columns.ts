/**
 * Column-wise JSON for the investor row lists the browser loads from /api: one array per
 * field instead of one object per row, so the field names are not repeated 3,300 times
 * (about half the bytes of the row-object form). Pure, so route handlers and the client
 * share it.
 */
import type { FilterableInvestor } from "@/lib/filters";

export type Columns<T> = { [K in keyof T]: T[K][] };

/** The named fields of `rows`, one array per field, in row order. */
export function toColumns<T extends object, K extends keyof T>(
  rows: readonly T[],
  keys: readonly K[],
): Columns<Pick<T, K>> {
  const out = {} as Columns<Pick<T, K>>;
  for (const k of keys) out[k] = rows.map((r) => r[k]);
  return out;
}

/** Rows back from `toColumns`. Throws when the columns differ in length. */
export function fromColumns<T extends object>(cols: Columns<T>): T[] {
  const keys = Object.keys(cols) as (keyof T)[];
  const n = keys.length ? cols[keys[0]!].length : 0;
  for (const k of keys) {
    if (cols[k].length !== n) throw new Error(`column ${String(k)} has ${cols[k].length} of ${n} values`);
  }
  const rows = new Array<T>(n);
  for (let i = 0; i < n; i++) {
    const row = {} as T;
    for (const k of keys) row[k] = cols[k][i]!;
    rows[i] = row;
  }
  return rows;
}

/** The fields the global filters read; the filter index ships these. */
export const FILTERABLE_KEYS = [
  "id",
  "region",
  "stages",
  "type",
  "freshness",
  "maturity",
  "sectors",
  "tier",
] as const satisfies readonly (keyof FilterableInvestor)[];

/** A view's row without the filter fields, which the client takes from the filter index. */
export type Detail<T extends FilterableInvestor> = Omit<T, Exclude<keyof FilterableInvestor, "id">>;

/**
 * A view's rows: each detail row joined by id to its filter fields from the filter index.
 * Both lists come from the same investors file; an id missing from the index gets unknown
 * filter fields (it then fails every active filter, as unknown values do).
 */
export function joinFilterable<T extends FilterableInvestor>(
  index: readonly FilterableInvestor[],
  detail: readonly Detail<T>[],
): T[] {
  const byId = new Map(index.map((r) => [r.id, r]));
  return detail.map((d) => {
    const f = byId.get(d.id) ?? {
      id: d.id,
      region: null,
      stages: [],
      type: null,
      freshness: null,
      maturity: null,
      sectors: [],
      tier: null,
    };
    return { ...f, ...d } as T;
  });
}
