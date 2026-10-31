import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER_STATE } from "@/lib/filters";
import type { FitFeatures } from "@/lib/schema";
import { commandStats } from "@/lib/viz/transforms/commandStats";
import {
  FRESHNESS_CUTOFF,
  isFreshFund,
  provenanceOf,
  topDomains,
} from "@/lib/viz/transforms/common";
import { freshCapitalByRegion } from "@/lib/viz/transforms/freshCapitalByRegion";
import { fundsByYear } from "@/lib/viz/transforms/fundsByYear";
import { periodOf, recentDeals } from "@/lib/viz/transforms/recentDeals";
import { topByFit } from "@/lib/viz/transforms/topByFit";
import { company, competitor, fund, investor, round, source } from "./fixtures";

const feat = (value: number) => ({ value, method: "test", inputs: [] });
function fit(
  id: string,
  over: Partial<FitFeatures["features"]> = {},
  flags: FitFeatures["flags"] = [],
): FitFeatures {
  return {
    id: `fit_${id}`,
    investor_id: `inv_${id}`,
    features: {
      thesis: feat(1),
      stage: feat(1),
      check: feat(1),
      adjacency: feat(1),
      geography: feat(1),
      dry_powder: feat(1),
      ...over,
    },
    flags,
    raise_size_usd: 1_000_000,
  };
}

describe("isFreshFund", () => {
  it("compares the close date to the cutoff and falls back to the vintage year", () => {
    expect(FRESHNESS_CUTOFF).toBe("2024-10-29");
    expect(isFreshFund({ close_date: "2024-10-29", vintage_year: 2024 })).toBe(true);
    expect(isFreshFund({ close_date: "2024-10-28", vintage_year: 2024 })).toBe(false);
    expect(isFreshFund({ close_date: "2025", vintage_year: 2025 })).toBe(true);
    expect(isFreshFund({ close_date: null, vintage_year: 2019 })).toBe(false);
    expect(isFreshFund({ close_date: null, vintage_year: null })).toBeNull();
  });
});

describe("provenanceOf", () => {
  it("reports the most common domain, the extra count and the lowest confidence", () => {
    const s = (url: string) => ({ ...source, url, kind: "secondary" as const });
    const p = provenanceOf([
      { sources: [s("https://www.a.com/x")], confidence: "high" },
      { sources: [s("https://a.com/y")], confidence: "low" },
      { sources: [s("https://b.com/z")], confidence: "medium" },
    ]);
    expect(p).toEqual({ sourceDomain: "a.com +1 more", confidence: "low" });
    expect(provenanceOf([])).toEqual({ sourceDomain: null, confidence: null });
  });
});

describe("fundsByYear", () => {
  const funds = [
    fund({ id: "fund_a_i", investor_id: "inv_a", close_date: "2022-05", vintage_year: 2022 }),
    fund({ id: "fund_a_ii", investor_id: "inv_a", close_date: "2025-03-01", vintage_year: 2025 }),
    fund({ id: "fund_a_iii", investor_id: "inv_a", close_date: "2025-12", vintage_year: 2025 }),
    fund({ id: "fund_b_i", investor_id: "inv_b", close_date: "2024-11-02", vintage_year: 2024 }),
    fund({ id: "fund_b_ii", investor_id: "inv_b", close_date: "2024-01", vintage_year: 2024 }),
    fund({ id: "fund_c_i", investor_id: "inv_c", close_date: null, vintage_year: null }),
    fund({ id: "fund_z_i", investor_id: "inv_z", close_date: "2020", vintage_year: 2020 }),
  ];

  it("counts per close year, splits fresh and older, keeps empty years as zeros", () => {
    const r = fundsByYear(funds, new Set(["inv_a", "inv_b", "inv_c"]));
    expect(r.bars.map((b) => [b.year, b.fresh, b.older])).toEqual([
      [2022, 0, 1],
      [2023, 0, 0],
      [2024, 1, 1],
      [2025, 2, 0],
    ]);
    expect(r.counted).toBe(6 - 1);
    expect(r.notShown).toBe(1);
  });

  it("ignores funds of investors outside the selection and handles an empty selection", () => {
    expect(fundsByYear(funds, new Set(["inv_z"])).bars).toEqual([
      expect.objectContaining({ year: 2020, total: 1 }),
    ]);
    expect(fundsByYear(funds, new Set())).toMatchObject({ bars: [], counted: 0, notShown: 0 });
  });
});

