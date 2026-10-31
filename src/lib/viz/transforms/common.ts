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
  // Ranked by how many records cite the domain, then by how many pages; with one record
  // the most-cited domain wins instead of the alphabetically first.
  const counts = new Map<string, { records: number; pages: number }>();
  for (const it of items) {
    const domains = it.sources.map((s) => domainOf(s.url));
    for (const d of new Set(domains)) {
      const c = counts.get(d) ?? { records: 0, pages: 0 };
      c.records += 1;
      c.pages += domains.filter((x) => x === d).length;
      counts.set(d, c);
    }
  }
  return [...counts.entries()]
    .sort(
      (a, b) => b[1].records - a[1].records || b[1].pages - a[1].pages || a[0].localeCompare(b[0]),
    )
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
