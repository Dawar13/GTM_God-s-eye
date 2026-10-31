import type { FounderDilution, SafeScenario } from "@/lib/finance";
import { CATEGORICAL } from "@/lib/viz/palette";
import type { OwnershipSegment } from "./calcOwnership";

export type WaterfallBar = {
  key: "start" | "safe" | "pool" | "new" | "end";
  label: string;
  /** Totals are drawn from zero; deltas float between two totals. */
  kind: "total" | "delta";
  /** Invisible offset under the bar, as a fraction. Zero for totals. */
  base: number;
  /** Bar height as a fraction (always >= 0). */
  value: number;
  /** Founder ownership after this step. */
  after: number;
  /** Signed change in ownership (fraction); null for totals. */
  change: number | null;
};

/**
 * Founder dilution waterfall: the starting stake, three drops (SAFE conversion, pool
 * top-up, new money) and the ending stake. Totals start at zero; each drop floats from
 * the stake before it to the stake after it, so its height is exactly the loss.
 */
export function dilutionWaterfall(d: FounderDilution): WaterfallBar[] {
  const drop = (
    key: "safe" | "pool" | "new",
    label: string,
    from: number,
    to: number,
  ): WaterfallBar => ({
    key,
    label,
    kind: "delta",
    base: to,
    value: from - to,
    after: to,
    change: to - from,
  });
  return [
    {
      key: "start",
      label: "Founders before",
      kind: "total",
      base: 0,
      value: d.start,
      after: d.start,
      change: null,
    },
    drop("safe", "SAFE converts", d.start, d.afterSafe),
    drop("pool", "Pool top-up", d.afterSafe, d.afterPool),
    drop("new", "New money", d.afterPool, d.afterNewMoney),
    {
      key: "end",
      label: "Founders after",
      kind: "total",
      base: 0,
      value: d.afterNewMoney,
      after: d.afterNewMoney,
      change: null,
    },
  ];
}

/** Post-round ownership of one SAFE scenario as 100% bar segments. */
export function safeOwnership(s: SafeScenario): OwnershipSegment[] {
  const f = s.financing.holdings;
  return [
    {
      key: "founders",
      label: "Founders",
      fraction: s.ownership.founders,
      shares: f.founders ?? 0,
      color: CATEGORICAL[0],
    },
    {
      key: "pool",
      label: "Option pool",
      fraction: s.ownership.pool,
      shares: f.pool ?? 0,
      color: CATEGORICAL[2],
    },
    {
      key: "safe",
      label: "SAFE holder",
      fraction: s.ownership.safe,
      shares: s.conversion.shares,
      color: CATEGORICAL[6],
    },
    {
      key: "new",
      label: "New investors",
      fraction: s.ownership.newInvestors,
      shares: s.financing.newShares,
      color: CATEGORICAL[1],
    },
  ];
}

export const METHOD_LABEL = {
  cap: "Valuation cap",
  discount: "Discount",
  round_price: "Round price",
} as const;

export type ConversionRow = {
  kind: SafeScenario["kind"];
  amount: number;
  price: number;
  shares: number;
  method: string;
  ownership: number;
};

/** The conversion table: what the SAFE turns into at the priced round. */
export function conversionRow(s: SafeScenario): ConversionRow {
  return {
    kind: s.kind,
    amount: s.conversion.amount,
    price: s.conversion.price,
    shares: s.conversion.shares,
    method: METHOD_LABEL[s.conversion.method],
    ownership: s.ownership.safe,
  };
}
