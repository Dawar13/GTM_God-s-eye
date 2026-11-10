/**
 * Competitors view data (PHASE_2 S8): the table's rows and the layer map. One row per
 * competitor, built once; the charts (competitorCharts.ts) and the Inspector read the same
 * rows, so a total on a chart is the table's total (tests/viz-consistency.test.ts).
 *
 * Rules: nothing is estimated. Total raised is the record's stored `total_raised_usd`
 * (null stays null, never zero); where the record has rounds with amounts the stored total
 * equals their sum, which the consistency test checks. Revenue is `revenue_usd` as reported.
 */
import type { Competitor, Confidence, Investor, Round } from "@/lib/schema";
import type { CompetitorCategory, CompetitorLayer, DatePrecision, RoundStage } from "@/lib/schema/enums";
import { COMPETITOR_LAYERS } from "@/lib/schema/enums";
import { provenanceOf, topDomains } from "./common";
import { periodOf } from "./recentDeals";

export type NamedId = { id: string; name: string };

export type LastRound = {
  roundId: string;
  /** The date as recorded (YYYY, YYYY-Qn, YYYY-MM or YYYY-MM-DD). */
  date: string;
  datePrecision: DatePrecision;
  /** Start of the recorded period, epoch ms (UTC); the sort key. */
  x: number;
  stage: RoundStage;
  amountUsd: number | null;
  leads: NamedId[];
};

export type CompetitorRow = {
  id: string;
  name: string;
  /** The company's own site, as stored. */
  website: string | null;
  category: CompetitorCategory;
  layer: CompetitorLayer;
  foundedYear: number | null;
  /** ISO 3166-1 alpha-2. */
  hqCountry: string | null;
  /** Stored total raised; null when the record has none. */
  totalRaisedUsd: number | null;
  roundCount: number;
  /** Rounds with no date. */
  undatedRounds: number;
  /** The latest dated round, by the start of its period; null with no dated round. */
  lastRound: LastRound | null;
  /** Approximate headcount as stored. */
  headcount: number | null;
  /** Reported revenue in USD, as stored (the record has no currency, year or fx). */
  revenueUsd: number | null;
  /** Every investor named in any of its rounds, in any role. */
  investors: NamedId[];
  sourceDomain: string | null;
  confidence: Confidence | null;
};

const byName = (a: NamedId, b: NamedId) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

/** All investor ids in a round, whatever their role. */
export function roundInvestorIds(r: Round): string[] {
  return [...r.lead_investor_ids, ...r.participant_investor_ids, ...r.unspecified_investor_ids];
}

function datedPeriod(r: Round): { start: number } | null {
  if (r.date === null || r.date_precision === null) return null;
  return periodOf(r.date);
}

export function toCompetitorRows(
  competitors: readonly Competitor[],
  rounds: readonly Round[],
  investors: readonly Investor[],
): CompetitorRow[] {
  const names = new Map(investors.map((i) => [i.id, i.name]));
  const named = (id: string): NamedId | null => {
    const name = names.get(id);
    return name === undefined ? null : { id, name };
  };
  const byCompany = new Map<string, Round[]>();
  for (const r of rounds) {
    const list = byCompany.get(r.company_id) ?? [];
    list.push(r);
    byCompany.set(r.company_id, list);
  }
  return competitors.map((c) => {
    const own = byCompany.get(c.id) ?? [];
    let last: { round: Round; start: number } | null = null;
    for (const r of own) {
      const p = datedPeriod(r);
      if (!p) continue;
      if (!last || p.start > last.start || (p.start === last.start && r.id > last.round.id)) {
        last = { round: r, start: p.start };
      }
    }
    const investorMap = new Map<string, NamedId>();
    for (const r of own) {
      for (const id of roundInvestorIds(r)) {
        const n = named(id);
        if (n) investorMap.set(id, n);
      }
    }
    return {
      id: c.id,
      name: c.name,
      website: c.website,
      category: c.category,
      layer: c.layer,
      foundedYear: c.founded_year,
      hqCountry: c.hq_country,
      totalRaisedUsd: c.total_raised_usd,
      roundCount: own.length,
      undatedRounds: own.filter((r) => datedPeriod(r) === null).length,
      lastRound: last
        ? {
            roundId: last.round.id,
            date: last.round.date!,
            datePrecision: last.round.date_precision!,
            x: last.start,
            stage: last.round.stage,
            amountUsd: last.round.amount_usd,
            leads: last.round.lead_investor_ids
              .map(named)
              .filter((n): n is NamedId => n !== null)
              .sort(byName),
          }
        : null,
      headcount: c.headcount_est?.value ?? null,
      revenueUsd: c.revenue_usd,
      investors: [...investorMap.values()].sort(byName),
      ...provenanceOf([c]),
    };
  });
}

