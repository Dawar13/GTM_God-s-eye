/** PHASE_1 §2.2 worked examples 1–8, encoded as given. */
import { describe, expect, it } from "vitest";
import {
  accrue,
  conversionPoint,
  convertNote,
  distribute,
  equityFinancing,
  exitNeededToReturnFund,
  exitOwnership,
  poolShuffle,
  pricedRound,
  proRata,
  vcMethod,
  type PreferredClass,
} from "@/lib/finance";

const FRAC = 6; // toBeCloseTo digits ≈ 1e-6 on fractions
const near = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

describe("1. priced round", () => {
  it("pre $8M, invest $2M, 8,000,000 pre shares", () => {
    const r = pricedRound({ preMoney: 8e6, investment: 2e6, preMoneyFDShares: 8e6 });
    near(r.postMoney, 10e6);
    near(r.pricePerShare, 1.0);
    near(r.newShares, 2e6);
    expect(r.ownership.newInvestors).toBeCloseTo(0.2, FRAC);
  });

  it("accepts post-money instead of pre-money", () => {
    const r = pricedRound({ postMoney: 10e6, investment: 2e6, preMoneyFDShares: 8e6 });
    near(r.preMoney, 8e6);
    near(r.pricePerShare, 1.0);
  });

  it("rejects both or neither valuation", () => {
    expect(() => pricedRound({ investment: 1, preMoneyFDShares: 1 })).toThrow();
    expect(() =>
      pricedRound({ preMoney: 1, postMoney: 2, investment: 1, preMoneyFDShares: 1 }),
    ).toThrow();
  });
});

describe("2. option pool shuffle", () => {
  it("10% post-money pool created pre-money, no existing pool", () => {
    const r = poolShuffle({
      headlinePreMoney: 8e6,
      investment: 2e6,
      existingShares: 8e6,
      existingPool: 0,
      targetPostPoolPct: 0.1,
    });
    near(r.poolIncrease, 1_142_857.14);
    near(r.pricePerShare, 0.875);
    near(r.newShares, 2_285_714.29);
    near(r.postFDShares, 11_428_571.43);
    expect(r.ownership.existing).toBeCloseTo(0.7, FRAC);
    expect(r.ownership.investors).toBeCloseTo(0.2, FRAC);
    expect(r.ownership.pool).toBeCloseTo(0.1, FRAC);
    near(r.effectivePreMoney, 7e6);
  });

  it("adds nothing when the existing pool already meets the target", () => {
    const r = poolShuffle({
      headlinePreMoney: 8e6,
      investment: 2e6,
      existingShares: 6e6,
      existingPool: 2e6,
      targetPostPoolPct: 0.1,
    });
    expect(r.poolIncrease).toBe(0);
  });
});

describe("3. post-money SAFE converting in a Series A", () => {
  const base = {
    holdings: { founders: 9_000_000 },
    preMoney: 20e6,
    investment: 5e6,
    investors: { "Series A": 5e6 },
  };

  it("converts at the cap", () => {
    const r = equityFinancing({
      ...base,
      postMoneySafes: [{ holder: "SAFE", amount: 1e6, postMoneyCap: 10e6, discount: null }],
    });
    const safe = r.conversions[0]!;
    near(safe.shares, 1_000_000);
    near(safe.price, 1.0);
    near(r.pricePerShare, 2.0);
    near(r.newShares, 2_500_000);
    near(r.totalFD, 12_500_000);
    expect(r.ownership.founders).toBeCloseTo(0.72, FRAC);
    expect(r.ownership.SAFE).toBeCloseTo(0.08, FRAC);
    expect(r.ownership["Series A"]).toBeCloseTo(0.2, FRAC);
  });

  it("with a 20% discount the cap still wins ($1.00 < $1.60)", () => {
    const r = equityFinancing({
      ...base,
      postMoneySafes: [{ holder: "SAFE", amount: 1e6, postMoneyCap: 10e6, discount: 0.2 }],
    });
    expect(r.conversions[0]!.method).toBe("cap");
    near(r.conversions[0]!.price, 1.0);
  });
});

