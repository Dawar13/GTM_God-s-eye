/**
 * URL contract for our round, on top of the filters: `?raise=1500000` (dollars; the param
 * Strategy links already used) and `?inst=pre_money_safe`. Defaults are left out of the URL.
 * Server-safe (nuqs/server), so the Command page reads the same params as the client.
 */
import {
  createLoader,
  createSerializer,
  parseAsFloat,
  parseAsStringLiteral,
} from "nuqs/server";
import {
  clampRaise,
  DEFAULT_INSTRUMENT,
  DEFAULT_RAISE_USD,
  INSTRUMENTS,
  type Round,
} from "./index";

export const ROUND_KEYS = ["raise", "inst"] as const;

export const roundParsers = {
  raise: parseAsFloat.withDefault(DEFAULT_RAISE_USD),
  inst: parseAsStringLiteral(INSTRUMENTS).withDefault(DEFAULT_INSTRUMENT),
};

export const roundUrlOptions = {
  clearOnDefault: true,
  history: "replace",
  scroll: false,
} as const;

const load = createLoader(roundParsers);
const serialize = createSerializer(roundParsers, { clearOnDefault: true });

/** Our round from a query string; a raise outside the range is clamped, unknown text ignored. */
export function parseRound(search: string | URLSearchParams): Round {
  const v = load(search);
  return { raise: clampRaise(v.raise), inst: v.inst };
}

/** The round as a query string ("" when it is the default), without the leading "?". */
export function serializeRound(round: Round): string {
  return serialize(round).replace(/^\?/, "");
}
