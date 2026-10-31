/**
 * PHASE_2 §2.6: totals on a chart equal the Directory's for the same filters.
 * Runs against the real loaders (data/processed), so it also guards against drift
 * between the transforms and the Directory's row model.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  getBubbleLayout,
  getCompanies,
  getCompetitorOverlap,
  getCompetitors,
  getFitFeatures,
  getFunds,
  getGraph,
  getInvestors,
  getRounds,
  getThesisLayout,
} from "@/lib/data";
import {
  rowsInArea,
  toAreaCoords,
  toDirectoryRows,
  type AreaCoords,
  type DirectoryRow,
} from "@/lib/data/directory";
import { inArea, parseArea, type Area } from "@/lib/filters/area";
import { applyFilters, DEFAULT_FILTER_STATE, type FilterState } from "@/lib/filters";
import { parseFilters } from "@/lib/filters/url";
import { commandStats } from "@/lib/viz/transforms/commandStats";
import { freshCapitalByRegion } from "@/lib/viz/transforms/freshCapitalByRegion";
import { fundsByYear } from "@/lib/viz/transforms/fundsByYear";
import { bubbleView, toBubbleData, type BubbleData } from "@/lib/viz/transforms/capitalBubbles";
import { thesisView, toThesisRows, type ThesisRow } from "@/lib/viz/transforms/thesisMap";
import { topByFit } from "@/lib/viz/transforms/topByFit";
import { competitorTotals, layerMap, toCompetitorRows } from "@/lib/viz/transforms/competitors";
import {
  foundedVsRaised,
  fundingTimeline,
  overlapMatrix,
} from "@/lib/viz/transforms/competitorCharts";
import {
  competitorFlows,
  competitorSankeyLayout,
  sankeyHeight,
} from "@/lib/viz/transforms/competitorSankey";
import { competitorOverview, overviewLayout } from "@/lib/viz/transforms/competitorOverview";
import { sortRows } from "@/lib/directory/sort";
import { EXAMPLE_RAISE_USD } from "@/lib/calculators/examples";
import { DEFAULT_FIT_WEIGHTS } from "@/lib/fit/score";
import { rankStrategy, toStrategyRows, type StrategyRow } from "@/lib/viz/transforms/strategy";
import { toGraphPayload } from "@/lib/viz/transforms/graphPayload";
import {
  ALL_ROUNDS,
  investorPassMask,
  investorsWithoutRounds,
  networkView,
  toGraphData,
  type GraphData,
} from "@/lib/viz/transforms/networkGraph";

type Loaded = {
  investors: Awaited<ReturnType<typeof getInvestors>>;
  funds: Awaited<ReturnType<typeof getFunds>>;
  fits: Awaited<ReturnType<typeof getFitFeatures>>;
  rounds: Awaited<ReturnType<typeof getRounds>>;
  competitors: Awaited<ReturnType<typeof getCompetitors>>;
  rows: DirectoryRow[];
  strategyRows: StrategyRow[];
  thesisRows: ThesisRow[];
  coords: AreaCoords;
  bubbles: Awaited<ReturnType<typeof getBubbleLayout>>;
  bubbleData: BubbleData;
  graph: GraphData;
};
let d: Loaded;

beforeAll(async () => {
  const [investors, funds, fits, rounds, competitors, layout, bubbles, graph, companies] =
    await Promise.all([
      getInvestors(),
      getFunds(),
      getFitFeatures(),
      getRounds(),
      getCompetitors(),
      getThesisLayout(),
      getBubbleLayout(),
      getGraph(),
      getCompanies(),
    ]);
  d = {
    investors,
    funds,
    fits,
    rounds,
    competitors,
    rows: toDirectoryRows(investors, funds, fits),
    strategyRows: toStrategyRows(investors, fits),
    thesisRows: toThesisRows(investors, layout, bubbles, fits),
    coords: toAreaCoords(layout, bubbles),
    bubbles,
    bubbleData: toBubbleData(investors, bubbles, funds),
    graph: toGraphData(
      toGraphPayload({ graph, investors, companies, competitors, rounds, thesis: layout }),
    ),
  };
});

const everything: FilterState = { ...DEFAULT_FILTER_STATE, region: [] };
const COMBOS: [string, FilterState][] = [
  ["default (Western)", DEFAULT_FILTER_STATE],
  ["all investors", everything],
  ["India", parseFilters("region=india")],
  ["Western, seed", parseFilters("stage=seed")],
  ["all regions, fresh funds", parseFilters("region=&freshness=fresh")],
  ["Western, VC, fresh", parseFilters("type=vc&freshness=fresh")],
];

describe.each(COMBOS)("chart totals match the Directory: %s", (_name, filters) => {
  it("stat strip counts, fresh funds and dry powder", () => {
    const shown = applyFilters(d.rows, filters);
    const stats = commandStats(d.investors, d.funds, d.rounds, d.competitors.length, filters);
    expect(stats.investors).toBe(shown.length);

    const fresh = shown.filter((r) => r.freshness === "fresh");
    const sizes = fresh.map((r) => r.latestFundSizeUsd).filter((s): s is number => s !== null);
    expect(stats.freshFunds).toBe(fresh.length);
    expect(stats.freshWithoutSize).toBe(fresh.length - sizes.length);
    expect(stats.dryPowderUsd).toBe(sizes.length ? sizes.reduce((a, b) => a + b, 0) : null);
  });

  it("fresh capital by region sums to the Directory's fresh latest-fund total", () => {
    const shown = applyFilters(d.rows, filters);
    const ids = new Set(shown.map((r) => r.id));
    const chart = freshCapitalByRegion(
      d.investors.filter((i) => ids.has(i.id)),
      d.funds,
    );
    const fresh = shown.filter((r) => r.freshness === "fresh");
    const sizes = fresh.map((r) => r.latestFundSizeUsd).filter((s): s is number => s !== null);
    expect(chart.freshInvestors).toBe(fresh.length);
    expect(chart.notShown).toBe(fresh.length - sizes.length);
    expect(chart.totalUsd).toBe(sizes.length ? sizes.reduce((a, b) => a + b, 0) : null);
    expect(chart.bars.reduce((a, b) => a + b.investors, 0)).toBe(fresh.length);
  });

  it("funds by year counts every fund of the listed investors, dated or not", () => {
    const shown = applyFilters(d.rows, filters);
    const ids = new Set(shown.map((r) => r.id));
    const chart = fundsByYear(d.funds, ids);
    const expected = d.funds.filter((f) => ids.has(f.investor_id));
    expect(chart.counted + chart.notShown).toBe(expected.length);
    expect(chart.bars.reduce((a, b) => a + b.total, 0)).toBe(chart.counted);
    expect(chart.bars.reduce((a, b) => a + b.fresh + b.older, 0)).toBe(chart.counted);
  });

  it("top by fit shows the Directory's fit scores, best first", () => {
    const shown = applyFilters(d.rows, filters);
    const ids = new Set(shown.map((r) => r.id));
    const chart = topByFit(
      d.investors.filter((i) => ids.has(i.id)),
      d.fits,
    );
    const directoryFit = new Map(shown.map((r) => [r.id, r.fit]));
    for (const bar of chart.bars) {
      expect(bar.total).toBeCloseTo(directoryFit.get(bar.investorId) ?? NaN, 9);
    }
    const scored = shown.filter((r) => r.fit !== null);
    expect(chart.scored).toBe(scored.length);
    expect(chart.scored + chart.notShown).toBe(shown.length);
    const ranked = scored.filter((r) => !r.fitFlags.includes("sparse"));
    expect(chart.sparse).toBe(scored.length - ranked.length);
    const best = Math.max(...ranked.map((r) => r.fit ?? 0));
    if (chart.bars.length) expect(chart.bars[0]!.total).toBeCloseTo(best, 9);
  });
});

describe.each(COMBOS)("strategy ranking matches the Directory: %s", (_name, filters) => {
  it("default weights and a $1M raise give the Directory's fit-desc order, sparse last", () => {
    const directory = sortRows(applyFilters(d.rows, filters), "fit-desc")
      .filter((r) => r.fit !== null)
      .map((r) => r.id);
    const ranked = rankStrategy(
      applyFilters(d.strategyRows, filters),
      DEFAULT_FIT_WEIGHTS,
      EXAMPLE_RAISE_USD,
    );
    expect(ranked.map((r) => r.row.id)).toEqual(directory);
    const dirFit = new Map(applyFilters(d.rows, filters).map((r) => [r.id, r.fit]));
    for (const r of ranked) expect(r.score.total).toBeCloseTo(dirFit.get(r.row.id) ?? NaN, 9);
    const firstSparse = ranked.findIndex((r) => !r.reliable);
    if (firstSparse >= 0) expect(ranked.slice(firstSparse).every((r) => !r.reliable)).toBe(true);
  });
});

describe.each(COMBOS)("thesis map matches the Directory: %s", (_name, filters) => {
  it.each(["thesis", "fit"] as const)(
    "%s layout: marks = Directory rows with coordinates",
    (layout) => {
      const shown = applyFilters(d.rows, filters);
      const placed = shown.filter((r) => d.coords[r.id]?.[layout]);
      const view = thesisView(d.thesisRows, filters, layout, d.rows);
      expect(view.points.length).toBe(placed.length);
      expect(new Set(view.points.map((p) => p.id))).toEqual(new Set(placed.map((r) => r.id)));
      const missing = view.notShown!.reduce((s, n) => s + n.count, 0);
      expect(view.points.length + missing).toBe(shown.length);
      for (const p of view.points) {
        const c = d.coords[p.id]![layout]!;
        expect([p.px, p.py]).toEqual(c);
      }
    },
  );

  it("a brushed region lists the same investors on the map and in the Directory", () => {
    const areas: Area[] = [
      parseArea("thesis:-2,-2,6,4")!,
      parseArea("fit:0.5,0.5,1,1")!,
      parseArea("fit:0,0,0.333,0.9")!,
    ];
    for (const area of areas) {
      const map = thesisView(d.thesisRows, filters, area.layout, null).points.filter((p) =>
        inArea([p.px, p.py], area),
      );
      const directory = applyFilters(rowsInArea(d.rows, d.coords, area), filters);
      expect(map.map((p) => p.id).sort()).toEqual(directory.map((r) => r.id).sort());
    }
  });
});

describe.each(COMBOS)("capital bubbles match the Directory: %s", (_name, filters) => {
  it("bubbles = Directory rows with check, earliness and affinity; the rest are counted", () => {
    const shown = applyFilters(d.rows, filters);
    const axes = new Map(d.bubbles.map((b) => [b.id, b]));
    const placed = shown.filter((r) => {
      const b = axes.get(r.id);
      return (
        b &&
        b.typical_check_usd !== null &&
        b.stage_earliness !== null &&
        b.industrial_affinity !== null
      );
    });
    const view = bubbleView(d.bubbleData, filters, d.rows);
    expect(view.points.length).toBe(placed.length);
    const missing = view.notShown!.reduce((s, n) => s + n.count, 0);
    expect(view.points.length + missing).toBe(shown.length);
  });

  it("x is the Directory's check range (geometric mean) and size is the latest fund", () => {
    const rowById = new Map(d.rows.map((r) => [r.id, r]));
    for (const p of bubbleView(d.bubbleData, filters).points) {
      const r = rowById.get(p.id)!;
      const { checkMinUsd: lo, checkMaxUsd: hi } = r;
      const expected = lo !== null && hi !== null ? Math.sqrt(lo * hi) : (lo ?? hi);
      expect(Math.abs(p.check - expected!)).toBeLessThanOrEqual(0.5);
      expect(p.fundUsd).toBe(r.latestFundSizeUsd);
    }
  });
});

describe.each(COMBOS)("network graph matches the Directory: %s", (_name, filters) => {
  it("investor nodes = Directory investors present in the graph; the rest are counted", () => {
    const shown = applyFilters(d.rows, filters);
    const inGraph = shown.filter((r) => d.graph.index.has(r.id));
    const pass = investorPassMask(d.graph, filters, d.rows);
    const view = networkView(d.graph, {
      mode: "full",
      investorPass: pass,
      rounds: ALL_ROUNDS,
      centre: null,
      hops: 1,
    });
    expect(view.counts.investors).toBe(inGraph.length);
    const nodeIds = d.graph.nodes
      .filter((v) => v.kind === "investor" && view.node[v.i])
      .map((v) => v.id);
    expect(new Set(nodeIds)).toEqual(new Set(inGraph.map((r) => r.id)));
    expect(view.counts.investors + investorsWithoutRounds(d.graph, filters, d.rows)).toBe(
      shown.length,
    );
  });
});

describe("unfiltered stats", () => {
  it("deals and competitors do not depend on the filters", () => {
    const a = commandStats(
      d.investors,
      d.funds,
      d.rounds,
      d.competitors.length,
      DEFAULT_FILTER_STATE,
    );
    const b = commandStats(d.investors, d.funds, d.rounds, d.competitors.length, everything);
    expect(a.deals).toBe(b.deals);
    expect(a.deals).toBe(d.rounds.length);
    expect(a.competitors).toBe(d.competitors.length);
  });

  it("Western share ignores the region filter", () => {
    const a = commandStats(d.investors, d.funds, d.rounds, 0, DEFAULT_FILTER_STATE);
    const b = commandStats(d.investors, d.funds, d.rounds, 0, parseFilters("region=india"));
    expect(a.westernShare).toBe(b.westernShare);
  });
});

describe("Competitors page: charts match the table (S8)", () => {
  let rows: ReturnType<typeof toCompetitorRows>;
  let overlap: Awaited<ReturnType<typeof getCompetitorOverlap>>;
  let thesis: Awaited<ReturnType<typeof getThesisLayout>>;
  beforeAll(async () => {
    [overlap, thesis] = await Promise.all([getCompetitorOverlap(), getThesisLayout()]);
    rows = toCompetitorRows(d.competitors, d.rounds, d.investors);
  });

  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

  it("one table row per competitor, in every chart's scope", () => {
    expect(rows.length).toBe(d.competitors.length);
    const placed = layerMap(rows);
    expect(placed.placed + placed.unplaced).toBe(rows.length);
    expect(placed.bands.reduce((n, b) => n + b.items.length, 0)).toBe(placed.placed);
  });

  it("round counts: table, timeline and the rounds file agree", () => {
    const own = new Set(d.competitors.map((c) => c.id));
    const fromFile = d.rounds.filter((r) => own.has(r.company_id));
    const t = competitorTotals(rows);
    expect(t.rounds).toBe(fromFile.length);
    const tl = fundingTimeline(rows, d.rounds);
    expect(tl.dots.length + tl.undatedRounds).toBe(t.rounds);
    expect(tl.dots.length).toBe(t.datedRounds);
    expect(tl.undatedRounds).toBe(t.undatedRounds);
    expect(tl.dots.length - tl.unknownAmount).toBe(
      fromFile.filter((r) => r.date && r.amount_usd !== null).length,
    );
  });

  it("total raised: the stored totals equal the sum of the rounds, and the scatter adds up to the table", () => {
    const t = competitorTotals(rows);
    const tl = fundingTimeline(rows, d.rounds);
    // Drawn plus undated round amounts is every known round amount of the competitors.
    expect(tl.drawnAmountUsd + tl.undatedAmountUsd).toBe(t.totalRaisedUsd ?? 0);
    const sc = foundedVsRaised(rows);
    const notPlotted = rows.filter((r) => !sc.points.some((p) => p.id === r.id));
    expect(sc.totalRaisedUsd + sum(notPlotted.map((r) => r.totalRaisedUsd))).toBe(
      t.totalRaisedUsd ?? 0,
    );
    expect(sc.points.length + sc.missingFounded + sc.missingRaised).toBe(rows.length);
  });

  it("investor counts: the table's pairs are the overlap file's pairs", () => {
    const t = competitorTotals(rows);
    const pairs = overlap.rows.reduce((n, r) => n + r.competitor_ids.length, 0);
    expect(t.investorPairs).toBe(pairs);
    for (const r of overlap.rows) {
      for (const cid of r.competitor_ids) {
        const row = rows.find((x) => x.id === cid)!;
        expect(row.investors.some((i) => i.id === r.investor_id)).toBe(true);
      }
    }
  });

  it("Sankey: money view adds up to the disclosed round amounts, rounds view to the round count", () => {
    const own = new Set(d.competitors.map((c) => c.id));
    const fromFile = d.rounds.filter((r) => own.has(r.company_id));
    const withAmount = fromFile.filter((r) => r.amount_usd !== null);
    const flows = competitorFlows(d.competitors, d.rounds, d.investors);
    const frame = { height: sankeyHeight(flows), leftX: 200, rightX: 1000 };
    const right = (mode: "money" | "rounds") =>
      competitorSankeyLayout(flows, mode, frame).nodes.filter((n) => n.side === "right");
    const drawn = (mode: "money" | "rounds") =>
      new Set(
        flows.links
          .filter((l) => (mode === "money" ? l.money !== null : true))
          .flatMap((l) => l.roundIds)
          .filter((id) => mode === "rounds" || flows.rounds[id]!.amountUsd !== null),
      );

    const money = right("money");
    expect(sum(money.map((n) => n.value))).toBeCloseTo(sum(withAmount.map((r) => r.amount_usd)), 2);
    expect(drawn("money").size).toBe(withAmount.length);
    expect(money.length + flows.competitorsWithoutAmount).toBe(rows.length);
    // A competitor's node is its disclosed round amounts (the tooltip notes a different stored total).
    for (const n of money) {
      const disclosed = sum(
        withAmount.filter((r) => r.company_id === n.id).map((r) => r.amount_usd),
      );
      expect(n.value).toBeCloseTo(disclosed, 2);
    }

    const rounds = right("rounds");
    expect(sum(rounds.map((n) => n.value))).toBeCloseTo(competitorTotals(rows).rounds, 9);
    expect(drawn("rounds").size).toBe(fromFile.length);
    expect(rounds.length + flows.competitorsWithoutRounds).toBe(rows.length);
    for (const n of rounds)
      expect(n.value).toBeCloseTo(rows.find((r) => r.id === n.id)!.roundCount, 9);
    expect(flows.roundsWithoutAmount).toBe(fromFile.length - withAmount.length);
  });

  it("Sankey overview: every column adds up to the disclosed amounts or the round count", () => {
    const own = new Set(d.competitors.map((c) => c.id));
    const withAmount = d.rounds.filter((r) => own.has(r.company_id) && r.amount_usd !== null);
    const flows = competitorFlows(d.competitors, d.rounds, d.investors);
    const o = competitorOverview(flows, d.rounds);
    const frame = {
      height: 780,
      x: [220, 600, 980] as const,
      midTop: 56,
      midPad: 64,
      labelHeight: 44,
    };
    const want = {
      money: sum(withAmount.map((r) => r.amount_usd)),
      rounds: competitorTotals(rows).rounds,
    };
    for (const mode of ["money", "rounds"] as const) {
      const L = overviewLayout(o, mode, frame);
      for (const c of [0, 1, 2]) {
        const col = L.nodes.filter((n) => n.column === c);
        expect(sum(col.map((n) => n.value))).toBeCloseTo(want[mode], 2);
      }
      // Categories are exact: the table rows of that category, summed.
      for (const n of L.nodes.filter((x) => x.column === 1)) {
        const cat = o.nodes.find((x) => x.id === n.id)!.category;
        const mine = rows.filter((r) => r.category === cat);
        const exact =
          mode === "money"
            ? sum(
                withAmount
                  .filter((r) => mine.some((m) => m.id === r.company_id))
                  .map((r) => r.amount_usd),
              )
            : sum(mine.map((r) => r.roundCount));
        expect(n.valueOut).toBeCloseTo(exact, 2);
        expect(n.valueIn).toBeCloseTo(exact, 2);
      }
    }
    expect(o.totals.competitorsWithAmount + flows.competitorsWithoutAmount).toBe(rows.length);
  });

  it("heatmap: every filled cell is a table investor, with at least one round", () => {
    const m = overlapMatrix(overlap, rows, d.investors, thesis, d.rounds);
    expect(m.rows.length + m.hiddenInvestors).toBe(overlap.rows.length);
    expect(m.cells).toBe(m.rows.reduce((n, r) => n + Object.keys(r.cells).length, 0));
    for (const r of m.rows) {
      expect(r.overlap).toBeGreaterThanOrEqual(m.minCompetitors);
      for (const [cid, cell] of Object.entries(r.cells)) {
        expect(cell.rounds).toBeGreaterThanOrEqual(1);
        expect(rows.find((x) => x.id === cid)!.investors.some((i) => i.id === r.investorId)).toBe(
          true,
        );
      }
    }
  });
});
