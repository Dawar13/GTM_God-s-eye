import { describe, expect, it } from "vitest";
import type { Competitor, Investor, Round } from "@/lib/schema";
import {
  competitorTotals,
  layerMap,
  roundList,
  toCompetitorRows,
} from "@/lib/viz/transforms/competitors";

const src = [{ url: "https://example.com/a", kind: "primary", retrieved_at: "2026-10-01" }];

function comp(id: string, over: Partial<Competitor> = {}): Competitor {
  return {
    id,
    name: id.toUpperCase(),
    website: null,
    hq_country: "US",
    founded_year: 2020,
    sector: null,
    sector_classified_by: null,
    layer: "plant_ops",
    description_short: null,
    total_raised_usd: null,
    sources: src,
    field_sources: {},
    confidence: "high",
    is_competitor: true,
    category: "direct",
    layer_detail: null,
    size_class: null,
    founders: [],
    named_customers: [],
    headcount_est: null,
    revenue_usd: null,
    revenue_basis: "none",
    product_summary: null,
    pricing: null,
    ...over,
  } as unknown as Competitor;
}

function round(id: string, company_id: string, over: Partial<Round> = {}): Round {
  return {
    id,
    company_id,
    date: "2025-03",
    date_precision: "month",
    stage: "seed",
    stage_raw: null,
    amount_usd: 1_000_000,
    amount_original: null,
    currency_original: null,
    fx: null,
    valuation_post_usd: null,
    lead_investor_ids: [],
    participant_investor_ids: [],
    unspecified_investor_ids: [],
    contested: false,
    notes: null,
    sources: src,
    field_sources: {},
    confidence: "high",
    ...over,
  } as unknown as Round;
}

const inv = (id: string, name: string) => ({ id, name }) as unknown as Investor;
const investors = [inv("inv_a", "Alpha"), inv("inv_b", "Beta"), inv("inv_c", "Gamma")];

