/**
 * Investors who backed a tracked competitor, split for the Strategy page (PHASE_2 S9):
 *
 * - Likely conflict: the pipeline's `conflict` flag on the investor's fit record, that is,
 *   backed a competitor whose category is `direct` in a round dated within 24 months of the
 *   pipeline's reference date (pipeline/atlas/analyze/fit.py).
 * - Thesis signal: named in a round of at least one tracked competitor (any role, as in the
 *   competitor_overlap file) and not flagged. The reason is stored-field arithmetic only:
 *   a direct competitor backed longer ago, a direct competitor round with no date, or only
 *   adjacent or remote competitors.
 *
 * Nothing is inferred about intent; the groups restate what the rounds and the flag say.
 */
import { isRecentRound } from "@/lib/fit/conflict";
import type { Competitor, Investor, Round } from "@/lib/schema";
import type { CompetitorCategory } from "@/lib/schema/enums";
import { roundInvestorIds } from "./competitors";
import { periodOf } from "./recentDeals";

export type BackedCompetitor = {
  competitorId: string;
  name: string;
  category: CompetitorCategory;
  /** Latest dated round of this competitor the investor is in, as recorded; null when none is dated. */
  latestDate: string | null;
  rounds: number;
};

export type CompetitorBacker = {
  investorId: string;
  name: string;
  /** Direct competitors first, then by name. */
  backed: BackedCompetitor[];
};

const CATEGORY_RANK: Record<CompetitorCategory, number> = { direct: 0, adjacent: 1, remote: 2 };

/** One entry per investor named in any round of a tracked competitor; investors with no record are skipped. */
export function toCompetitorBackers(
  competitors: readonly Competitor[],
  rounds: readonly Round[],
  investors: readonly Investor[],
): CompetitorBacker[] {
  const comp = new Map(competitors.map((c) => [c.id, c]));
  const names = new Map(investors.map((i) => [i.id, i.name]));
  // investor -> competitor -> aggregate
  const acc = new Map<string, Map<string, { latest: string | null; start: number; n: number }>>();
  for (const r of rounds) {
    if (!comp.has(r.company_id)) continue;
    const period = r.date === null ? null : periodOf(r.date);
    for (const id of new Set(roundInvestorIds(r))) {
      if (!names.has(id)) continue;
      const byComp = acc.get(id) ?? new Map();
      const cur = byComp.get(r.company_id) ?? { latest: null, start: -Infinity, n: 0 };
      cur.n += 1;
      if (period && r.date !== null && period.start > cur.start) {
        cur.latest = r.date;
        cur.start = period.start;
      }
      byComp.set(r.company_id, cur);
      acc.set(id, byComp);
    }
  }
  return [...acc.entries()]
    .map(([investorId, byComp]) => ({
      investorId,
      name: names.get(investorId)!,
      backed: [...byComp.entries()]
        .map(([competitorId, a]): BackedCompetitor => {
          const c = comp.get(competitorId)!;
          return {
            competitorId,
            name: c.name,
            category: c.category,
            latestDate: a.latest,
            rounds: a.n,
          };
        })
        .sort(
          (a, b) =>
            CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || a.name.localeCompare(b.name),
        ),
    }))
    .sort((a, b) => a.investorId.localeCompare(b.investorId));
}

export type SignalReason = "direct_older" | "direct_undated" | "not_direct";

export type ClassifiedBacker = CompetitorBacker & {
  kind: "conflict" | "signal";
  /** Why a thesis signal is not a conflict; null for conflicts. */
  reason: SignalReason | null;
};

/** Why an unflagged backer is not a conflict, from the stored rounds (see file comment). */
export function signalReason(backed: readonly BackedCompetitor[]): SignalReason {
  const direct = backed.filter((b) => b.category === "direct");
  if (direct.length === 0) return "not_direct";
  return direct.some((b) => b.latestDate !== null && !isRecentRound(b.latestDate))
    ? "direct_older"
    : "direct_undated";
}

export type BackerSplit = {
  conflict: ClassifiedBacker[];
  signal: ClassifiedBacker[];
  /** Backers left out by the URL filters. */
  hiddenByFilters: number;
};

const byBackedThenName = (a: ClassifiedBacker, b: ClassifiedBacker) =>
  b.backed.length - a.backed.length ||
  a.name.localeCompare(b.name, "en") ||
  a.investorId.localeCompare(b.investorId);

/**
 * Splits the backers that pass the filters. `conflictIds` are the investors whose fit record
 * carries the `conflict` flag; `passIds` the investors the filters keep.
 */
export function splitBackers(
  backers: readonly CompetitorBacker[],
  conflictIds: ReadonlySet<string>,
  passIds: ReadonlySet<string>,
): BackerSplit {
  const out: BackerSplit = { conflict: [], signal: [], hiddenByFilters: 0 };
  for (const b of backers) {
    if (!passIds.has(b.investorId)) {
      out.hiddenByFilters += 1;
      continue;
    }
    if (conflictIds.has(b.investorId)) out.conflict.push({ ...b, kind: "conflict", reason: null });
    else out.signal.push({ ...b, kind: "signal", reason: signalReason(b.backed) });
  }
  out.conflict.sort(byBackedThenName);
  out.signal.sort(byBackedThenName);
  return out;
}
