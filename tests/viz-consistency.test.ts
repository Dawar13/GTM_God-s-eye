/**
 * PHASE_2 §2.6: totals on a chart equal the Directory's for the same filters.
 * Runs against the real loaders (data/processed), so it also guards against drift
 * between the transforms and the Directory's row model.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { getCompetitors, getFitFeatures, getFunds, getInvestors, getRounds } from "@/lib/data";
import { toDirectoryRows, type DirectoryRow } from "@/lib/data/directory";
import { applyFilters, DEFAULT_FILTER_STATE, type FilterState } from "@/lib/filters";
import { parseFilters } from "@/lib/filters/url";
import { commandStats } from "@/lib/viz/transforms/commandStats";
import { freshCapitalByRegion } from "@/lib/viz/transforms/freshCapitalByRegion";
import { fundsByYear } from "@/lib/viz/transforms/fundsByYear";
import { topByFit } from "@/lib/viz/transforms/topByFit";

type Loaded = {
  investors: Awaited<ReturnType<typeof getInvestors>>;
  funds: Awaited<ReturnType<typeof getFunds>>;
  fits: Awaited<ReturnType<typeof getFitFeatures>>;
  rounds: Awaited<ReturnType<typeof getRounds>>;
  competitors: Awaited<ReturnType<typeof getCompetitors>>;
  rows: DirectoryRow[];
};
let d: Loaded;

beforeAll(async () => {
  const [investors, funds, fits, rounds, competitors] = await Promise.all([
    getInvestors(),
    getFunds(),
    getFitFeatures(),
    getRounds(),
    getCompetitors(),
  ]);
  d = {
    investors,
    funds,
    fits,
    rounds,
    competitors,
    rows: toDirectoryRows(investors, funds, fits),
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
