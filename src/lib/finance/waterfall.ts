import { assertPositive } from "./rounding";

export type Participation = "none" | "full" | "capped";

export type PreferredClass = {
  name: string;
  invested: number;
  /** As-converted common shares this class would hold if it converted. */
  shares: number;
  /** Liquidation preference multiple, e.g. 1 or 2. */
  multiple: number;
  participation: Participation;
  /** Total return cap as a multiple of `invested` (capped participation only), e.g. 3. */
  capMultiple?: number;
  /** Higher is paid first; equal values are pari passu. */
  seniority: number;
};

export type DistributeInput = {
  exitValue: number;
  /** Common shares (founders, employees) plus exercised options. */
  commonShares: number;
  classes: PreferredClass[];
};

export type ClassPayout = {
  name: string;
  converted: boolean;
  preference: number;
  participation: number;
  total: number;
};

export type DistributeResult = { classes: ClassPayout[]; common: number; exitValue: number };

/**
 * Who gets what at an exit.
 *
 * Non-converting classes take their preference (multiple × invested) in
 * seniority order, pari passu within a tier. What remains goes to common,
 * to converted classes, and to participating classes, by as-converted shares;
 * capped participants stop at capMultiple × invested and the excess flows to
 * the others. Each class converts when converting pays it more, found by
 * iterating to a stable choice. Source: Feld & Mendelson, *Venture Deals*,
 * ch. 5 "Liquidation preference"; NVCA model Certificate of Incorporation §2.
 */
export function distribute(input: DistributeInput): DistributeResult {
  const { exitValue, classes } = input;
  if (!(exitValue >= 0)) throw new RangeError("exitValue must be non-negative");
  assertPositive("commonShares", input.commonShares);
  for (const c of classes) {
    assertPositive(`${c.name}.invested`, c.invested);
    assertPositive(`${c.name}.shares`, c.shares);
    if (c.participation === "capped" && !(c.capMultiple && c.capMultiple >= c.multiple))
      throw new RangeError(`${c.name}: capped participation needs capMultiple ≥ multiple`);
  }

  const converted = new Set<string>();
  let result = settle(input, converted);
  for (let pass = 0; pass < 2 * classes.length + 2; pass++) {
    // Switch the single class that gains most, so choices can't oscillate.
    let best: { name: string; gain: number } | null = null;
    for (const c of classes) {
      const flipped = new Set(converted);
      if (flipped.has(c.name)) flipped.delete(c.name);
      else flipped.add(c.name);
      const alt = settle(input, flipped);
      const gain = payoutOf(alt, c.name) - payoutOf(result, c.name);
      if (gain > 1e-9 && (best === null || gain > best.gain)) best = { name: c.name, gain };
    }
    if (best === null) break;
    if (converted.has(best.name)) converted.delete(best.name);
    else converted.add(best.name);
    result = settle(input, converted);
  }
  return result;
}

function payoutOf(r: DistributeResult, name: string): number {
  return (r.classes.find((c) => c.name === name) as ClassPayout).total;
}

function settle(input: DistributeInput, converted: Set<string>): DistributeResult {
  const { exitValue, classes, commonShares } = input;
  const pref = new Map<string, number>();
  let left = exitValue;

  // Preferences, senior tiers first, pari passu inside a tier.
  const tiers = [...new Set(classes.map((c) => c.seniority))].sort((a, b) => b - a);
  for (const tier of tiers) {
    const members = classes.filter((c) => c.seniority === tier && !converted.has(c.name));
    const owed = members.reduce((a, c) => a + c.multiple * c.invested, 0);
    const paid = Math.min(left, owed);
    for (const c of members)
      pref.set(c.name, owed > 0 ? (paid * c.multiple * c.invested) / owed : 0);
    left -= paid;
  }

  // Residual by as-converted shares among common, converted and participating classes.
  const part = new Map<string, number>();
  const sharing = new Set(
    classes.filter((c) => converted.has(c.name) || c.participation !== "none").map((c) => c.name),
  );
  let pool = left;
  let commonPayout = 0;
  for (let guard = 0; guard <= classes.length; guard++) {
    const shares =
      commonShares + classes.filter((c) => sharing.has(c.name)).reduce((a, c) => a + c.shares, 0);
    const perShare = shares > 0 ? pool / shares : 0;
    // Capped participants that would pass their cap take exactly the cap and leave.
    const over = classes.filter(
      (c) =>
        sharing.has(c.name) &&
        !converted.has(c.name) &&
        c.participation === "capped" &&
        (pref.get(c.name) ?? 0) + perShare * c.shares > (c.capMultiple as number) * c.invested,
    );
    if (over.length === 0) {
      for (const c of classes) if (sharing.has(c.name)) part.set(c.name, perShare * c.shares);
      commonPayout = perShare * commonShares;
      break;
    }
    for (const c of over) {
      const room = Math.max(0, (c.capMultiple as number) * c.invested - (pref.get(c.name) ?? 0));
      part.set(c.name, room);
      pool -= room;
      sharing.delete(c.name);
    }
  }

  return {
    exitValue,
    common: commonPayout,
    classes: classes.map((c) => {
      const preference = pref.get(c.name) ?? 0;
      const participation = part.get(c.name) ?? 0;
      return {
        name: c.name,
        converted: converted.has(c.name),
        preference,
        participation,
        total: preference + participation,
      };
    }),
  };
}

/** Payout table across a range of exit values: the "who gets what" curve. */
export function payoutCurve(
  base: Omit<DistributeInput, "exitValue">,
  exitValues: number[],
): DistributeResult[] {
  return exitValues.map((exitValue) => distribute({ ...base, exitValue }));
}

/**
 * Smallest exit at which `className` converts (bisection), or null if it never
 * converts below `maxExit`.
 */
export function conversionPoint(
  base: Omit<DistributeInput, "exitValue">,
  className: string,
  maxExit: number,
  tolerance = 0.01,
): number | null {
  const converts = (x: number) =>
    (distribute({ ...base, exitValue: x }).classes.find((c) => c.name === className) as ClassPayout)
      .converted;
  if (!converts(maxExit)) return null;
  let lo = 0;
  let hi = maxExit;
  while (hi - lo > tolerance) {
    const mid = (lo + hi) / 2;
    if (converts(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
