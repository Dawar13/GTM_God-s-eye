"use client";

import { useMemo, useState } from "react";

const NAMES: [RegExp, string][] = [
  [/headlinePreMoney/g, "Headline pre-money"],
  [/preMoneyFDShares/g, "Fully diluted shares"],
  [/preMoneyCap/g, "Pre-money cap"],
  [/postMoneyCap/g, "Post-money cap"],
  [/preMoney/g, "Pre-money"],
  [/postMoney/g, "Post-money"],
  [/investment/g, "Investment"],
  [/existingShares/g, "Founder shares"],
  [/founderShares/g, "Founder shares"],
  [/existingPool/g, "Existing pool"],
  [/targetPostPoolPct/g, "Target pool"],
  [/targetPct/g, "Target pool"],
  [
    /pricePerShare must be positive/g,
    "The price per share rounds to zero; use a higher valuation or fewer shares",
  ],
  [/SAFE amount/g, "SAFE amount"],
  [/safeAmount/g, "SAFE amount"],
  [/discount/g, "Discount"],
];

/** Turns an engine RangeError into a sentence for the inline message. */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : "These inputs cannot be calculated.";
  let s = raw;
  for (const [re, name] of NAMES) s = s.replace(re, name);
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!]$/.test(s) ? s : `${s}.`;
}

/** True when every number in the value is finite (no NaN or Infinity reaches the screen). */
export function allFinite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (value && typeof value === "object") return Object.values(value).every(allFinite);
  return true;
}

type Outcome<R> = { ok: true; value: R } | { ok: false; error: string };

/**
 * Runs a pure finance computation on the inputs. If the inputs are invalid (the engine
 * throws, or a result is not finite) it returns the message and keeps the last valid
 * result, so the screen never shows NaN or Infinity.
 */
export function useLastValid<I, R>(input: I, compute: (input: I) => R) {
  const outcome = useMemo<Outcome<R>>(() => {
    try {
      const value = compute(input);
      if (!allFinite(value))
        return { ok: false, error: "These inputs give a result that cannot be shown." };
      return { ok: true, value };
    } catch (e) {
      return { ok: false, error: friendlyError(e) };
    }
  }, [input, compute]);

  const [last, setLast] = useState<R | null>(outcome.ok ? outcome.value : null);
  if (outcome.ok && outcome.value !== last) setLast(outcome.value);

  return {
    result: outcome.ok ? outcome.value : last,
    error: outcome.ok ? null : outcome.error,
    /** True when `result` is the previous valid one, not the current inputs'. */
    stale: !outcome.ok && last !== null,
  };
}
