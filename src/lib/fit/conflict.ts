/**
 * The pipeline's recency test for the `conflict` flag, ported from fit.py (`_recent`,
 * `conflict`): a round is recent when the first day of its recorded month (June for a bare
 * year or a quarter) is within 730 days of the pipeline's reference date. Used only to say
 * why a competitor backer is not flagged; the flag itself is read from the stored record.
 * tests/competitor-investors-s9.test.ts checks this port against every stored flag.
 */

/** REFERENCE_DATE in pipeline/atlas/config.py; keep in step. */
export const PIPELINE_REFERENCE_DATE = "2026-10-30";
export const RECENT_DAYS = 730;

export function isRecentRound(date: string | null): boolean {
  if (!date) return false;
  const y = Number(date.slice(0, 4));
  const m = date.length >= 7 && date[5] !== "Q" ? Number(date.slice(5, 7)) : 6;
  const ref = Date.parse(`${PIPELINE_REFERENCE_DATE}T00:00:00Z`);
  const start = Date.UTC(y, m - 1, 1);
  return (ref - start) / 86_400_000 <= RECENT_DAYS;
}
