import { POOL, type CapTableStep, type Snapshot } from "@/lib/finance";
import { categoricalColor } from "@/lib/viz/palette";

export type CapClass = { key: string; label: string; color: string };

export type CapPoint = {
  index: number;
  label: string;
  /** Fully diluted shares after this step (issued, options and unissued pool). */
  totalShares: number;
  /** Ownership by class, 0..1, summing to 1. Class key -> fraction. */
  fractions: Record<string, number>;
  /** Class key -> shares. */
  shares: Record<string, number>;
  founders: number;
  /** Money in SAFEs and notes issued but not yet converted. */
  pendingUsd: number;
  /** Round price per share, set only on priced rounds. */
  pricePerShare: number | null;
};

export type CapTableSeries = { classes: CapClass[]; points: CapPoint[] };

export const FOUNDERS_KEY = "founders";
const CONVERTIBLES_KEY = "convertibles";

/**
 * Ownership by class after each step. Classes are founders, the option pool, SAFE and note
 * holders (once converted), then one class per priced-round investor group. Unconverted
 * SAFEs and notes own nothing yet, so they appear as `pendingUsd`, not as a slice.
 * `snapshots[0]` is the starting cap table (`initialSnapshot`); `snapshots[i]` follows `steps[i - 1]`.
 */
export function capTableSeries(
  steps: readonly CapTableStep[],
  snapshots: readonly Snapshot[],
): CapTableSeries {
  const convertibleHolders = new Set<string>();
  for (const s of steps) {
    if (s.kind === "post_money_safe" || s.kind === "pre_money_safe" || s.kind === "note")
      convertibleHolders.add(s.holder);
  }
  const classOf = (holder: string): string =>
    holder === FOUNDERS_KEY || holder === POOL
      ? holder
      : convertibleHolders.has(holder)
        ? CONVERTIBLES_KEY
        : holder;

  const used = new Set(snapshots.flatMap((s) => Object.keys(s.holdings).map(classOf)));
  const order: string[] = [FOUNDERS_KEY, POOL, CONVERTIBLES_KEY];
  for (const snap of snapshots)
    for (const holder of Object.keys(snap.holdings)) {
      const c = classOf(holder);
      if (!order.includes(c)) order.push(c);
    }
  const labels: Record<string, string> = {
    [FOUNDERS_KEY]: "Founders",
    [POOL]: "Option pool",
    [CONVERTIBLES_KEY]: "SAFE and note holders",
  };
  const classes = order
    .filter((k) => used.has(k) || k === FOUNDERS_KEY)
    .map((key, i) => ({ key, label: labels[key] ?? key, color: categoricalColor(i) }));

  let pending = 0;
  const points = snapshots.map((snap, index): CapPoint => {
    const step = index === 0 ? undefined : steps[index - 1];
    if (step) {
      if (step.kind === "post_money_safe" || step.kind === "pre_money_safe") pending += step.amount;
      else if (step.kind === "note") pending += step.principal;
      else if (step.kind === "priced_round") pending = 0;
    }
    const shares: Record<string, number> = Object.fromEntries(classes.map((c) => [c.key, 0]));
    for (const [holder, n] of Object.entries(snap.holdings)) {
      const c = classOf(holder);
      shares[c] = (shares[c] ?? 0) + n;
    }
    const fractions = Object.fromEntries(
      classes.map((c) => [c.key, (shares[c.key] ?? 0) / snap.totalFD]),
    );
    return {
      index,
      label: snap.label,
      totalShares: snap.totalFD,
      fractions,
      shares,
      founders: fractions[FOUNDERS_KEY] ?? 0,
      pendingUsd: pending,
      pricePerShare: snap.financing?.pricePerShare ?? null,
    };
  });
  return { classes, points };
}
