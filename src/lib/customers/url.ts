/**
 * URL contract for the Customers page filters. Keys carry a `c_` prefix so they never clash
 * with the investor filters (`tier`, `sector`), which stay in the URL across pages.
 * `?q=` is the find box text, so a link (the palette's, say) can open the page on a company.
 */
import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import {
  CUSTOMER_AREAS,
  CUSTOMER_LISTS,
  CUSTOMER_REVENUE_BANDS,
  CUSTOMER_SECTORS,
  CUSTOMER_TEAM_BANDS,
} from "@/lib/schema/enums";
import {
  CUSTOMER_FIT_VALUES,
  CUSTOMER_TIERS,
  type CustomerFilters,
} from "@/lib/viz/transforms/customers";

const list = <T extends string>(values: readonly T[]) =>
  parseAsArrayOf(parseAsStringLiteral(values)).withDefault([]);

export const customerParsers = {
  c_list: parseAsStringLiteral(CUSTOMER_LISTS),
  c_tier: list(CUSTOMER_TIERS),
  c_fit: list(CUSTOMER_FIT_VALUES),
  c_area: list(CUSTOMER_AREAS),
  c_sector: list(CUSTOMER_SECTORS),
  c_rev: list(CUSTOMER_REVENUE_BANDS),
  c_team: list(CUSTOMER_TEAM_BANDS),
  c_rival: parseAsBoolean.withDefault(false),
  q: parseAsString.withDefault(""),
};

export const customerUrlOptions = {
  clearOnDefault: true,
  history: "replace",
  scroll: false,
} as const;

export type CustomerUrlState = {
  c_list: CustomerFilters["list"];
  c_tier: CustomerFilters["tier"];
  c_fit: CustomerFilters["fit"];
  c_area: CustomerFilters["area"];
  c_sector: CustomerFilters["sector"];
  c_rev: CustomerFilters["revenue"];
  c_team: CustomerFilters["team"];
  c_rival: boolean;
  q: string;
};

export function toCustomerFilters(s: Omit<CustomerUrlState, "q">): CustomerFilters {
  return {
    list: s.c_list,
    tier: s.c_tier,
    fit: s.c_fit,
    area: s.c_area,
    sector: s.c_sector,
    revenue: s.c_rev,
    team: s.c_team,
    rivals: s.c_rival,
  };
}

const load = createLoader(customerParsers);

/** Parse a query string into Customers page state; unknown values are dropped. */
export function parseCustomerUrl(search: string | URLSearchParams): CustomerUrlState {
  return load(search) as CustomerUrlState;
}

/** The Customers page opened on one company (for the palette). */
export function customerHref(name: string): string {
  return `/customers?q=${encodeURIComponent(name)}`;
}
