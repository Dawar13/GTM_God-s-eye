import { describe, expect, it } from "vitest";
import { DEFAULT_FIT_WEIGHTS, fitScore, rankByFit } from "@/lib/fit/score";
import type { FitFeatures } from "@/lib/schema";

const f = (value: number) => ({ value, method: "test", inputs: [] });

function fit(
  over: Partial<FitFeatures["features"]> = {},
  flags: FitFeatures["flags"] = [],
): FitFeatures {
  return {
    id: "fit_x",
    investor_id: "inv_x",
    features: {
      thesis: f(1),
      stage: f(1),
      check: f(1),
      adjacency: f(1),
      geography: f(1),
      dry_powder: f(1),
      ...over,
    },
    flags,
    raise_size_usd: 1_000_000,
  };
}

describe("fitScore", () => {
  it("scores 100 when every feature is 1, and 0 when every feature is 0", () => {
    expect(fitScore(fit()).total).toBeCloseTo(100, 9);
    const zero = fit({
      thesis: f(0),
      stage: f(0),
      check: f(0),
      adjacency: f(0),
      geography: f(0),
      dry_powder: f(0),
    });
    expect(fitScore(zero).total).toBeCloseTo(0, 9);
  });

  it("normalises weights: scaling all weights changes nothing", () => {
    const a = fitScore(fit({ thesis: f(0.4) }));
    const doubled = Object.fromEntries(
      Object.entries(DEFAULT_FIT_WEIGHTS).map(([k, v]) => [k, v * 2]),
    ) as typeof DEFAULT_FIT_WEIGHTS;
    expect(fitScore(fit({ thesis: f(0.4) }), doubled).total).toBeCloseTo(a.total, 9);
  });

  it("is monotonic in each feature", () => {
    for (const name of Object.keys(DEFAULT_FIT_WEIGHTS) as (keyof typeof DEFAULT_FIT_WEIGHTS)[]) {
      const lo = fitScore(fit({ [name]: f(0.2) })).total;
      const hi = fitScore(fit({ [name]: f(0.8) })).total;
      expect(hi).toBeGreaterThan(lo);
    }
  });

  it("re-normalises over known features and reports coverage", () => {
    const s = fitScore(fit({ check: null, dry_powder: null }));
    expect(s.total).toBeCloseTo(100, 9);
    expect(s.coverage).toBeCloseTo(0.75, 9);
    expect(s.contributions.check).toBeNull();
  });

  it("passes flags through and rejects bad weights", () => {
    expect(fitScore(fit({}, ["conflict"])).flags).toEqual(["conflict"]);
    expect(() => fitScore(fit(), { ...DEFAULT_FIT_WEIGHTS, thesis: -1 })).toThrow();
    const none = Object.fromEntries(
      Object.keys(DEFAULT_FIT_WEIGHTS).map((k) => [k, 0]),
    ) as typeof DEFAULT_FIT_WEIGHTS;
    expect(() => fitScore(fit(), none)).toThrow();
  });

  it("ranks by total, then coverage", () => {
    const ranked = rankByFit([
      { ...fit({ thesis: f(0.2) }), investor_id: "inv_b" },
      { ...fit(), investor_id: "inv_a" },
      { ...fit({ check: null }), investor_id: "inv_c" },
    ]);
    expect(ranked.map((r) => r.investorId)).toEqual(["inv_a", "inv_c", "inv_b"]);
  });
});
