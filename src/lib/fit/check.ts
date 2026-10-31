/**
 * The check-size fit feature, ported from the pipeline (pipeline/atlas/analyze/fit.py,
 * `check()` and `_feature()`) so the Strategy page can re-score it for a different raise.
 * Keep the two in step; tests/fit-check-s9.test.ts compares this with every stored value
 * at the pipeline's $1M raise.
 *
 * 1.0 when our raise sits inside the investor's check range; 0 when their minimum check is
 * above our whole round; 0.3 when their largest check is under 5% of the round; 0.8 when
 * their largest check is above the round; +0.2 for investors who lead; clamped to 0-1 and
 * rounded to 6 decimals like the stored values. Null when neither end of the range is known.
 */
import type { FitFeatures } from "@/lib/schema";
import { formatUsd } from "@/lib/format";

export type CheckInput = {
  checkMinUsd: number | null;
  checkMaxUsd: number | null;
  /** Stored `leads`; null (unknown) counts as not leading, as in the pipeline. */
  leads: boolean | null;
};

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function checkFeature(inv: CheckInput, raiseUsd: number): number | null {
  const lo = inv.checkMinUsd;
  const hi = inv.checkMaxUsd;
  if (lo === null && hi === null) return null;
  let value: number;
  if (lo !== null && lo > raiseUsd) value = 0;
  else if (hi !== null && hi < 0.05 * raiseUsd) value = 0.3;
  else value = hi === null || hi <= raiseUsd ? 1 : 0.8;
  if (inv.leads) value += 0.2;
  return round6(Math.max(0, Math.min(1, value)));
}

/**
 * The stored fit record with its check feature re-scored for `raiseUsd`; the other five
 * features and the flags stay as stored. A stored-null check stays null.
 */
export function withRaise(fit: FitFeatures, inv: CheckInput, raiseUsd: number): FitFeatures {
  const value = checkFeature(inv, raiseUsd);
  const money = (v: number | null) => (v === null ? "unknown" : formatUsd(v));
  const check =
    value === null
      ? null
      : {
          value,
          method: `check range vs raise of ${formatUsd(raiseUsd)} (editable here); leads +0.2`,
          inputs: [
            `check ${money(inv.checkMinUsd)}–${money(inv.checkMaxUsd)}`,
            `leads ${inv.leads === null ? "unknown" : String(inv.leads)}`,
          ],
        };
  return { ...fit, features: { ...fit.features, check }, raise_size_usd: raiseUsd };
}
