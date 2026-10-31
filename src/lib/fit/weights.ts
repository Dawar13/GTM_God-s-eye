/**
 * Fit weights for the Strategy sliders: six whole numbers that always sum to 100. Moving one
 * slider shares the rest of the 100 among the others in proportion to their current weights,
 * so the total never drifts and the other features keep their relative importance.
 */
import { DEFAULT_FIT_WEIGHTS, type FitFeatureName, type FitWeights } from "@/lib/fit/score";
import { FIT_FEATURE_ORDER } from "@/lib/viz/transforms/topByFit";

export const WEIGHT_TOTAL = 100;

/** Whole numbers from fractional shares that sum to `total` (largest remainder). */
function roundToTotal(shares: readonly number[], total: number): number[] {
  const floors = shares.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = shares
    .map((s, i) => ({ i, r: s - Math.floor(s) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

/** Scales any non-negative weights to whole numbers summing to 100; all zero gives the defaults. */
export function normalizeWeights(raw: Partial<Record<FitFeatureName, number>>): FitWeights {
  const vals = FIT_FEATURE_ORDER.map((n) => Math.max(0, raw[n] ?? 0));
  const sum = vals.reduce((a, b) => a + b, 0);
  if (!(sum > 0) || !Number.isFinite(sum)) return { ...DEFAULT_FIT_WEIGHTS };
  const rounded = roundToTotal(
    vals.map((v) => (v / sum) * WEIGHT_TOTAL),
    WEIGHT_TOTAL,
  );
  return Object.fromEntries(FIT_FEATURE_ORDER.map((n, i) => [n, rounded[i]])) as FitWeights;
}

/** Sets one weight (0-100) and rescales the others so the six still sum to 100. */
export function setWeight(weights: FitWeights, name: FitFeatureName, value: number): FitWeights {
  const v = Math.max(0, Math.min(WEIGHT_TOTAL, Math.round(value)));
  const others = FIT_FEATURE_ORDER.filter((n) => n !== name);
  const otherSum = others.reduce((a, n) => a + weights[n], 0);
  const rest = WEIGHT_TOTAL - v;
  const shares = others.map((n) =>
    otherSum > 0 ? (weights[n] / otherSum) * rest : rest / others.length,
  );
  const rounded = roundToTotal(shares, rest);
  const out = { ...weights, [name]: v } as FitWeights;
  others.forEach((n, i) => (out[n] = rounded[i] ?? 0));
  return out;
}

export function isDefaultWeights(w: FitWeights): boolean {
  return FIT_FEATURE_ORDER.every((n) => w[n] === DEFAULT_FIT_WEIGHTS[n]);
}

/** The `w` URL value: six comma-separated integers in feature order, e.g. "30,20,15,15,10,10". */
export function encodeWeights(w: FitWeights): string {
  return FIT_FEATURE_ORDER.map((n) => w[n]).join(",");
}

/** Parses `w`; anything that is not six whole numbers adding to 100 gives the defaults. */
export function decodeWeights(text: string | null | undefined): FitWeights {
  if (!text) return { ...DEFAULT_FIT_WEIGHTS };
  const parts = text.split(",");
  if (parts.length !== FIT_FEATURE_ORDER.length) return { ...DEFAULT_FIT_WEIGHTS };
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !Number.isFinite(n) || n > WEIGHT_TOTAL)) return { ...DEFAULT_FIT_WEIGHTS };
  if (nums.reduce((a, b) => a + b, 0) !== WEIGHT_TOTAL) return { ...DEFAULT_FIT_WEIGHTS };
  return Object.fromEntries(FIT_FEATURE_ORDER.map((n, i) => [n, nums[i]])) as FitWeights;
}
