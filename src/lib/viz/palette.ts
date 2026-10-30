/** Categorical data palette (PHASE_2 §1.1): Tableau 10 subset, colour-blind-checked. */
export const CATEGORICAL = [
  "#4E79A7",
  "#F28E2B",
  "#59A14F",
  "#E15759",
  "#76B7B2",
  "#EDC948",
  "#B07AA1",
  "#9C755F",
] as const;

export const COMPANY_GREY = { low: "#C4C9D1", high: "#8A919C" } as const;
export const SEQUENTIAL = { low: "#EEF0FB", high: "#4F5BD5" } as const;

const FILL_OPACITY = 0.85;
const STROKE_DARKEN = 0.15;

function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Expected a #RRGGBB colour, got "${hex}"`);
  const n = parseInt(m[1] ?? "", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Scales each RGB channel toward black by `amount` (0.15 keeps 85% of the channel). */
export function darken(hex: string, amount: number = STROKE_DARKEN): string {
  return toHex(parseHex(hex).map((c) => c * (1 - amount)));
}

/** Hex colour as rgba() at the given opacity. */
export function withOpacity(hex: string, opacity: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function categoricalColor(index: number): string {
  const n = CATEGORICAL.length;
  return CATEGORICAL[((Math.trunc(index) % n) + n) % n] ?? CATEGORICAL[0];
}

/** Mark style on a light surface: 85% fill, 1px stroke of the same hue darkened 15%. */
export function markStyle(hex: string): { fill: string; stroke: string; strokeWidth: 1 } {
  return { fill: withOpacity(hex, FILL_OPACITY), stroke: darken(hex), strokeWidth: 1 };
}

function ramp(low: string, high: string, t: number): string {
  const [r, g, b] = parseHex(low);
  const [r2, g2, b2] = parseHex(high);
  const k = Math.min(1, Math.max(0, t));
  return toHex([r + (r2 - r) * k, g + (g2 - g) * k, b + (b2 - b) * k]);
}

/** Sequential ramp for heatmaps, t in [0, 1]. */
export function sequentialColor(t: number): string {
  return ramp(SEQUENTIAL.low, SEQUENTIAL.high, t);
}

/**
 * Company grey by capital raised: darker = more raised. Null (unknown) returns null so the
 * caller chooses how to show "unknown" instead of it silently reading as the lightest grey.
 */
export function companyGrey(raised: number | null | undefined, max: number): string | null {
  if (raised === null || raised === undefined || !Number.isFinite(raised) || !(max > 0)) {
    return null;
  }
  return ramp(COMPANY_GREY.low, COMPANY_GREY.high, raised / max);
}
