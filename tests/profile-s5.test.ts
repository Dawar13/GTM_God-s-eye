import { describe, expect, it } from "vitest";
import { buildInvestorProfile } from "@/lib/data/profile";
import { fitScore } from "@/lib/fit/score";
import type { FitFeatures } from "@/lib/schema";
import { fitBreakdown } from "@/lib/viz/transforms/fitBreakdown";
import { fundsTimeline } from "@/lib/viz/transforms/fundsTimeline";
import { investorDeals, sortPortfolio } from "@/lib/viz/transforms/investorDeals";
import { sectorBars } from "@/lib/viz/transforms/sectorBars";
import { company, competitor, fund, investor, round } from "./fixtures";

const feat = (value: number) => ({ value, method: "test", inputs: ["x"] });
function fit(
  over: Partial<FitFeatures["features"]> = {},
  flags: FitFeatures["flags"] = [],
): FitFeatures {
  return {
    id: "fit_root-ventures",
    investor_id: "inv_root-ventures",
    features: {
      thesis: feat(0.8),
      stage: feat(0.5),
      check: feat(1),
      adjacency: feat(0.2),
      geography: feat(1),
      dry_powder: feat(0),
      ...over,
    },
    flags,
    raise_size_usd: 5_000_000,
  };
}

describe("fitBreakdown", () => {
  it("segments sum to the Directory score, computed by the same function", () => {
    const f = fit();
    const b = fitBreakdown(f)!;
    expect(b.segments.reduce((a, s) => a + s.points, 0)).toBeCloseTo(fitScore(f).total, 9);
    expect(b.total).toBeCloseTo(fitScore(f).total, 9);
    expect(b.unknown).toEqual([]);
  });

  it("draws no segment for an unknown feature and rescales the rest", () => {
    const b = fitBreakdown(fit({ dry_powder: null, geography: null }, ["sparse"]))!;
    expect(b.segments.map((s) => s.feature)).toEqual(["thesis", "stage", "check", "adjacency"]);
    expect(b.unknown.map((u) => u.feature)).toEqual(["geography", "dry_powder"]);
    expect(b.coverage).toBeCloseTo(0.8, 9);
    expect(b.flags).toEqual(["sparse"]);
    expect(b.segments.reduce((a, s) => a + s.maxPoints, 0)).toBeCloseTo(100, 9);
  });

  it("is null without a fit record", () => {
    expect(fitBreakdown(null)).toBeNull();
  });
});

describe("fundsTimeline", () => {
  it("orders plotted funds by date and lists the rest with what is missing", () => {
    const t = fundsTimeline([
      fund({
        id: "fund_a_ii",
        name: "A II",
        size_usd: 200,
        close_date: "2022-05",
        vintage_year: 2022,
      }),
      fund({ id: "fund_a_i", name: "A I", size_usd: 100, close_date: "2019", vintage_year: 2019 }),
      fund({ id: "fund_a_iii", name: "A III", size_usd: null, close_date: "2024" }),
      fund({ id: "fund_a_iv", name: "A IV", size_usd: 400, close_date: null, vintage_year: null }),
      fund({ id: "fund_a_v", name: "A V", size_usd: null, close_date: null, vintage_year: null }),
      fund({ id: "fund_a_vi", name: "A VI", size_usd: 50, close_date: null, vintage_year: 2025 }),
    ]);
    expect(t.points.map((p) => p.id)).toEqual(["fund_a_i", "fund_a_ii", "fund_a_vi"]);
    expect(t.points[2]).toMatchObject({ date: "2025", dateIsVintage: true });
    expect(t.notPlotted.map((n) => [n.id, n.missing])).toEqual([
      ["fund_a_iii", "size"],
      ["fund_a_iv", "date"],
      ["fund_a_v", "size and date"],
    ]);
  });

  it("treats a stored zero size as known", () => {
    const t = fundsTimeline([fund({ size_usd: 0, close_date: "2020" })]);
    expect(t.points).toHaveLength(1);
    expect(t.notPlotted).toHaveLength(0);
  });
});

describe("sectorBars", () => {
  it("sorts by weight, drops zeros and keeps unknown separate from empty", () => {
    const s = sectorBars({
      value: { industrial_manufacturing: 0.5, ai_infra: 0.3, space: 0.2, robotics_physical_ai: 0 },
      method: "stated",
      inputs: ["thesis_text"],
    });
    expect(s.bars.map((b) => b.sector)).toEqual(["industrial_manufacturing", "ai_infra", "space"]);
    expect(s.bars.reduce((a, b) => a + b.weight, 0)).toBeCloseTo(1, 9);
    expect(s.unknown).toBe(false);
    expect(sectorBars(null)).toMatchObject({ bars: [], unknown: true });
  });
});