describe("freshCapitalByRegion", () => {
  const fresh = {
    freshness: "fresh" as const,
    maturity: null,
    is_early_stage: null,
    is_generalist: null,
    cluster_id: null,
    industrial_affinity: null,
    stage_earliness: null,
  };
  const inv = (
    id: string,
    region: "western" | "india" | "other" | null,
    freshness: "fresh" | "older",
  ) => investor({ id: `inv_${id}`, region, category: { ...fresh, freshness } });
  const investors = [
    inv("w1", "western", "fresh"),
    inv("w2", "western", "fresh"),
    inv("w3", "western", "older"),
    inv("i1", "india", "fresh"),
    inv("u1", null, "fresh"),
  ];
  const funds = [
    fund({
      id: "fund_w1_i",
      investor_id: "inv_w1",
      size_usd: 100,
      vintage_year: 2020,
      close_date: "2020",
    }),
    fund({
      id: "fund_w1_ii",
      investor_id: "inv_w1",
      size_usd: 300,
      vintage_year: 2025,
      close_date: "2025",
    }),
    fund({
      id: "fund_w2_i",
      investor_id: "inv_w2",
      size_usd: null,
      vintage_year: 2025,
      close_date: "2025",
    }),
    fund({
      id: "fund_w3_i",
      investor_id: "inv_w3",
      size_usd: 999,
      vintage_year: 2018,
      close_date: "2018",
    }),
    fund({
      id: "fund_i1_i",
      investor_id: "inv_i1",
      size_usd: null,
      vintage_year: 2025,
      close_date: "2025",
    }),
    fund({
      id: "fund_u1_i",
      investor_id: "inv_u1",
      size_usd: 50,
      vintage_year: 2025,
      close_date: "2025",
    }),
  ];

  it("sums each fresh investor's latest fund, with unknown sizes left out, not zeroed", () => {
    const r = freshCapitalByRegion(investors, funds);
    const by = Object.fromEntries(r.bars.map((b) => [b.region, b]));
    expect(by.western).toMatchObject({ investors: 2, capitalUsd: 300, withoutSize: 1 });
    expect(by.india).toMatchObject({ investors: 1, capitalUsd: null, withoutSize: 1 });
    expect(by.other).toMatchObject({ investors: 0, capitalUsd: 0 });
    expect(by.unknown).toMatchObject({ investors: 1, capitalUsd: 50 });
    expect(r.totalUsd).toBe(350);
    expect(r.freshInvestors).toBe(4);
    expect(r.notShown).toBe(2);
  });
});

describe("topByFit", () => {
  const investors = ["a", "b", "c", "d"].map((id) =>
    investor({ id: `inv_${id}`, name: id.toUpperCase() }),
  );

  it("ranks by default-weight score, passes flags and null features through", () => {
    const fits = [
      fit("a", { thesis: feat(0.5) }),
      fit("b", { check: null, adjacency: null }),
      fit("c", { thesis: feat(0) }, ["conflict"]),
      fit("zz"),
    ];
    const r = topByFit(investors, fits, 2);
    expect(r.bars.map((b) => b.investorId)).toEqual(["inv_b", "inv_a"]);
    expect(r.bars[0]).toMatchObject({ rank: 1 });
    expect(r.bars[0]!.total).toBeCloseTo(100, 9);
    expect(r.bars[0]!.contributions.check).toBeNull();
    expect(r.bars[1]!.total).toBeCloseTo(85, 9);
    const sum = Object.values(r.bars[1]!.contributions).reduce<number>((a, v) => a + (v ?? 0), 0);
    expect(sum).toBeCloseTo(r.bars[1]!.total, 9);
    expect(r.scored).toBe(3);
    expect(r.sparse).toBe(0);
    expect(r.notShown).toBe(1);
  });

  it("leaves sparse-flagged investors out of the ranking and counts them", () => {
    const fits = [
      fit("a", { thesis: feat(0.5) }),
      fit("b", { check: null, adjacency: null, stage: null }, ["sparse"]),
      fit("c", { thesis: feat(0) }, ["conflict"]),
    ];
    const r = topByFit(investors, fits, 3);
    expect(r.bars.map((b) => b.investorId)).toEqual(["inv_a", "inv_c"]);
    expect(r.bars[1]).toMatchObject({ rank: 2, flags: ["conflict"] });
    expect(r.scored).toBe(3);
    expect(r.sparse).toBe(1);
  });
});

