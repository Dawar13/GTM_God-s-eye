import type { Company, Competitor, Confidence, Round } from "@/lib/schema";
import { COMPETITOR_LAYERS } from "@/lib/schema/enums";
import type { CompetitorLayer, DatePrecision, RoundStage } from "@/lib/schema/enums";
import { FRESHNESS_CUTOFF, provenanceOf, topDomains } from "./common";

export type DealDot = {
  roundId: string;
  companyId: string;
  name: string;
  layer: CompetitorLayer;
  isCompetitor: boolean;
  /** The date as recorded: YYYY, YYYY-Qn, YYYY-MM or YYYY-MM-DD. */
  date: string;
  datePrecision: DatePrecision;
  /** Start of the recorded period, epoch ms (UTC). Coarse dates sit at the start of their period. */
  x: number;
  stage: RoundStage;
  amountUsd: number | null;
  contested: boolean;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type RecentDeals = {
  dots: DealDot[];
  /** Window start as a date string. */
  since: string;
  /** Rounds in our layers inside the window. */
  counted: number;
  /** Rounds in our layers with no date. */
  notShown: number;
  /** Rounds in our layers dated before the window. */
  earlier: number;
  sources: string[];
};

/** Start and end (epoch ms, UTC) of a partial date's period. */
export function periodOf(date: string): { start: number; end: number } | null {
  const q = /^(\d{4})-Q([1-4])$/.exec(date);
  if (q) {
    const y = Number(q[1]);
    const m = (Number(q[2]) - 1) * 3;
    return { start: Date.UTC(y, m, 1), end: Date.UTC(y, m + 3, 1) - 1 };
  }
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(date);
  if (!m) return null;
  const y = Number(m[1]);
  if (m[3]) {
    const t = Date.UTC(y, Number(m[2]) - 1, Number(m[3]));
    return { start: t, end: t + 86_400_000 - 1 };
  }
  if (m[2]) {
    return { start: Date.UTC(y, Number(m[2]) - 1, 1), end: Date.UTC(y, Number(m[2]), 1) - 1 };
  }
  return { start: Date.UTC(y, 0, 1), end: Date.UTC(y + 1, 0, 1) - 1 };
}

/**
 * Rounds of "our layers" companies: any company or competitor whose `layer` is set (the
 * schema says layer is "only for companies in our space"; competitors always have one).
 * Keeps rounds whose dated period reaches the window start (default: the freshness cutoff,
 * 24 months). Rounds without a date are counted in `notShown`.
 */
export function recentDeals(
  rounds: readonly Round[],
  companies: readonly Company[],
  competitors: readonly Competitor[],
  since: string = FRESHNESS_CUTOFF,
): RecentDeals {
  const sinceMs = periodOf(since)!.start;
  const scope = new Map<string, { name: string; layer: CompetitorLayer; isCompetitor: boolean }>();
  for (const c of companies) {
    if (c.layer !== null) scope.set(c.id, { name: c.name, layer: c.layer, isCompetitor: false });
  }
  for (const c of competitors) {
    scope.set(c.id, { name: c.name, layer: c.layer, isCompetitor: true });
  }
  const dots: DealDot[] = [];
  const used: Round[] = [];
  let notShown = 0;
  let earlier = 0;
  for (const r of rounds) {
    const co = scope.get(r.company_id);
    if (!co) continue;
    const period = r.date === null ? null : periodOf(r.date);
    if (r.date === null || period === null || r.date_precision === null) {
      notShown += 1;
      continue;
    }
    if (period.end < sinceMs) {
      earlier += 1;
      continue;
    }
    used.push(r);
    dots.push({
      roundId: r.id,
      companyId: r.company_id,
      ...co,
      date: r.date,
      datePrecision: r.date_precision,
      x: period.start,
      stage: r.stage,
      amountUsd: r.amount_usd,
      contested: r.contested,
      ...provenanceOf([r]),
    });
  }
  dots.sort((a, b) => a.x - b.x || a.roundId.localeCompare(b.roundId));
  return { dots, since, counted: dots.length, notShown, earlier, sources: topDomains(used, 4) };
}

export const LAYER_ORDER: readonly CompetitorLayer[] = COMPETITOR_LAYERS;
