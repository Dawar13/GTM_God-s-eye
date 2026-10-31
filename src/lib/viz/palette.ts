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

/**
 * Tableau 10's remaining two hues, used only when a chart needs more than eight categories
 * (the pipeline picks k from 4 to 10 thesis clusters). Same palette family, so it stays
 * colour-blind-checked; wrapping to the first hue would make two clusters look the same.
 */
export const CATEGORICAL_EXTENDED = [...CATEGORICAL, "#FF9DA7", "#BAB0AC"] as const;

/**
 * Wide categorical palette for a chart that names up to 18 series at once (the competitor
 * Sankey's investors). Order matters: series are coloured by rank, so neighbours in the list
 * contrast most.
 *
 *  1–9   Tableau 10 without its grey: blue #4E79A7, orange #F28E2B, green #59A14F,
 *        red #E15759, teal #76B7B2, yellow #EDC948, purple #B07AA1, brown #9C755F,
 *        pink #FF9DA7.
 *  10–16 Tableau 20 second tones that stay apart from the first nine: deep teal #499894,
 *        olive #B6992D, raspberry #D37295, light blue #A0CBE8, light green #8CD17D,
 *        apricot #FFBE7D, lavender #D4A6C8.
 *  17–18 d3 category20b orchid #CE6DBD and Tableau 20 tan #D7B5A6.
 *
 * Checked in tests/competitor-sankey.test.ts: every pair is at least ΔE 12 apart (CIE76,
 * CIELAB; the closest pair is teal and deep teal at 12.6), every hue is at least ΔE 20 from
 * OTHER_GREY so a coloured band never reads as "other", and every hue has at least 3:1 contrast
 * against the dark panel (#1D2026). On the light panel the pale hues rely on the §1.1 mark
 * rule (85% fill, 1px stroke darkened 15%) for an edge, as Tableau's yellow already does.
 */
export const CATEGORICAL_WIDE = [
  "#4E79A7",
  "#F28E2B",
  "#59A14F",
  "#E15759",
  "#76B7B2",
  "#EDC948",
  "#B07AA1",
  "#9C755F",
  "#FF9DA7",
  "#499894",
  "#B6992D",
  "#D37295",
  "#A0CBE8",
  "#8CD17D",
  "#FFBE7D",
  "#D4A6C8",
  "#CE6DBD",
  "#D7B5A6",
] as const;

/** Neutral grey for an "everything else" group, such as the Sankey's Other investors. */
export const OTHER_GREY = COMPANY_GREY.high;

/** Colour for thesis cluster `index` (0-based); distinct for up to ten clusters. */
export function clusterColor(index: number): string {
  const n = CATEGORICAL_EXTENDED.length;
  return CATEGORICAL_EXTENDED[((Math.trunc(index) % n) + n) % n] ?? CATEGORICAL[0];
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
