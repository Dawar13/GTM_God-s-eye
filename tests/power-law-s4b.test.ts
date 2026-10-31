import { describe, expect, it } from "vitest";
import { simulatePortfolio } from "@/lib/finance";
import { niceStep, powerLawSeries } from "@/lib/viz/transforms/calcPowerLaw";
import {
  handlePowerLawRequest,
  runPowerLaw,
  type PowerLawParams,
} from "@/lib/workers/powerLawProtocol";

const params: PowerLawParams = { n: 10, alpha: 1.6, xm: 1, lossRate: 0.5, trials: 2000, seed: 42 };

describe("power law simulation determinism", () => {
  it("gives the same series for the same seed, through the worker handler", () => {
    const a = runPowerLaw(params);
    expect(runPowerLaw(params)).toEqual(a);
    expect(handlePowerLawRequest({ id: 7, params })).toEqual({ id: 7, ok: true, series: a });
  });

  it("gives a different series for a different seed", () => {
    expect(runPowerLaw({ ...params, seed: 43 }).median).not.toBe(runPowerLaw(params).median);
  });

  it("matches the pure finance function", () => {
    const sim = simulatePortfolio({
      n: params.n,
      trials: params.trials,
      seed: params.seed,
      distribution: { kind: "pareto", alpha: 1.6, xm: 1, lossRate: 0.5 },
    });
    const s = runPowerLaw(params);
    expect(s.median).toBe(sim.median);
    expect(s.p90).toBe(sim.p90);
    expect(s.trials).toBe(2000);
  });

  it("reports an invalid input as a message instead of throwing", () => {
    const r = handlePowerLawRequest({ id: 1, params: { ...params, lossRate: 1.5 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/lossRate/);
  });
});

describe("powerLawSeries", () => {
  it("rounds a bin width up to 1, 2 or 5 times a power of ten", () => {
    expect(niceStep(14.75)).toBe(20);
    expect(niceStep(4.5)).toBe(5);
    expect(niceStep(0.03)).toBeCloseTo(0.05, 12);
    expect(niceStep(10)).toBe(10);
  });

  const stats = { mean: 0, median: 0, p10: 0, p90: 0, pAtLeast1x: 0, pAtLeast3x: 0 };

  it("bins from zero and counts every fund once (hand-checked)", () => {
    const fundMultiples = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100];
    const s = powerLawSeries({ ...stats, fundMultiples });
    // p99 = 10 + (100 - 10) * 0.89 = 90.1; width 90.1 / 24 = 3.75 -> 5; 24 bins end at 120.
    expect(s.binWidth).toBe(5);
    expect(s.domainMax).toBe(120);
    expect(s.bins[0]?.count).toBe(5); // 0..4
    expect(s.bins[1]?.count).toBe(5); // 5..9
    expect(s.bins[2]?.count).toBe(1); // 10
    expect(s.bins[20]?.count).toBe(1); // 100 in [100, 105)
    expect(s.aboveCount).toBe(0);
    expect(s.bins.reduce((a, b) => a + b.count, 0)).toBe(12);
  });

  it("leaves funds past the 99th percentile out of the bars and counts them", () => {
    const fundMultiples = [...Array.from({ length: 198 }, (_, i) => i), 10_000, 20_000];
    const s = powerLawSeries({ ...stats, fundMultiples }, 20);
    // p99 = 197 + (10000 - 197) * 0.01 = 295.03; 295.03 / 20 = 14.75 -> 20; 20 bins end at 400.
    expect(s.binWidth).toBe(20);
    expect(s.domainMax).toBe(400);
    expect(s.aboveCount).toBe(2);
    expect(s.max).toBe(20_000);
    expect(s.bins[0]?.count).toBe(20);
    expect(s.bins[9]?.count).toBe(18); // 180..197
    expect(s.bins.reduce((a, b) => a + b.count, 0) + s.aboveCount).toBe(200);
  });

  it("copes with a fund set that is all zero", () => {
    const s = powerLawSeries({ ...stats, fundMultiples: [0, 0, 0] }, 4);
    expect(s.bins[0]?.count).toBe(3);
    expect(s.aboveCount).toBe(0);
  });
});