describe("4. convertible note", () => {
  it("$500K at 8% simple for 18 months, $8M cap on 10M shares, 20% discount", () => {
    const accrued = accrue({ principal: 500_000, rate: 0.08, compounding: "simple", years: 1.5 });
    near(accrued, 560_000);
    expect(
      accrue({
        principal: 500_000,
        rate: 0.08,
        compounding: "simple",
        start: "2025-01-01",
        end: "2026-07-01",
      }),
    ).toBeCloseTo(560_000, 2);
    const c = convertNote({
      accrued,
      cap: 8e6,
      capBasis: "pre_money",
      discount: 0.2,
      roundPrice: 2.0,
      capitalization: 10e6,
    });
    near(c.capPrice!, 0.8);
    near(c.discountPrice, 1.6);
    expect(c.method).toBe("cap");
    near(c.shares, 700_000);
  });

  it("compounds annually and monthly", () => {
    const annual = accrue({ principal: 100, rate: 0.1, compounding: "annual", years: 2 });
    expect(annual).toBeCloseTo(121, 6);
    const monthly = accrue({ principal: 100, rate: 0.12, compounding: "monthly", years: 1 });
    expect(monthly).toBeCloseTo(100 * 1.01 ** 12, 6);
  });
});

describe("5. liquidation preference", () => {
  const investor = (over: Partial<PreferredClass> = {}): PreferredClass => ({
    name: "investor",
    invested: 5e6,
    shares: 25,
    multiple: 1,
    participation: "none",
    seniority: 1,
    ...over,
  });
  const pay = (exitValue: number, cls: PreferredClass) => {
    const r = distribute({ exitValue, commonShares: 75, classes: [cls] });
    return { investor: r.classes[0]!, common: r.common };
  };

  it("1x non-participating: preference at $10M, conversion at $40M", () => {
    const at10 = pay(10e6, investor());
    near(at10.investor.total, 5e6);
    near(at10.common, 5e6);
    expect(at10.investor.converted).toBe(false);
    const at40 = pay(40e6, investor());
    expect(at40.investor.converted).toBe(true);
    near(at40.investor.total, 10e6);
    near(at40.common, 30e6);
  });

  it("breakpoint at $20M", () => {
    const point = conversionPoint({ commonShares: 75, classes: [investor()] }, "investor", 100e6);
    near(point!, 20e6, 1);
  });

  it("participating uncapped at $40M → $13.75M", () => {
    near(pay(40e6, investor({ participation: "full" })).investor.total, 13.75e6);
  });

  it("participating capped at 3x: $13.75M at $40M, converts for $20M at $80M", () => {
    const capped = investor({ participation: "capped", capMultiple: 3 });
    near(pay(40e6, capped).investor.total, 13.75e6);
    const at80 = pay(80e6, capped);
    expect(at80.investor.converted).toBe(true);
    near(at80.investor.total, 20e6);
  });
});

describe("6. fund math", () => {
  it("10% entry, two 20% dilutions → 6.4%; exits to return $50M and $1B funds", () => {
    const own = exitOwnership(0.1, [0.2, 0.2]);
    expect(own).toBeCloseTo(0.064, FRAC);
    near(exitNeededToReturnFund(50e6, own), 781.25e6, 1);
    near(exitNeededToReturnFund(1e9, own), 15.625e9, 1);
  });
});

describe("7. VC method", () => {
  it("exit $200M, 20x, retention 0.5, invest $1M", () => {
    const r = vcMethod({ exitValue: 200e6, targetMultiple: 20, retention: 0.5, investment: 1e6 });
    expect(r.requiredOwnership).toBeCloseTo(0.2, FRAC);
    near(r.postMoney, 5e6);
    near(r.preMoney, 4e6);
  });
});

describe("8. pro rata", () => {
  it("10% owner, $5M round selling 20%", () => {
    const r = proRata({ ownership: 0.1, roundSize: 5e6, roundOwnershipSold: 0.2 });
    near(r.amount, 500_000);
    expect(r.ownershipWithout).toBeCloseTo(0.08, FRAC);
    expect(r.ownershipWith).toBeCloseTo(0.1, FRAC);
  });
});
