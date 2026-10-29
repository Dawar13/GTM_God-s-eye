/** Number formats from PROJECT_CONTEXT §9: $1.2M, $740M, ₹1.5 Cr, 9.1%. Unknown is "—". */

export const UNKNOWN = "—";

/** Fixed decimals without trailing zeros: 1.50 → "1.5", 1.00 → "1". */
function trimmed(value: number, decimals: number): string {
  const s = value.toFixed(decimals);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/** Compact US dollars: $500K, $1.2M, $740M, $1.6B. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${trimmed(abs / 1e9, 1)}B`;
  if (abs >= 1e6) return `${sign}$${trimmed(abs / 1e6, abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${trimmed(abs / 1e3, 0)}K`;
  return `${sign}$${trimmed(abs, 0)}`;
}

/** Indian rupees in crore (1 Cr = 10,000,000): ₹1.5 Cr. */
export function formatInrCrore(rupees: number | null | undefined): string {
  if (rupees === null || rupees === undefined || !Number.isFinite(rupees)) return UNKNOWN;
  return `₹${trimmed(rupees / 1e7, 2)} Cr`;
}

/** A fraction as a percentage to one decimal place: 0.0912 → 9.1%. */
export function formatPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return UNKNOWN;
  return `${(fraction * 100).toFixed(1)}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN;
  return value.toLocaleString("en-US");
}

export function orUnknown<T>(value: T | null | undefined, format: (v: T) => string = String) {
  return value === null || value === undefined ? UNKNOWN : format(value);
}