describe("investorDeals", () => {
  const me = "inv_root-ventures";
  const rounds = [
    round({
      id: "rnd_a_1",
      company_id: "co_a",
      date: "2024-03",
      stage: "seed",
      amount_usd: 3_000_000,
      lead_investor_ids: [me],
      participant_investor_ids: ["inv_x", "inv_y"],
      unspecified_investor_ids: [],
    }),
    round({
      id: "rnd_a_2",
      company_id: "co_a",
      date: "2025",
      stage: "series_a",
      amount_usd: 12_000_000,
      lead_investor_ids: ["inv_x"],
      participant_investor_ids: [me],
      unspecified_investor_ids: [],
    }),
    round({
      id: "rnd_t_1",
      company_id: "co_tandem",
      date: null,
      date_precision: null,
      stage: "seed",
      amount_usd: null,
      lead_investor_ids: [],
      participant_investor_ids: ["inv_y"],
      unspecified_investor_ids: [me, "inv_unnamed"],
    }),
    round({
      id: "rnd_z",
      company_id: "co_z",
      lead_investor_ids: ["inv_x"],
      unspecified_investor_ids: [],
    }),
  ];
  const companies = new Map([
    ["co_a", { id: "co_a", name: "Alpha" }],
    ["co_z", { id: "co_z", name: "Zeta" }],
  ]);
  const competitors = new Map([
    ["co_tandem", { id: "co_tandem", name: "Tandem", layer: "cmms" as never }],
  ]);
  const names = new Map([
    ["inv_x", "X Capital"],
    ["inv_y", "Y Partners"],
  ]);
  const deals = investorDeals(me, rounds, companies, competitors, names);

  it("builds the portfolio with the strongest role and the latest dated round", () => {
    expect(deals.roundCount).toBe(3);
    const a = deals.portfolio.find((r) => r.companyId === "co_a")!;
    expect(a).toMatchObject({
      rounds: 2,
      role: "lead",
      latestDate: "2025",
      latestStage: "series_a",
      latestAmountUsd: 12_000_000,
    });
    const t = deals.portfolio.find((r) => r.companyId === "co_tandem")!;
    expect(t).toMatchObject({
      isCompetitor: true,
      latestDate: null,
      latestAmountUsd: null,
      role: "unspecified",
    });
    expect(deals.portfolio.find((r) => r.companyId === "co_z")).toBeUndefined();
  });

  it("counts co-investors by distinct shared rounds and skips unnamed ones", () => {
    expect(deals.coInvestors).toEqual([
      { id: "inv_x", name: "X Capital", shared: 2 },
      { id: "inv_y", name: "Y Partners", shared: 2 },
    ]);
    expect(deals.coInvestorTotal).toBe(2);
  });

  it("limits co-investors to the top 10", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      round({
        id: `rnd_m_${i}`,
        company_id: "co_a",
        lead_investor_ids: [me],
        participant_investor_ids: [`inv_${i}`],
        unspecified_investor_ids: [],
      }),
    );
    const n = new Map(
      Array.from({ length: 15 }, (_, i) => [`inv_${i}`, `I${String(i).padStart(2, "0")}`]),
    );
    const d = investorDeals(me, many, companies, competitors, n);
    expect(d.coInvestors).toHaveLength(10);
    expect(d.coInvestorTotal).toBe(15);
  });

  it("lists competitor exposure from the same rounds", () => {
    expect(deals.competitors).toEqual([
      {
        id: "co_tandem",
        name: "Tandem",
        layer: "cmms",
        rounds: 1,
        role: "unspecified",
        latestDate: null,
      },
    ]);
  });

  it("sorts the portfolio with unknowns last in both directions", () => {
    const names = (key: Parameters<typeof sortPortfolio>[1], dir: "asc" | "desc") =>
      sortPortfolio(deals.portfolio, key, dir).map((r) => r.name);
    expect(names("latest", "desc")).toEqual(["Alpha", "Tandem"]);
    expect(names("latest", "asc")).toEqual(["Alpha", "Tandem"]);
    expect(names("amount", "asc")).toEqual(["Alpha", "Tandem"]);
    expect(names("rounds", "desc")).toEqual(["Alpha", "Tandem"]);
    expect(names("name", "desc")).toEqual(["Tandem", "Alpha"]);
  });
});

describe("buildInvestorProfile", () => {
  it("joins stored fields and leaves unknowns null", () => {
    const inv = investor({ thesis_text: null, partners: ["partner_a"], field_sources: {} });
    const p = buildInvestorProfile({
      investor: inv,
      investors: [inv],
      funds: [fund(), fund({ id: "fund_other", investor_id: "inv_other" })],
      partners: [
        {
          id: "partner_a",
          investor_id: inv.id,
          name: "Ann",
          title: null,
          focus_sectors: ["ai_infra"],
          linkedin_url: null,
        },
        {
          id: "partner_b",
          investor_id: "inv_other",
          name: "Bo",
          title: null,
          focus_sectors: [],
          linkedin_url: null,
        },
      ],
      rounds: [],
      companies: [company()],
      competitors: [competitor()],
      fit: null,
    });
    expect(p.thesis).toEqual({ text: null, sourceDomain: null });
    expect(p.fit).toBeNull();
    expect(p.sectors.unknown).toBe(true);
    expect(p.funds.points).toHaveLength(1);
    expect(p.partners.map((x) => x.name)).toEqual(["Ann"]);
    expect(p.deals.portfolio).toEqual([]);
  });
});
