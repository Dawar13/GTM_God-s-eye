import { createParser } from "nuqs";
import { CALC_URL_OPTIONS } from "@/lib/calculators/url";
import { DEFAULT_FIT_WEIGHTS, type FitWeights } from "@/lib/fit/score";
import { decodeWeights, encodeWeights } from "@/lib/fit/weights";

/**
 * Strategy URL contract, on top of the global filters, our round (`?raise=`, `?inst=`, see
 * src/lib/round/url.ts) and `?inspect=`: `?w=30,20,15,15,10,10` (weights in order thesis,
 * stage, check, adjacency, geography, dry powder; six whole numbers summing to 100).
 * Defaults are left out of the URL.
 */
export const weightsParser = createParser<FitWeights>({
  parse: (v) => decodeWeights(v),
  serialize: (w) => encodeWeights(w),
  eq: (a, b) => encodeWeights(a) === encodeWeights(b),
}).withDefault({ ...DEFAULT_FIT_WEIGHTS });

export const strategyParsers = { w: weightsParser };
export const strategyUrlOptions = CALC_URL_OPTIONS;

export { clampRaise, RAISE_MAX_USD, RAISE_MIN_USD } from "@/lib/round";
