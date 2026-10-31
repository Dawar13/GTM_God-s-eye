import { describe, expect, it } from "vitest";
import { CAP_TABLE_ROUNDING, poolShuffle, pricedRound } from "@/lib/finance";
import { optionPoolBars, poolOwnership, roundOwnership } from "@/lib/viz/transforms/calcOwnership";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("roundOwnership", () => {
  it("splits the post-round shares between existing holders and new investors", () => {
    // Pre $9M, invest $1M, 10M shares: price $0.90, 1,111,111 new shares (floored).
    const r = pricedRound({
      preMoney: 9e6,
      investment: 1e6,
      preMoneyFDShares: 10e6,
      rounding: CAP_TABLE_ROUNDING,
    });
    const o = roundOwnership(r);
    expect(o.totalShares).toBe(11_111_111);
    expect(o.segments.map((s) => s.key)).toEqual(["existing", "new"]);
    expect(o.segments[1]?.shares).toBe(1_111_111);
    expect(sum(o.segments.map((s) => s.fraction))).toBeCloseTo(1, 12);
    expect(o.segments[1]?.fraction).toBeCloseTo(1_111_111 / 11_111_111, 12);
  });
});

describe("poolOwnership and optionPoolBars", () => {
  const input = {
    headlinePreMoney: 9e6,
    investment: 1e6,
    existingShares: 9e6,
    existingPool: 1e6,
    targetPostPoolPct: 0.1,
    rounding: CAP_TABLE_ROUNDING,
  };
  const r = poolShuffle(input);

  it("has three segments summing to 100% with the pool near its target", () => {
    const o = poolOwnership(r);
    expect(sum(o.segments.map((s) => s.fraction))).toBeCloseTo(1, 12);
    expect(o.segments.find((s) => s.key === "pool")?.fraction).toBeCloseTo(0.1, 3);
  });

  it("bars start at zero-based values and the gap is headline minus effective", () => {
    const b = optionPoolBars(r, input.headlinePreMoney);
    expect(b.bars.map((x) => x.key)).toEqual(["headline", "effective"]);
    expect(b.bars[0]?.value).toBe(9e6);
    expect(b.bars[1]?.value).toBeCloseTo(9e6 - b.gap, 6);
    expect(b.gap).toBeCloseTo(111_112.5, 6); // 125,000 new options x $0.8889 (price rounded to 4 dp)
    expect(b.gapShare).toBeCloseTo(b.gap / 9e6, 12);
    expect(Math.min(...b.bars.map((x) => x.value))).toBeGreaterThanOrEqual(0);
  });
});

import { decodeSteps, encodeSteps, toCapTableSteps } from "@/lib/calculators/capTableSteps";
import { initialSnapshot, POOL, safeScenario, simulate } from "@/lib/finance";
import { capTableSeries } from "@/lib/viz/transforms/calcCapTable";
import { dilutionWaterfall } from "@/lib/viz/transforms/calcSafe";

describe("capTableSeries", () => {
  // Founders 9M + pool 1M; $1M post-money SAFE at $10M; round $20M pre, $5M in.
  const drafts = decodeSteps("ps_1000000_10000000_0~r_20000000_5000000_0") ?? [];
  const steps = toCapTableSteps(drafts);
  const holdings = { founders: 9e6, [POOL]: 1e6 };
  const snaps = [
    initialSnapshot(holdings),
    ...simulate({ holdings, steps, rounding: { shares: "exact" } }),
  ];
  const s = capTableSeries(steps, snaps);

  it("has a start point, one per step, and fractions summing to 1", () => {
    expect(s.points.map((p) => p.label)).toEqual(["Start", "SAFE 1", "Round 1"]);
    for (const p of s.points)
      expect(Object.values(p.fractions).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("keeps the SAFE pending until the round converts it", () => {
    expect(s.points[1]?.pendingUsd).toBe(1e6);
    expect(s.points[1]?.founders).toBeCloseTo(0.9, 12);
    expect(s.points[2]?.pendingUsd).toBe(0);
  });

  it("matches the hand-checked SAFE example: founders 64.8% after the round", () => {
    expect(s.points[2]?.founders).toBeCloseTo(0.648, 6);
    expect(s.points[2]?.fractions["convertibles"]).toBeCloseTo(0.08, 6);
    expect(s.classes.map((c) => c.label)).toEqual([
      "Founders",
      "Option pool",
      "SAFE and note holders",
      "Round 1 investors",
    ]);
  });
});

describe("steps codec", () => {
  it("round-trips every step kind and rejects junk", () => {
    const text =
      "ps_1000000_10000000_0~rs_500000__0.2~n_250000_0.06_18_8000000_0.2~t_0.1~r_2e7_5000000_0.1";
    const d = decodeSteps(text);
    expect(d).toHaveLength(5);
    expect(decodeSteps(encodeSteps(d ?? []))).toEqual(d);
    expect(decodeSteps("")).toEqual([]);
    expect(decodeSteps("x_1")).toBeNull();
    expect(decodeSteps("ps_abc_1_0")).toBeNull();
    expect(decodeSteps("ps_1_1_0~".repeat(13).slice(0, -1))).toBeNull();
  });
});

describe("dilutionWaterfall", () => {
  const d = safeScenario({
    kind: "post_money",
    founderShares: 9e6,
    existingPool: 1e6,
    safeAmount: 1e6,
    cap: 10e6,
    discount: null,
    roundPreMoney: 20e6,
    roundInvestment: 5e6,
    poolTargetPostPct: null,
    rounding: { shares: "exact" },
  }).dilution;
  const bars = dilutionWaterfall(d);

  it("totals start at zero, drops float and add up", () => {
    expect(bars.map((b) => b.key)).toEqual(["start", "safe", "pool", "new", "end"]);
    expect(bars[0]?.base).toBe(0);
    expect(bars[4]?.base).toBe(0);
    expect(bars[1]?.value).toBeCloseTo(0.09, 9); // 90.0% -> 81.0%
    expect(bars[2]?.value).toBeCloseTo(0, 9);
    expect(bars[3]?.value).toBeCloseTo(0.162, 9); // 81.0% -> 64.8%
    const drops = bars.slice(1, 4).reduce((a, b) => a + b.value, 0);
    expect((bars[0]?.value ?? 0) - drops).toBeCloseTo(bars[4]?.value ?? 0, 12);
    expect(bars.every((b) => b.value >= 0 && b.base >= 0)).toBe(true);
  });
});
