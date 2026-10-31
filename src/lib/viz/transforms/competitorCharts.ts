/**
 * Chart data for the Competitors page (PHASE_2 S8): founded year against total raised, the
 * funding timeline and the investor overlap matrix. All three start from the same
 * CompetitorRow list as the table (competitors.ts), so their totals are the table's.
 * Unknown values are left out and counted, never drawn as zero.
 */
import type {
  CompetitorOverlapDocument,
  Confidence,
  Investor,
  Round,
  ThesisPoint,
} from "@/lib/schema";
import type { CompetitorLayer, DatePrecision, RoundStage } from "@/lib/schema/enums";
import { provenanceOf, topDomains } from "./common";
import { LAYER_BANDS, roundInvestorIds, type CompetitorRow } from "./competitors";
import { periodOf } from "./recentDeals";

const layerRank = (l: CompetitorLayer) => LAYER_BANDS.indexOf(l);

/* ------------------------------------------------------------- founded vs total raised */

export type ScatterPoint = {
  id: string;
  name: string;
  layer: CompetitorLayer;
  /** Founded year. */
  x: number;
  /** Total raised, USD (log axis). */
  y: number;
  /** Approximate headcount; null draws a fixed-size ring. */
  headcount: number | null;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type FoundedVsRaised = {
  points: ScatterPoint[];
  /** Largest headcount among the points, the size scale's maximum. */
  maxHeadcount: number | null;
  /** Points drawn as a ring because headcount is unknown. */
  unknownHeadcount: number;
  /** Competitors without a founded year. */
  missingFounded: number;
  /** Competitors with a founded year but no total raised (each counted once, under the first gap). */
  missingRaised: number;
  xDomain: [number, number] | null;
  /** Powers of ten around the data, for the log axis. */
  yDomain: [number, number] | null;
  /** Sum of `y` over the points; the table's total minus the competitors not shown. */
  totalRaisedUsd: number;
};

export function foundedVsRaised(rows: readonly CompetitorRow[]): FoundedVsRaised {
  const points: ScatterPoint[] = [];
  let missingFounded = 0;
  let missingRaised = 0;
  for (const r of rows) {
    if (r.foundedYear === null) missingFounded += 1;
    else if (r.totalRaisedUsd === null || !(r.totalRaisedUsd > 0)) missingRaised += 1;
    else {
      points.push({
        id: r.id,
        name: r.name,
        layer: r.layer,
        x: r.foundedYear,
        y: r.totalRaisedUsd,
        headcount: r.headcount,
        sourceDomain: r.sourceDomain,
        confidence: r.confidence,
      });
    }
  }
  const heads = points.map((p) => p.headcount).filter((h): h is number => h !== null);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    points,
    maxHeadcount: heads.length ? Math.max(...heads) : null,
    unknownHeadcount: points.length - heads.length,
    missingFounded,
    missingRaised,
    xDomain: xs.length ? [Math.min(...xs) - 1, Math.max(...xs) + 1] : null,
    yDomain: ys.length
      ? [10 ** Math.floor(Math.log10(Math.min(...ys))), 10 ** Math.ceil(Math.log10(Math.max(...ys)))]
      : null,
    totalRaisedUsd: ys.reduce((a, b) => a + b, 0),
  };
}

/** Radius for a size value so that area is proportional to value; never below `floor` pixels. */
export function areaRadius(value: number, max: number, maxRadius: number, floor: number): number {
  if (!(max > 0) || !(value >= 0)) return floor;
  return Math.max(floor, maxRadius * Math.sqrt(value / max));
}

/* ------------------------------------------------------------------- funding timeline */

export type TimelineDot = {
  roundId: string;
  companyId: string;
  name: string;
  layer: CompetitorLayer;
  /** Row index in `lanes`. */
  lane: number;
  /** The date as recorded. */
  date: string;
  datePrecision: DatePrecision;
  /** Start of the recorded period, epoch ms (UTC). */
  x: number;
  stage: RoundStage;
  /** Null draws a fixed-size ring. */
  amountUsd: number | null;
  contested: boolean;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type FundingTimeline = {
  /** One row per competitor with at least one dated round, by layer then name. */
  lanes: { id: string; name: string; layer: CompetitorLayer }[];
  dots: TimelineDot[];
  maxAmountUsd: number | null;
  /** Dots with an unknown amount. */
  unknownAmount: number;
  /** Rounds with no date: counted, not drawn. */
  undatedRounds: number;
  /** Sum of known amounts over drawn dots. */
  drawnAmountUsd: number;
  /** Sum of known amounts over undated rounds. */
  undatedAmountUsd: number;
  /** Competitors with no dated round, so no row. */
  withoutDatedRound: number;
  xMin: number | null;
  xMax: number | null;
  sources: string[];
};

export function fundingTimeline(
  rows: readonly CompetitorRow[],
  rounds: readonly Round[],
): FundingTimeline {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const dots: TimelineDot[] = [];
  const used: Round[] = [];
  let undatedRounds = 0;
  let undatedAmountUsd = 0;
  for (const r of rounds) {
    const c = byId.get(r.company_id);
    if (!c) continue;
    const period = r.date === null || r.date_precision === null ? null : periodOf(r.date);
    if (!period || r.date === null || r.date_precision === null) {
      undatedRounds += 1;
      undatedAmountUsd += r.amount_usd ?? 0;
      continue;
    }
    used.push(r);
    dots.push({
      roundId: r.id,
      companyId: c.id,
      name: c.name,
      layer: c.layer,
      lane: -1,
      date: r.date,
      datePrecision: r.date_precision,
      x: period.start,
      stage: r.stage,
      amountUsd: r.amount_usd,
      contested: r.contested,
      ...provenanceOf([r]),
    });
  }
  const laneIds = [...new Set(dots.map((d) => d.companyId))];
  const lanes = laneIds
    .map((id) => byId.get(id)!)
    .sort((a, b) => layerRank(a.layer) - layerRank(b.layer) || a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, layer: c.layer }));
  const laneOf = new Map(lanes.map((l, i) => [l.id, i]));
  for (const d of dots) d.lane = laneOf.get(d.companyId)!;
  dots.sort((a, b) => a.x - b.x || a.roundId.localeCompare(b.roundId));
  const amounts = dots.map((d) => d.amountUsd).filter((a): a is number => a !== null);
  return {
    lanes,
    dots,
    maxAmountUsd: amounts.length ? Math.max(...amounts) : null,
    unknownAmount: dots.length - amounts.length,
    undatedRounds,
    drawnAmountUsd: amounts.reduce((a, b) => a + b, 0),
    undatedAmountUsd,
    withoutDatedRound: rows.length - lanes.length,
    xMin: dots.length ? Math.min(...dots.map((d) => d.x)) : null,
    xMax: dots.length ? Math.max(...dots.map((d) => d.x)) : null,
    sources: topDomains(used, 4),
  };
}

