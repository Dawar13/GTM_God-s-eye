/**
 * "Our round": the raise size and instrument the whole app assumes. Pure definitions, shared
 * by the URL parsers, the top bar control, the fit scores and the calculators.
 *
 * The raise feeds the check size fit feature (src/lib/fit/check.ts), the benchmark strip plot
 * and the calculators' starting values. The instrument picks which benchmarks are highlighted
 * and which SAFE tab opens; no fit feature depends on it.
 */
import { EXAMPLE_RAISE_USD } from "@/lib/calculators/examples";
import { formatUsd } from "@/lib/format";

export const INSTRUMENTS = [
  "post_money_safe",
  "pre_money_safe",
  "convertible_note",
  "priced_round",
] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export const INSTRUMENT_LABELS: Record<Instrument, string> = {
  post_money_safe: "Post-money SAFE",
  pre_money_safe: "Pre-money SAFE",
  convertible_note: "Convertible note",
  priced_round: "Priced round",
};

/** The instrument in running text: "a post-money SAFE". */
export const INSTRUMENT_PHRASES: Record<Instrument, string> = {
  post_money_safe: "post-money SAFE",
  pre_money_safe: "pre-money SAFE",
  convertible_note: "convertible note",
  priced_round: "priced round",
};

export type Round = { raise: number; inst: Instrument };

export const DEFAULT_RAISE_USD = EXAMPLE_RAISE_USD;
export const DEFAULT_INSTRUMENT: Instrument = "post_money_safe";
export const DEFAULT_ROUND: Round = { raise: DEFAULT_RAISE_USD, inst: DEFAULT_INSTRUMENT };

export const RAISE_MIN_USD = 100_000;
export const RAISE_MAX_USD = 20_000_000;

export type RaiseCheck = { ok: true; value: number } | { ok: false; message: string };

/** A raise must be a positive, finite number of dollars inside the supported range. */
export function validateRaise(v: unknown): RaiseCheck {
  const range = `${formatUsd(RAISE_MIN_USD)} to ${formatUsd(RAISE_MAX_USD)}`;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return { ok: false, message: `Enter a number between ${range}.` };
  }
  if (v <= 0) return { ok: false, message: `The raise must be more than zero; use ${range}.` };
  if (v < RAISE_MIN_USD || v > RAISE_MAX_USD) {
    return { ok: false, message: `Use a raise between ${range}.` };
  }
  return { ok: true, value: v };
}

/** A raise from the URL or storage clamped to the range; non-numbers fall back to the default. */
export function clampRaise(v: number): number {
  return Number.isFinite(v)
    ? Math.min(RAISE_MAX_USD, Math.max(RAISE_MIN_USD, v))
    : DEFAULT_RAISE_USD;
}

export function isInstrument(v: unknown): v is Instrument {
  return typeof v === "string" && (INSTRUMENTS as readonly string[]).includes(v);
}

export function isDefaultRound(r: Round): boolean {
  return r.raise === DEFAULT_RAISE_USD && r.inst === DEFAULT_INSTRUMENT;
}

/** "$1.0M · Post-money SAFE". */
export function formatRound(r: Round): string {
  return `${formatUsd(r.raise)} · ${INSTRUMENT_LABELS[r.inst]}`;
}

/** The SAFE calculator tab for an instrument; null when the instrument is not a SAFE. */
export function safeTabFor(inst: Instrument): "post" | "pre" | null {
  return inst === "post_money_safe" ? "post" : inst === "pre_money_safe" ? "pre" : null;
}

/** The last round the user set, as stored for the active person (src/lib/user); null when absent or invalid. */
export function parseStoredRound(text: string | null): Round | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as Partial<Round> | null;
    if (!v || typeof v !== "object") return null;
    const raise = validateRaise(v.raise);
    if (!raise.ok || !isInstrument(v.inst)) return null;
    return { raise: raise.value, inst: v.inst };
  } catch {
    return null;
  }
}

export function serializeStoredRound(r: Round): string {
  return JSON.stringify({ raise: r.raise, inst: r.inst });
}
