/**
 * Parsing for calculator number fields. Returns null for anything that is not a
 * finite number, so NaN and Infinity can never reach a calculation.
 */
export type NumberKind = "usd" | "percent" | "count" | "decimal";

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

/**
 * "$1.5M", "1,500,000" and "9m" parse for usd and count; "10" or "10%" parses as 0.1 for
 * percent (the field shows percent, the value is a fraction).
 */
export function parseNumberInput(text: string, kind: NumberKind): number | null {
  const cleaned = text.replace(/[$,\s_]/g, "").replace(/%$/, "");
  const m = /^(-?\d*\.?\d+)([kmb])?$/i.exec(cleaned);
  if (!m) return null;
  const suffix = m[2]?.toLowerCase();
  if (suffix && kind === "percent") return null;
  const n = Number(m[1]) * (suffix ? (SUFFIX[suffix] ?? 1) : 1);
  if (!Number.isFinite(n)) return null;
  return kind === "percent" ? n / 100 : n;
}

/** The text a field shows for a value: "$1,000,000", "10.0", "9,000,000". */
export function formatFieldValue(value: number, kind: NumberKind): string {
  if (!Number.isFinite(value)) return "";
  if (kind === "percent") return (value * 100).toFixed(1);
  if (kind === "decimal") return String(Number(value.toFixed(2)));
  const s = Math.round(value).toLocaleString("en-US");
  return kind === "usd" ? `$${s}` : s;
}

/** Rounds to `digits` significant digits, so log-slider values read cleanly. */
export function roundSignificant(value: number, digits = 2): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const f = 10 ** (digits - 1 - Math.floor(Math.log10(Math.abs(value))));
  return Math.round(value * f) / f;
}

export type SliderScale = "linear" | "log";

const STEPS = 1000;
export const SLIDER_STEPS = STEPS;

/** Slider position (0..1000) for a value. Out-of-range values clamp. */
export function valueToPosition(value: number, min: number, max: number, scale: SliderScale) {
  const t =
    scale === "log" && min > 0
      ? Math.log(Math.max(value, min) / min) / Math.log(max / min)
      : (value - min) / (max - min);
  return Math.round(Math.min(1, Math.max(0, t)) * STEPS);
}

/** Value for a slider position; log values are rounded to two significant digits. */
export function positionToValue(
  position: number,
  min: number,
  max: number,
  scale: SliderScale,
  step: number,
): number {
  const t = position / STEPS;
  const v =
    scale === "log" && min > 0
      ? roundSignificant(min * (max / min) ** t, 2)
      : min + t * (max - min);
  const stepped = scale === "log" ? v : Math.round(v / step) * step;
  return Math.min(max, Math.max(min, Number(stepped.toPrecision(12))));
}