describe("recentDeals", () => {
  const companies = [
    company({ id: "co_in", name: "In layer", layer: "plant_ops" }),
    company({ id: "co_out", name: "No layer", layer: null }),
  ];
  const competitors = [competitor({ id: "co_comp", name: "Comp", layer: "design_intent" })];
  const r = (
    id: string,
    company_id: string,
    date: string | null,
    precision: "year" | "month" | "day" | null,
  ) => round({ id: `rnd_${id}`, company_id, date, date_precision: precision });

  it("reads period bounds for partial dates", () => {
    expect(periodOf("2025")).toEqual({
      start: Date.UTC(2025, 0, 1),
      end: Date.UTC(2026, 0, 1) - 1,
    });
    expect(periodOf("2025-Q2")?.start).toBe(Date.UTC(2025, 3, 1));
    expect(periodOf("2025-02")?.end).toBe(Date.UTC(2025, 2, 1) - 1);
    expect(periodOf("nope")).toBeNull();
  });

  it("keeps only dated rounds of layered companies and competitors inside the window", () => {
    const out = recentDeals(
      [
        r("1", "co_in", "2025-03-04", "day"),
        r("2", "co_comp", "2026-01", "month"),
        r("3", "co_out", "2026-01", "month"),
        r("4", "co_in", "2023-06-01", "day"),
        r("5", "co_in", null, null),
        r("6", "co_in", "2024", "year"),
        r("7", "co_in", "2024-10-28", "day"),
      ],
      companies,
      competitors,
    );
    expect(out.dots.map((d) => d.roundId)).toEqual(["rnd_6", "rnd_1", "rnd_2"]);
    expect(out.dots.find((d) => d.roundId === "rnd_2")).toMatchObject({
      isCompetitor: true,
      layer: "design_intent",
    });
    expect(out.notShown).toBe(1);
    expect(out.earlier).toBe(2);
    expect(out.counted).toBe(3);
  });
});

describe("commandStats", () => {
  const cat = (freshness: "fresh" | "older" | null) => ({
    freshness,
    maturity: null,
    is_early_stage: null,
    is_generalist: null,
    cluster_id: null,
    industrial_affinity: null,
    stage_earliness: null,
  });
  const investors = [
    investor({ id: "inv_w1", region: "western", category: cat("fresh") }),
    investor({ id: "inv_w2", region: "western", category: cat("older") }),
    investor({ id: "inv_i1", region: "india", category: cat("fresh") }),
    investor({ id: "inv_u1", region: null, category: cat("fresh") }),
  ];
  const funds = [
    fund({ id: "fund_w1_i", investor_id: "inv_w1", size_usd: 100 }),
    fund({ id: "fund_i1_i", investor_id: "inv_i1", size_usd: null }),
  ];
  const rounds = [round(), round({ id: "rnd_2", date: null, date_precision: null })];

  it("applies the filters to investor stats and leaves deals and competitors unfiltered", () => {
    const west = commandStats(investors, funds, rounds, 44, DEFAULT_FILTER_STATE);
    expect(west).toMatchObject({
      investors: 2,
      investorsAll: 4,
      freshFunds: 1,
      dryPowderUsd: 100,
      freshWithoutSize: 0,
      deals: 2,
      dealsDated: 1,
      competitors: 44,
    });
    // Western share ignores the region filter and excludes unknown regions: 2 of 3 known.
    expect(west.westernShare).toBeCloseTo(2 / 3, 9);
    expect(west.regionUnknown).toBe(1);

    const all = commandStats(investors, funds, rounds, 44, { ...DEFAULT_FILTER_STATE, region: [] });
    expect(all).toMatchObject({
      investors: 4,
      freshFunds: 3,
      dryPowderUsd: 100,
      freshWithoutSize: 2,
    });
  });

  it("gives null, not zero, when nothing is known", () => {
    const s = commandStats([investor({ id: "inv_u", region: null })], [], [], 0, {
      ...DEFAULT_FILTER_STATE,
      region: [],
    });
    expect(s.westernShare).toBeNull();
    expect(s.dryPowderUsd).toBeNull();
  });
});

describe("topDomains", () => {
  const at = (url: string) => ({ ...source, url, kind: "secondary" as const });

  it("picks the most-cited domain of a single record, not the alphabetically first", () => {
    const one = investor({
      sources: [
        at("https://www.8vc.com/a"),
        at("https://luxcapital.com/x"),
        at("https://luxcapital.com/y"),
      ],
    });
    expect(topDomains([one], 1)).toEqual(["luxcapital.com"]);
    expect(provenanceOf([one]).sourceDomain).toBe("luxcapital.com +1 more");
  });

  it("ranks by records first, so one record's many pages do not dominate", () => {
    const a = investor({
      id: "inv_a",
      sources: [at("https://x.com/1"), at("https://x.com/2"), at("https://x.com/3")],
    });
    const b = investor({ id: "inv_b", sources: [at("https://y.com/1")] });
    const c = investor({ id: "inv_c", sources: [at("https://y.com/2")] });
    expect(topDomains([a, b, c], 2)).toEqual(["y.com", "x.com"]);
  });
});
