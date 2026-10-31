import type { LegalTopic } from "@/lib/schema/enums";

/**
 * India instruments: no math beyond rupee units and FX (PHASE_1 §2.1). The
 * rules themselves live in legal_notes.json, sourced and dated; the calculator
 * shows them by topic.
 */

export const RUPEES_PER_CRORE = 10_000_000;
export const RUPEES_PER_LAKH = 100_000;

export function croreToRupees(crore: number): number {
  return crore * RUPEES_PER_CRORE;
}

export function rupeesToCrore(rupees: number): number {
  return rupees / RUPEES_PER_CRORE;
}

/** USD from INR with a rate quoted as INR per 1 USD. */
export function inrToUsd(rupees: number, inrPerUsd: number): number {
  if (!(inrPerUsd > 0)) throw new RangeError("inrPerUsd must be positive");
  return rupees / inrPerUsd;
}

/** Legal-note topics the India instruments view shows, in order. */
export const INDIA_TOPICS: readonly LegalTopic[] = [
  "ccps",
  "isafe",
  "india_convertible_note",
  "fema_pricing",
  "angel_tax",
  "india_flip",
  "reverse_flip",
  "delaware_requirement",
] as const;

/** Notes for one topic, newest verification first. */
export function notesForTopic<T extends { topic: LegalTopic; last_verified: string }>(
  notes: readonly T[],
  topic: LegalTopic,
): T[] {
  return notes
    .filter((n) => n.topic === topic)
    .sort((a, b) => b.last_verified.localeCompare(a.last_verified));
}

/** Notes grouped by topic in `INDIA_TOPICS` order; a topic with no notes is left out. */
export function groupNotesByTopic<T extends { topic: LegalTopic; last_verified: string }>(
  notes: readonly T[],
): { topic: LegalTopic; notes: T[] }[] {
  return INDIA_TOPICS.map((topic) => ({ topic, notes: notesForTopic(notes, topic) })).filter(
    (g) => g.notes.length > 0,
  );
}
