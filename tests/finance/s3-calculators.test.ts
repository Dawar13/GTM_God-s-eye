/** Worked examples behind the S3 calculators, checked by hand. */
import { describe, expect, it } from "vitest";
import {
  CAP_TABLE_ROUNDING,
  compareSafes,
  poolShuffle,
  pricedRound,
  safeScenario,
} from "@/lib/finance";

const base = {
  founderShares: 9_000_000,
  existingPool: 1_000_000,
  safeAmount: 1_000_000,
  cap: 10_000_000,
  discount: null,
  roundPreMoney: 20_000_000,
  roundInvestment: 5_000_000,
  poolTargetPostPct: null,
};
const EXACT = { shares: "exact" } as const;

describe("safeScenario", () => {
  it("post-money cap: $1M at a $10M cap owns 1/10 of the capitalization", () => {
    // Company capitalization 10M / 0.9 = 11,111,111.11 -> SAFE shares 1,111,111.11,
    // SAFE price $0.90 (below the $1.80 round price). New shares 5M / 1.8 = 2,777,777.78.
    const s = safeScenario({ ...base, kind: "post_money", rounding: EXACT });
    expect(s.conversion.method).toBe("cap");
    expect(s.conversion.price).toBeCloseTo(0.9, 6);
    expect(s.conversion.shares).toBeCloseTo(1_111_111.11, 1);
    expect(s.financing.pricePerShare).toBeCloseTo(1.8, 6);
    expect(s.financing.totalFD).toBeCloseTo(13_888_888.89, 1);
    expect(s.ownership.founders).toBeCloseTo(0.648, 6); // 9M / 13,888,888.89
    expect(s.ownership.safe).toBeCloseTo(0.08, 6); // 1,111,111.11 / 13,888,888.89
    expect(s.dilution.start).toBeCloseTo(0.9, 9);
    expect(s.dilution.afterSafe).toBeCloseTo(0.81, 9); // 9M / 11,111,111.11
    expect(s.dilution.afterPool).toBeCloseTo(0.81, 9); // no pool top-up
    expect(s.dilution.afterNewMoney).toBeCloseTo(0.648, 9);
  });

  it("pre-money cap: the same $10M cap converts at $1.00 and founders keep more", () => {
    // Cap price 10M / 10M = $1.00 -> 1,000,000 SAFE shares; price 20M / 11M = $1.8181...
    // New shares 5M / 1.8181... = 2,750,000; total 13,750,000.
    const s = safeScenario({ ...base, kind: "pre_money", rounding: EXACT });
    expect(s.conversion.price).toBeCloseTo(1, 9);
    expect(s.conversion.shares).toBeCloseTo(1_000_000, 4);
    expect(s.financing.totalFD).toBeCloseTo(13_750_000, 3);
    expect(s.ownership.founders).toBeCloseTo(9 / 13.75, 9); // 65.45%
    expect(s.ownership.safe).toBeCloseTo(1 / 13.75, 9); // 7.27%
  });

  it("compareSafes reports post minus pre", () => {
    const c = compareSafes({ ...base, rounding: EXACT });
    expect(c.difference.founders).toBeCloseTo(0.648 - 9 / 13.75, 9);
    expect(c.difference.safe).toBeCloseTo(0.08 - 1 / 13.75, 9);
    expect(c.difference.safe).toBeGreaterThan(0);
  });

  it("a discount wins when it beats the cap", () => {
    // Cap price $0.90; a 60% discount on $1.80 gives $0.72.
    const s = safeScenario({ ...base, kind: "post_money", discount: 0.6 });
    expect(s.conversion.method).toBe("discount");
    expect(s.conversion.price).toBeCloseTo(0.72, 1);
  });

  it("no cap and no discount converts at the round price", () => {
    const s = safeScenario({ ...base, kind: "post_money", cap: null });
    expect(s.conversion.method).toBe("round_price");
  });

  it("pool top-up dilutes founders after the SAFE and before new money", () => {
    const s = safeScenario({ ...base, kind: "post_money", poolTargetPostPct: 0.1 });
    expect(s.financing.poolIncrease).toBeGreaterThan(0);
    expect(s.dilution.afterPool).toBeLessThan(s.dilution.afterSafe);
    expect(s.dilution.afterNewMoney).toBeLessThan(s.dilution.afterPool);
    expect(s.ownership.pool).toBeCloseTo(0.1, 2);
  });

  it("rejects invalid input", () => {
    expect(() => safeScenario({ ...base, kind: "post_money", safeAmount: 0 })).toThrow(RangeError);
    expect(() => safeScenario({ ...base, kind: "post_money", cap: 1_000_000 })).toThrow(RangeError);
  });
});

describe("option pool gap and price guard", () => {
  it("gap = headline pre-money less effective pre-money", () => {
    // Headline $9M, $1M in, 9M founder shares + 1M pool, target 10% post pool.
    const r = poolShuffle({
      headlinePreMoney: 9e6,
      investment: 1e6,
      existingShares: 9e6,
      existingPool: 1e6,
      targetPostPoolPct: 0.1,
    });
    expect(r.gap).toBeCloseTo(9e6 - r.effectivePreMoney, 6);
    // k = 10/9; t*k = 1/9; inc = (1/9 * 10M - 1M) / (8/9) = 125,000; price 9M / 10.125M.
    expect(r.poolIncrease).toBeCloseTo(125_000, 6);
    expect(r.gap).toBeCloseTo(125_000 * (9e6 / 10_125_000), 4);
  });

  it("a price that rounds to zero is rejected", () => {
    expect(() =>
      pricedRound({
        preMoney: 1,
        investment: 1,
        preMoneyFDShares: 1e9,
        rounding: CAP_TABLE_ROUNDING,
      }),
    ).toThrow(RangeError);
  });
});
