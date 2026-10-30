/**
 * URL contract for the filters, shared by the client hook and the tests.
 * Each filter is a comma-separated list: `?region=western,india&stage=seed`.
 * The default (Western only) is left out of the URL; deselecting everything in
 * a filter that has a default is written as an empty value (`?region=`).
 */
import { createLoader, createSerializer, parseAsArrayOf, parseAsStringLiteral } from "nuqs/server";
import {
  FRESHNESS,
  INVESTOR_STAGES,
  INVESTOR_TYPES,
  MATURITY,
  REGIONS,
  RESEARCH_TIERS,
  SECTORS,
} from "@/lib/schema/enums";
import { DEFAULT_FILTER_STATE, type FilterState } from "./index";

const list = <T extends string>(values: readonly T[]) =>
  parseAsArrayOf(parseAsStringLiteral(values));

export const filterParsers = {
  region: list(REGIONS).withDefault([...DEFAULT_FILTER_STATE.region]),
  stage: list(INVESTOR_STAGES).withDefault([]),
  type: list(INVESTOR_TYPES).withDefault([]),
  freshness: list(FRESHNESS).withDefault([]),
  maturity: list(MATURITY).withDefault([]),
  sector: list(SECTORS).withDefault([]),
  tier: list(RESEARCH_TIERS).withDefault([]),
};

export const filterUrlOptions = { clearOnDefault: true, history: "replace", scroll: false } as const;

const load = createLoader(filterParsers);
const serialize = createSerializer(filterParsers, { clearOnDefault: true });

/** Parse a query string (or URLSearchParams) into filter state. Unknown values are dropped. */
export function parseFilters(search: string | URLSearchParams): FilterState {
  return load(search) as FilterState;
}

/** Filter state to a query string ("" when it is the default), without the leading "?". */
export function serializeFilters(state: FilterState): string {
  return serialize(state).replace(/^\?/, "");
}