/** Totals the table and every chart must agree on. */
export type CompetitorTotals = {
  competitors: number;
  /** Sum of stored `total_raised_usd`; null when no competitor has one. */
  totalRaisedUsd: number | null;
  withTotalRaised: number;
  rounds: number;
  datedRounds: number;
  undatedRounds: number;
  /** Distinct investor-competitor pairs. */
  investorPairs: number;
};

export function competitorTotals(rows: readonly CompetitorRow[]): CompetitorTotals {
  const raised = rows.map((r) => r.totalRaisedUsd).filter((v): v is number => v !== null);
  return {
    competitors: rows.length,
    totalRaisedUsd: raised.length ? raised.reduce((a, b) => a + b, 0) : null,
    withTotalRaised: raised.length,
    rounds: rows.reduce((a, r) => a + r.roundCount, 0),
    datedRounds: rows.reduce((a, r) => a + r.roundCount - r.undatedRounds, 0),
    undatedRounds: rows.reduce((a, r) => a + r.undatedRounds, 0),
    investorPairs: rows.reduce((a, r) => a + r.investors.length, 0),
  };
}

export type RoundListItem = {
  id: string;
  date: string | null;
  stage: RoundStage;
  amountUsd: number | null;
  leads: NamedId[];
};

/** One company's rounds for the Inspector: newest first, undated last. */
export function roundList(
  companyId: string,
  rounds: readonly Round[],
  investors: ReadonlyMap<string, string>,
): RoundListItem[] {
  const own = rounds
    .filter((r) => r.company_id === companyId)
    .map((r) => ({
      x: datedPeriod(r)?.start ?? null,
      item: {
        id: r.id,
        date: r.date,
        stage: r.stage,
        amountUsd: r.amount_usd,
        leads: r.lead_investor_ids
          .map((id) => ({ id, name: investors.get(id) ?? null }))
          .filter((n): n is NamedId => n.name !== null)
          .sort(byName),
      },
    }));
  own.sort((a, b) => {
    if (a.x === null || b.x === null) {
      return a.x === b.x ? a.item.id.localeCompare(b.item.id) : a.x === null ? 1 : -1;
    }
    return b.x - a.x || b.item.id.localeCompare(a.item.id);
  });
  return own.map((o) => o.item);
}

/* ------------------------------------------------------------------------ layer map */

export const LAYER_BANDS: readonly CompetitorLayer[] = COMPETITOR_LAYERS;

export type LayerBand = { layer: CompetitorLayer; items: CompetitorRow[] };

export type LayerMapData = {
  bands: LayerBand[];
  placed: number;
  /** Competitors with no layer; the schema requires one, so this guards against drift. */
  unplaced: number;
};

/**
 * Each competitor in its layer's band, in the layer order of PROJECT_CONTEXT §2. Inside a
 * band the biggest raised first; competitors with no total raised follow, by name.
 */
export function layerMap(
  rows: readonly (Omit<CompetitorRow, "layer"> & { layer: CompetitorLayer | null })[],
): LayerMapData {
  const bands: LayerBand[] = LAYER_BANDS.map((layer) => ({ layer, items: [] }));
  let unplaced = 0;
  for (const r of rows) {
    const band = bands.find((b) => b.layer === r.layer);
    if (band) band.items.push(r as CompetitorRow);
    else unplaced += 1;
  }
  for (const b of bands) {
    b.items.sort((x, y) => {
      if (x.totalRaisedUsd === null || y.totalRaisedUsd === null) {
        if (x.totalRaisedUsd !== y.totalRaisedUsd) return x.totalRaisedUsd === null ? 1 : -1;
      } else if (x.totalRaisedUsd !== y.totalRaisedUsd) return y.totalRaisedUsd - x.totalRaisedUsd;
      return x.name.localeCompare(y.name);
    });
  }
  return { bands, placed: rows.length - unplaced, unplaced };
}

/** Most-cited source domains behind the competitors view: the records and their rounds. */
export function competitorSources(
  competitors: readonly Competitor[],
  rounds: readonly Round[],
  n = 4,
): string[] {
  const ids = new Set(competitors.map((c) => c.id));
  return topDomains([...competitors, ...rounds.filter((r) => ids.has(r.company_id))], n);
}
