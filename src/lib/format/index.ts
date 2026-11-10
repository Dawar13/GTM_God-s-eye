/** Number formats from PROJECT_CONTEXT §9: $1.2M, $740M, ₹1.5 Cr, 9.1%. Unknown is "—". */

export const UNKNOWN = "—";

/** Fixed decimals without trailing zeros: 1.50 → "1.5", 1.00 → "1". */
function trimmed(value: number, decimals: number): string {
  const s = value.toFixed(decimals);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/** Compact US dollars: $500K, $1.2M, $740M, $1.75B. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${trimmed(abs / 1e9, 2)}B`;
  if (abs >= 1e6) return `${sign}$${trimmed(abs / 1e6, abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${trimmed(abs / 1e3, 0)}K`;
  return `${sign}$${trimmed(abs, 0)}`;
}

/** A per-share price to four decimals, as cap tables quote it: $0.9000. */
export function formatPricePerShare(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN;
  return `$${value.toFixed(4)}`;
}

/** A change in ownership as signed percentage points: -0.09 → "−9.0 pts". */
export function formatPoints(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return UNKNOWN;
  const pts = Math.abs(fraction * 100).toFixed(1);
  if (Number(pts) === 0) return "0.0 pts";
  return `${fraction < 0 ? "−" : "+"}${pts} pts`;
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An ISO date (YYYY, YYYY-MM or YYYY-MM-DD) as "Mar 2026"; a bare year stays "2026". */
export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return UNKNOWN;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-\d{2})?/.exec(iso);
  if (!m) return UNKNOWN;
  if (!m[1]) return UNKNOWN;
  if (!m[2]) return m[1];
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : UNKNOWN;
}

/**
 * A schema date of any precision: 2026 stays "2026", 2026-Q1 is "Q1 2026", 2026-03 is
 * "Mar 2026", 2026-03-12 is "12 Mar 2026". Anything else is the unknown dash.
 */
export function formatPartialDate(value: string | null | undefined): string {
  if (!value) return UNKNOWN;
  const q = /^(\d{4})-Q([1-4])$/.exec(value);
  if (q) return `Q${q[2]} ${q[1]}`;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (d) {
    const month = MONTHS[Number(d[2]) - 1];
    return month ? `${Number(d[3])} ${month} ${d[1]}` : UNKNOWN;
  }
  return formatMonthYear(value);
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN;
  return value.toLocaleString("en-US");
}

/** A return multiple to two decimals: 0.64 → "0.64×", 10 → "10.00×". */
export function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN;
  return `${value.toFixed(2)}×`;
}

export function orUnknown<T>(value: T | null | undefined, format: (v: T) => string = String) {
  return value === null || value === undefined ? UNKNOWN : format(value);
}

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

/** An ISO 3166-1 alpha-2 code as an English country name; unknown or unrecognised codes stay as given. */
export function formatCountry(code: string | null | undefined): string {
  if (!code) return UNKNOWN;
  try {
    return COUNTRY_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

/** A website URL as its bare host and path ("https://www.acme.com/" → "acme.com"). */
export function formatWebsite(url: string | null | undefined): string {
  if (!url) return UNKNOWN;
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}
