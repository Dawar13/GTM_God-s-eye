import { createParser, parseAsFloat } from "nuqs";
import { EXAMPLE_RAISE_USD } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS } from "@/lib/calculators/url";
import { DEFAULT_FIT_WEIGHTS, type FitWeights } from "@/lib/fit/score";
import { decodeWeights, encodeWeights } from "@/lib/fit/weights";

/**
 * Strategy URL contract, on top of the global filters and `?inspect=`:
 * `?w=30,20,15,15,10,10` (weights in order thesis, stage, check, adjacency, geography, dry
 * powder; six whole numbers summing to 100) and `?raise=1500000` (our raise in dollars).
 * Defaults are left out of the URL.
 */
export const weightsParser = createParser<FitWeights>({
  parse: (v) => decodeWeights(v),
  serialize: (w) => encodeWeights(w),
  eq: (a, b) => encodeWeights(a) === encodeWeights(b),
}).withDefault({ ...DEFAULT_FIT_WEIGHTS });

export const RAISE_MIN_USD = 100_000;
export const RAISE_MAX_USD = 20_000_000;

export const raiseParser = parseAsFloat.withDefault(EXAMPLE_RAISE_USD);

export const strategyParsers = { w: weightsParser, raise: raiseParser };
export const strategyUrlOptions = CALC_URL_OPTIONS;

/** A raise from the URL clamped to the field's range; non-numbers fall back to the example. */
export function clampRaise(v: number): number {
  return Number.isFinite(v)
    ? Math.min(RAISE_MAX_USD, Math.max(RAISE_MIN_USD, v))
    : EXAMPLE_RAISE_USD;
}
