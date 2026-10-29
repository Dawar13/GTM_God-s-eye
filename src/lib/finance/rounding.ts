/**
 * Rounding conventions. The engine computes at full precision by default
 * (PHASE_1 §2: round only in lib/format). Real cap tables, and Y Combinator's
 * worked examples, round the price per share to 4 decimals and issue whole
 * shares; pass `CAP_TABLE_ROUNDING` to reproduce them.
 */
export type Rounding = {
  /** Decimals kept on every price per share; undefined = full precision. */
  pricePerShareDecimals?: number;
  /** How share counts are made whole; "exact" keeps fractions. */
  shares?: "exact" | "floor" | "round";
};

export const FULL_PRECISION: Rounding = { shares: "exact" };
export const CAP_TABLE_ROUNDING: Rounding = { pricePerShareDecimals: 4, shares: "floor" };

export function roundPrice(price: number, r: Rounding = FULL_PRECISION): number {
  if (r.pricePerShareDecimals === undefined) return price;
  const f = 10 ** r.pricePerShareDecimals;
  return Math.round(price * f) / f;
}

export function roundShares(shares: number, r: Rounding = FULL_PRECISION): number {
  // Guard against 0.9999999 artefacts before flooring.
  const cleaned = Math.abs(shares - Math.round(shares)) < 1e-6 ? Math.round(shares) : shares;
  if (r.shares === "floor") return Math.floor(cleaned);
  if (r.shares === "round") return Math.round(cleaned);
  return shares;
}

/** Ownership fractions from a holder -> shares map; sums to 1. */
export function ownershipOf(holdings: Record<string, number>): Record<string, number> {
  const total = Object.values(holdings).reduce((a, b) => a + b, 0);
  if (total <= 0) throw new RangeError("total shares must be positive");
  return Object.fromEntries(Object.entries(holdings).map(([k, v]) => [k, v / total]));
}

export function assertPositive(name: string, value: number): void {
  if (!(value > 0) || !Number.isFinite(value)) throw new RangeError(`${name} must be positive`);
}

export function assertFraction(name: string, value: number, inclusiveOne = false): void {
  const ok = value >= 0 && (inclusiveOne ? value <= 1 : value < 1) && Number.isFinite(value);
  if (!ok) throw new RangeError(`${name} must be a fraction in [0, 1${inclusiveOne ? "]" : ")"}`);
}