describe("toCompetitorRows", () => {
  const competitors = [
    comp("co_1", { total_raised_usd: 5_000_000, headcount_est: { value: 40, source: src[0] } as never }),
    comp("co_2"),
  ];
  const rounds = [
    round("r1", "co_1", { date: "2024-06", lead_investor_ids: ["inv_a"] }),
    round("r2", "co_1", {
      date: "2025-03",
      amount_usd: null,
      lead_investor_ids: ["inv_b"],
      participant_investor_ids: ["inv_a"],
      unspecified_investor_ids: ["inv_c"],
    }),
    round("r3", "co_1", { date: null, date_precision: null }),
  ];
  const rows = toCompetitorRows(competitors, rounds, investors);

  it("takes the last round from the latest dated period and ignores undated ones", () => {
    expect(rows[0]!.lastRound?.roundId).toBe("r2");
    expect(rows[0]!.lastRound?.amountUsd).toBeNull();
    expect(rows[0]!.lastRound?.leads.map((l) => l.name)).toEqual(["Beta"]);
    expect(rows[0]!.undatedRounds).toBe(1);
    expect(rows[0]!.roundCount).toBe(3);
  });

  it("has no last round when every round is undated or there are none", () => {
    expect(rows[1]!.lastRound).toBeNull();
    expect(rows[1]!.roundCount).toBe(0);
  });

  it("counts investors in every role once, by name", () => {
    expect(rows[0]!.investors.map((i) => i.name)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(rows[1]!.investors).toEqual([]);
  });

  it("keeps unknown values null, never zero", () => {
    expect(rows[1]!.totalRaisedUsd).toBeNull();
    expect(rows[1]!.headcount).toBeNull();
    expect(rows[1]!.revenueUsd).toBeNull();
    expect(rows[0]!.headcount).toBe(40);
  });

  it("totals match the rows", () => {
    const t = competitorTotals(rows);
    expect(t).toMatchObject({
      competitors: 2,
      totalRaisedUsd: 5_000_000,
      withTotalRaised: 1,
      rounds: 3,
      datedRounds: 2,
      undatedRounds: 1,
      investorPairs: 3,
    });
    expect(competitorTotals(toCompetitorRows([comp("co_9")], [], investors)).totalRaisedUsd).toBeNull();
  });
});

describe("roundList", () => {
  it("lists newest first with undated rounds last", () => {
    const list = roundList(
      "co_1",
      [
        round("r1", "co_1", { date: "2023" }),
        round("r2", "co_1", { date: null, date_precision: null }),
        round("r3", "co_1", { date: "2025-01" }),
        round("r4", "co_2"),
      ],
      new Map(),
    );
    expect(list.map((r) => r.id)).toEqual(["r3", "r1", "r2"]);
  });
});

describe("layerMap", () => {
  const rows = toCompetitorRows(
    [
      comp("co_a", { layer: "robotics", total_raised_usd: 10 }),
      comp("co_b", { layer: "design_intent", total_raised_usd: null }),
      comp("co_c", { layer: "design_intent", total_raised_usd: 50 }),
    ],
    [],
    investors,
  );
  const m = layerMap(rows);

  it("orders the bands design intent to full-stack factory", () => {
    expect(m.bands.map((b) => b.layer)).toEqual([
      "design_intent",
      "process_planning",
      "plant_ops",
      "quality_vision",
      "autonomy_tooling",
      "robotics",
      "full_stack_factory",
    ]);
  });

  it("places every competitor once, biggest raiser first, unknown raised last", () => {
    expect(m.bands[0]!.items.map((r) => r.id)).toEqual(["co_c", "co_b"]);
    expect(m.bands[5]!.items.map((r) => r.id)).toEqual(["co_a"]);
    expect(m.placed).toBe(3);
    expect(m.unplaced).toBe(0);
  });

  it("counts competitors with no layer instead of placing them", () => {
    const withNull = layerMap([...rows, { ...rows[0]!, id: "co_x", layer: null }]);
    expect(withNull.unplaced).toBe(1);
    expect(withNull.placed).toBe(3);
  });
});

import type { CompetitorOverlapDocument, ThesisPoint } from "@/lib/schema";
import {
  areaRadius,
  foundedVsRaised,
  fundingTimeline,
  heatPosition,
  overlapMatrix,
} from "@/lib/viz/transforms/competitorCharts";

describe("foundedVsRaised", () => {
  const rows = toCompetitorRows(
    [
      comp("co_1", { founded_year: 2018, total_raised_usd: 10_000_000, headcount_est: { value: 100, source: src[0] } as never }),
      comp("co_2", { founded_year: 2021, total_raised_usd: 2_000_000 }),
      comp("co_3", { founded_year: null, total_raised_usd: 5_000_000 }),
      comp("co_4", { founded_year: 2020, total_raised_usd: null }),
      comp("co_5", { founded_year: null, total_raised_usd: null }),
    ],
    [],
    investors,
  );
  const d = foundedVsRaised(rows);

  it("plots only competitors with both values and counts each other once", () => {
    expect(d.points.map((p) => p.id)).toEqual(["co_1", "co_2"]);
    expect(d.missingFounded).toBe(2);
    expect(d.missingRaised).toBe(1);
    expect(d.points.length + d.missingFounded + d.missingRaised).toBe(rows.length);
  });

  it("keeps unknown headcount null and counts it", () => {
    expect(d.points[1]!.headcount).toBeNull();
    expect(d.unknownHeadcount).toBe(1);
    expect(d.maxHeadcount).toBe(100);
  });

  it("spans whole powers of ten for the log axis", () => {
    expect(d.yDomain).toEqual([1e6, 1e7]);
    expect(d.xDomain).toEqual([2017, 2022]);
    expect(d.totalRaisedUsd).toBe(12_000_000);
  });

  it("gives marks an area proportional to value above the floor", () => {
    expect(areaRadius(100, 100, 20, 2.5)).toBe(20);
    expect(areaRadius(25, 100, 20, 2.5)).toBeCloseTo(10);
    expect(areaRadius(1, 10_000, 20, 2.5)).toBe(2.5);
  });
});

describe("fundingTimeline", () => {
  const rows = toCompetitorRows([comp("co_1"), comp("co_2", { layer: "design_intent" }), comp("co_3")], [], investors);
  const rounds = [
    round("r1", "co_1", { date: "2024-01", amount_usd: 4 }),
    round("r2", "co_1", { date: "2025", date_precision: "year", amount_usd: null }),
    round("r3", "co_2", { date: null, date_precision: null, amount_usd: 7 }),
    round("r4", "co_9", { date: "2025-01" }),
  ];
  const t = fundingTimeline(rows, rounds);

  it("draws a dot per dated round and counts undated ones", () => {
    expect(t.dots.map((d) => d.roundId)).toEqual(["r1", "r2"]);
    expect(t.undatedRounds).toBe(1);
    expect(t.dots.length + t.undatedRounds).toBe(3);
  });

  it("uses a row per competitor with a dated round, ordered by layer", () => {
    expect(t.lanes.map((l) => l.id)).toEqual(["co_1"]);
    expect(t.withoutDatedRound).toBe(2);
  });

  it("keeps unknown amounts null and never adds them as zero to the total", () => {
    expect(t.dots[1]!.amountUsd).toBeNull();
    expect(t.unknownAmount).toBe(1);
    expect(t.drawnAmountUsd).toBe(4);
    expect(t.undatedAmountUsd).toBe(7);
  });

  it("places a coarse date at the start of its period", () => {
    expect(t.dots[1]!.x).toBe(Date.UTC(2025, 0, 1));
  });
});

describe("overlapMatrix", () => {
  const rows = toCompetitorRows(
    [comp("co_1", { layer: "robotics" }), comp("co_2", { layer: "design_intent" }), comp("co_3")],
    [],
    investors,
  );
  const rounds = [
    round("r1", "co_1", { lead_investor_ids: ["inv_a"], participant_investor_ids: ["inv_b"] }),
    round("r2", "co_2", { lead_investor_ids: ["inv_a"], unspecified_investor_ids: ["inv_b"] }),
    round("r3", "co_2", { participant_investor_ids: ["inv_a"], date: "2026-01" }),
    round("r4", "co_3", { participant_investor_ids: ["inv_c"] }),
  ];
  const overlap = {
    version: "x",
    generated_at: "2026-10-01T00:00:00Z",
    competitor_ids: ["co_1", "co_2", "co_3"],
    rows: [
      { investor_id: "inv_c", competitor_ids: ["co_3"], round_ids: ["r4"], latest_date: null },
      { investor_id: "inv_b", competitor_ids: ["co_1", "co_2"], round_ids: ["r1", "r2"], latest_date: null },
      { investor_id: "inv_a", competitor_ids: ["co_1", "co_2"], round_ids: ["r1", "r2", "r3"], latest_date: null },
    ],
  } as unknown as CompetitorOverlapDocument;
  const thesis = [
    { id: "inv_a", x: 0, y: 0, cluster_id: 1, is_generalist: false },
    { id: "inv_b", x: 0, y: 0, cluster_id: 0, is_generalist: false },
  ] as ThesisPoint[];
  const m = overlapMatrix(overlap, rows, investors, thesis, rounds);

  it("keeps investors backing two or more competitors and counts the rest", () => {
    expect(m.rows.map((r) => r.investorId)).toEqual(["inv_b", "inv_a"]);
    expect(m.hiddenInvestors).toBe(1);
    expect(m.totalInvestors).toBe(3);
  });

  it("sorts by cluster, then overlap descending, with no cluster last", () => {
    const more = overlapMatrix(
      overlap,
      rows,
      investors,
      [{ id: "inv_a", x: 0, y: 0, cluster_id: 0, is_generalist: false }] as ThesisPoint[],
      rounds,
    );
    expect(more.rows.map((r) => r.investorId)).toEqual(["inv_a", "inv_b"]);
  });

  it("orders columns by layer", () => {
    expect(m.columns.map((c) => c.id)).toEqual(["co_2", "co_3", "co_1"]);
  });

  it("counts an investor's rounds per competitor in any role", () => {
    const a = m.rows.find((r) => r.investorId === "inv_a")!;
    expect(a.cells["co_2"]!.rounds).toBe(2);
    expect(a.cells["co_2"]!.latest).toBe("2026-01");
    const b = m.rows.find((r) => r.investorId === "inv_b")!;
    expect(b.cells["co_2"]!.rounds).toBe(1);
    expect(m.maxRounds).toBe(2);
    expect(m.cells).toBe(4);
  });

  it("keeps a single-round cell visibly filled", () => {
    expect(heatPosition(0, 3)).toBe(0);
    expect(heatPosition(1, 3)).toBeGreaterThan(0.2);
    expect(heatPosition(3, 3)).toBe(1);
    expect(heatPosition(1, 1)).toBeGreaterThan(0.2);
  });
});
