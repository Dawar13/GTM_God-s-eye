/**
 * Which stored benchmarks are for our instrument. A benchmark's `instrument` is free text
 * ("post-money SAFE, priced equity"), so it is read for the instrument names it contains. We
 * never fill in a missing value: a null instrument is "not stated", and text that names no
 * instrument we model is "other".
 */
import { INSTRUMENT_PHRASES, type Instrument } from "./index";

export type InstrumentMatch = "match" | "other" | "not_stated";

/** The modelled instruments a benchmark's instrument text names (possibly several). */
export function instrumentsNamed(text: string): Instrument[] {
  const t = text.toLowerCase();
  const out = new Set<Instrument>();
  const post = /post[-\s]?money\s+(safe|isafe)/.test(t);
  const pre = /pre[-\s]?money\s+(safe|isafe)/.test(t);
  if (post) out.add("post_money_safe");
  if (pre) out.add("pre_money_safe");
  // A SAFE with no money type given covers either kind.
  if (!post && !pre && /\b(i?safes?)\b/.test(t)) {
    out.add("post_money_safe");
    out.add("pre_money_safe");
  }
  if (/convertible\s+(note|debt|loan)|\bnote\b/.test(t)) out.add("convertible_note");
  if (/priced|equity|series\s+[a-z]|preferred/.test(t)) out.add("priced_round");
  return [...out];
}

export function matchInstrument(text: string | null, ours: Instrument): InstrumentMatch {
  if (text === null || text.trim() === "") return "not_stated";
  return instrumentsNamed(text).includes(ours) ? "match" : "other";
}

export type InstrumentCounts = { match: number; other: number; notStated: number };

export function countByInstrument(
  items: readonly { instrument: string | null }[],
  ours: Instrument,
): InstrumentCounts {
  const c: InstrumentCounts = { match: 0, other: 0, notStated: 0 };
  for (const it of items) {
    const m = matchInstrument(it.instrument, ours);
    if (m === "match") c.match++;
    else if (m === "other") c.other++;
    else c.notStated++;
  }
  return c;
}

/** The sentence the benchmark strip plot's subtitle adds about instruments. */
export function instrumentSummary(counts: InstrumentCounts, ours: Instrument): string {
  const name = INSTRUMENT_PHRASES[ours];
  const parts = [
    `${counts.match} name ${name}`,
    `${counts.other} name another instrument`,
    `${counts.notStated} do not state one`,
  ];
  return `Highlighted: figures for a ${name} (${parts.join(", ")}); the rest are muted.`;
}
