/** Shared bits for the chart transforms: freshness rule, source and confidence roll-ups. */
import type { Confidence, Source } from "@/lib/schema";
import type { Fund } from "@/lib/schema";

/**
 * A fund is "fresh" if it closed on or after this date. Mirrors FRESHNESS_CUTOFF in
 * pipeline/atlas/config.py (24 months before 2026-10-29); keep the two in step.
 */
export const FRESHNESS_CUTOFF = "2024-10-29";

/**
 * Same test as the pipeline's investor freshness (pipeline/atlas/analyze/categorize.py),
 * applied to one fund: string comparison of the close date, falling back to the vintage year.
 * Null when the fund has neither.
 */
export function isFreshFund(fund: Pick<Fund, "close_date" | "vintage_year">): boolean | null {
  const closed = fund.close_date ?? (fund.vintage_year === null ? null : String(fund.vintage_year));
  return closed === null ? null : closed >= FRESHNESS_CUTOFF;
}

export function domainOf(url: string): string {
  if (url.startsWith("user_supplied:")) return "Your list";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

type Provenanced = { sources: readonly Source[]; confidence: Confidence };

/** Most-cited source domains across records (each record counts a domain once), most common first. */
export function topDomains(items: readonly Provenanced[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    for (const d of new Set(it.sources.map((s) => domainOf(s.url)))) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([d]) => d);
}

/**
 * Tooltip provenance for a mark built from several records: the most common source domain
 * ("+k more" when others exist) and the lowest confidence among the records.
 */
export function provenanceOf(items: readonly Provenanced[]): {
  sourceDomain: string | null;
  confidence: Confidence | null;
} {
  if (items.length === 0) return { sourceDomain: null, confidence: null };
  const all = new Set(items.flatMap((i) => i.sources.map((s) => domainOf(s.url))));
  const top = topDomains(items, 1)[0] ?? null;
  const more = all.size - 1;
  return {
    sourceDomain: top === null ? null : more > 0 ? `${top} +${more} more` : top,
    confidence: items.reduce<Confidence>(
      (low, i) => (RANK[i.confidence] < RANK[low] ? i.confidence : low),
      "high",
    ),
  };
}
