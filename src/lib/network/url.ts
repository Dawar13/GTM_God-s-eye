/**
 * URL state of the Network view (nuqs), so a view can be shared: mode, ego hops, investor
 * colouring, round date range, round stages and label density. Defaults are left out of the
 * URL. The selection is the Inspector's own `?inspect=`.
 */
import {
  createParser,
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsStringLiteral,
} from "nuqs/server";
import { ROUND_STAGES } from "@/lib/schema/enums";
import { NETWORK_MODES } from "@/lib/viz/transforms/networkGraph";

export type YearRange = readonly [number, number];

/** "2019-2026" (inclusive, ordered); anything else is null (every round, dated or not). */
export function parseYears(value: string | null | undefined): YearRange | null {
  const m = value ? /^(\d{4})-(\d{4})$/.exec(value.trim()) : null;
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a <= b ? [a, b] : [b, a];
}

export function serializeYears([a, b]: YearRange): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

export const parseAsYears = createParser<YearRange>({
  parse: (v) => parseYears(v),
  serialize: (r) => serializeYears(r),
  eq: (a, b) => a[0] === b[0] && a[1] === b[1],
});

/**
 * Label density steps for the slider: Sigma's `labelDensity` (labels per grid cell) and
 * `labelRenderedSizeThreshold` (smallest node radius, in pixels, that gets a label). Step 0
 * labels only the hovered and selected nodes.
 */
export const LABEL_LEVELS = [
  { density: 0, threshold: 100, name: "Hovered and selected only" },
  { density: 0.25, threshold: 12, name: "Fewest" },
  { density: 0.6, threshold: 9, name: "Few" },
  { density: 1, threshold: 7, name: "Some" },
  { density: 2, threshold: 5, name: "Many" },
  { density: 4, threshold: 2, name: "Most" },
] as const;
export const DEFAULT_LABEL_LEVEL = 2;
export const MAX_LABEL_LEVEL = LABEL_LEVELS.length - 1;

export const networkParsers = {
  mode: parseAsStringLiteral(NETWORK_MODES).withDefault("full"),
  hops: parseAsNumberLiteral([1, 2] as const).withDefault(1),
  colour: parseAsStringLiteral(["cluster", "type"] as const).withDefault("cluster"),
  years: parseAsYears,
  rstage: parseAsArrayOf(parseAsStringLiteral(ROUND_STAGES)).withDefault([]),
  labels: parseAsInteger.withDefault(DEFAULT_LABEL_LEVEL),
};

export const networkUrlOptions = {
  clearOnDefault: true,
  history: "replace",
  scroll: false,
} as const;