/* ------------------------------------------------------------------- overlap heatmap */

export type HeatColumn = { id: string; name: string; layer: CompetitorLayer };

export type HeatCell = {
  /** Rounds of this competitor that name the investor. */
  rounds: number;
  /** Latest recorded date among those rounds. */
  latest: string | null;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type HeatRow = {
  investorId: string;
  name: string;
  /** layout_thesis cluster index; null sorts last, in its own group. */
  cluster: number | null;
  /** Competitors the investor backs (the sort key within a cluster, descending). */
  overlap: number;
  cells: Record<string, HeatCell>;
};

export type OverlapMatrix = {
  /** All competitors in the overlap file, by layer then name. */
  columns: HeatColumn[];
  /** Investors backing at least `minCompetitors`, by cluster, then overlap descending, then name. */
  rows: HeatRow[];
  minCompetitors: number;
  /** Investors in competitor_overlap. */
  totalInvestors: number;
  /** Investors left out because they back fewer than `minCompetitors`. */
  hiddenInvestors: number;
  /** Largest round count in one cell, the colour scale's maximum. */
  maxRounds: number;
  /** Filled cells. */
  cells: number;
  sources: string[];
};

export function overlapMatrix(
  overlap: CompetitorOverlapDocument,
  competitors: readonly CompetitorRow[],
  investors: readonly Investor[],
  thesis: readonly ThesisPoint[],
  rounds: readonly Round[],
  minCompetitors = 2,
): OverlapMatrix {
  const names = new Map(investors.map((i) => [i.id, i.name]));
  const cluster = new Map(thesis.map((p) => [p.id, p.cluster_id]));
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const comp = new Map(competitors.map((c) => [c.id, c]));
  const columns = overlap.competitor_ids
    .map((id) => comp.get(id))
    .filter((c): c is CompetitorRow => c !== undefined)
    .sort((a, b) => layerRank(a.layer) - layerRank(b.layer) || a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, layer: c.layer }));

  const rows: HeatRow[] = [];
  const used: Round[] = [];
  let hidden = 0;
  let maxRounds = 0;
  let cells = 0;
  for (const row of overlap.rows) {
    const name = names.get(row.investor_id);
    if (name === undefined) continue;
    if (row.competitor_ids.length < minCompetitors) {
      hidden += 1;
      continue;
    }
    const cellMap: Record<string, HeatCell> = {};
    for (const cid of row.competitor_ids) {
      const own = row.round_ids
        .map((id) => roundById.get(id))
        .filter(
          (r): r is Round =>
            r !== undefined && r.company_id === cid && roundInvestorIds(r).includes(row.investor_id),
        );
      const dates = own.map((r) => r.date).filter((d): d is string => d !== null);
      cellMap[cid] = {
        rounds: own.length,
        latest: dates.length ? dates.reduce((a, b) => (a >= b ? a : b)) : null,
        ...provenanceOf(own),
      };
      used.push(...own);
      maxRounds = Math.max(maxRounds, own.length);
      cells += 1;
    }
    rows.push({
      investorId: row.investor_id,
      name,
      cluster: cluster.get(row.investor_id) ?? null,
      overlap: row.competitor_ids.length,
      cells: cellMap,
    });
  }
  rows.sort(
    (a, b) =>
      (a.cluster ?? Number.POSITIVE_INFINITY) - (b.cluster ?? Number.POSITIVE_INFINITY) ||
      b.overlap - a.overlap ||
      a.name.localeCompare(b.name),
  );
  return {
    columns,
    rows,
    minCompetitors,
    totalInvestors: rows.length + hidden,
    hiddenInvestors: hidden,
    maxRounds,
    cells,
    sources: topDomains(used, 4),
  };
}

/**
 * Colour position for a cell of `rounds` rounds: one round is a clearly visible mid-light
 * step (0.3) and the most rounds is 1, so a pair backed once never reads as empty.
 */
export function heatPosition(rounds: number, maxRounds: number): number {
  if (rounds <= 0) return 0;
  if (maxRounds <= 1) return 0.55;
  return 0.3 + (0.7 * (rounds - 1)) / (maxRounds - 1);
}
