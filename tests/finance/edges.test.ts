/** Seniority, conversion edge cases and input checks. */
import { describe, expect, it } from "vitest";
import {
  CAP_TABLE_ROUNDING,
  convertNote,
  convertPreMoneySafes,
  distribute,
  ownershipOf,
  payoutCurve,
  roundShares,
  simulate,
  vcMethod,
  yearFraction30360,
  type PreferredClass,
} from "@/lib/finance";

const seriesA: PreferredClass = {
  name: "A",
  invested: 5e6,
  shares: 10,
  multiple: 1,
  participation: "none",
  seniority: 1,
};
const seriesB: PreferredClass = {
  name: "B",
  invested: 10e6,
  shares: 20,
  multiple: 1,
  participation: "none",
  seniority: 2,
};

describe("liquidation waterfall: seniority vs pari passu", () => {
  it("senior stack pays B in full before A", () => {
    const r = distribute({ exitValue: 12e6, commonShares: 70, classes: [seriesA, seriesB] });
    expect(r.classes.find((c) => c.name === "B")!.total).toBeCloseTo(10e6, 2);
    expect(r.classes.find((c) => c.name === "A")!.total).toBeCloseTo(2e6, 2);
    expect(r.common).toBeCloseTo(0, 2);
  });

  it("pari passu splits a shortfall in proportion to preferences", () => {
    const r = distribute({
      exitValue: 12e6,
      commonShares: 70,
      classes: [seriesA, { ...seriesB, seniority: 1 }],
    });
    expect(r.classes.find((c) => c.name === "B")!.total).toBeCloseTo(8e6, 2);
    expect(r.classes.find((c) => c.name === "A")!.total).toBeCloseTo(4e6, 2);
  });

  it("2x preference doubles what is owed first", () => {
    const r = distribute({
      exitValue: 30e6,
      commonShares: 90,
      classes: [{ ...seriesA, multiple: 2 }],
    });
    expect(r.classes[0]!.preference).toBeCloseTo(10e6, 2);
  });

  it("payout curve: every exit is fully distributed and payouts never fall as exits rise", () => {
    const exits = [0, 5e6, 10e6, 20e6, 50e6, 100e6, 500e6];
    const curve = payoutCurve({ commonShares: 70, classes: [seriesA, seriesB] }, exits);
    let prevCommon = -1;
    for (const point of curve) {
      const total = point.common + point.classes.reduce((a, c) => a + c.total, 0);
      expect(total).toBeCloseTo(point.exitValue, 2);
      expect(point.common).toBeGreaterThanOrEqual(prevCommon - 1e-6);
      prevCommon = point.common;
    }
  });

  it("rejects bad inputs", () => {
    expect(() => distribute({ exitValue: -1, commonShares: 1, classes: [] })).toThrow();
    expect(() =>
      distribute({
        exitValue: 1,
        commonShares: 1,
        classes: [{ ...seriesA, participation: "capped" }],
      }),
    ).toThrow();
  });
});

describe("notes", () => {
  it("post-money cap basis: the note owns accrued / cap after conversion", () => {
    const c = convertNote({
      accrued: 5e5,
      cap: 5e6,
      capBasis: "post_money",
      discount: null,
      roundPrice: 2,
      capitalization: 9e6,
    });
    expect(c.shares).toBeCloseTo(1e6, 4);
    expect(c.conversionPrice).toBeCloseTo(0.5, 9);
  });

  it("no cap: discount, or the round price when there is no discount", () => {
    const base = {
      accrued: 1e5,
      cap: null,
      capBasis: "pre_money" as const,
      roundPrice: 1,
      capitalization: 1e6,
    };
    expect(convertNote({ ...base, discount: 0.2 }).method).toBe("discount");
    expect(convertNote({ ...base, discount: null }).method).toBe("round_price");
  });

  it("rejects a cap at or below the accrued value on a post-money basis", () => {
    expect(() =>
      convertNote({
        accrued: 5e6,
        cap: 5e6,
        capBasis: "post_money",
        discount: null,
        roundPrice: 1,
        capitalization: 1e6,
      }),
    ).toThrow();
  });

  it("30/360 year fractions", () => {
    expect(yearFraction30360("2025-01-31", "2025-07-31")).toBeCloseTo(0.5, 9);
    expect(() => yearFraction30360("2026-01-01", "2025-01-01")).toThrow();
  });
});

describe("pre-money SAFEs on their own", () => {
  it("YC Example 2, Investor A: $3.8M pre-money cap over 11.7M shares", () => {
    const [a] = convertPreMoneySafes({
      preFinancingFD: 10_000_000,
      poolIncrease: 1_700_000,
      safes: [{ holder: "A", amount: 200_000, preMoneyCap: 3_800_000, discount: null }],
      roundPricePerShare: 1.1115,
      rounding: CAP_TABLE_ROUNDING,
    });
    expect(a!.price).toBe(0.3248);
    expect(a!.shares).toBe(615_763);
  });
});

describe("input checks and rounding", () => {
  it("VC method rejects impossible inputs", () => {
    expect(() =>
      vcMethod({ exitValue: 1e6, targetMultiple: 10, retention: 0, investment: 1 }),
    ).toThrow();
    expect(() =>
      vcMethod({ exitValue: 1e6, targetMultiple: 10, retention: 1, investment: 5e5 }),
    ).toThrow();
  });

  it("share rounding modes", () => {
    expect(roundShares(10.6, { shares: "round" })).toBe(11);
    expect(roundShares(10.6, { shares: "floor" })).toBe(10);
    expect(roundShares(9.9999999999, { shares: "floor" })).toBe(10);
    expect(roundShares(10.6)).toBe(10.6);
    expect(() => ownershipOf({ a: 0 })).toThrow();
  });

  it("pool top-up by shares and by target outside a round", () => {
    const [byShares, byTarget] = simulate({
      holdings: { founders: 9e6, pool: 0 },
      steps: [
        { kind: "pool_top_up", shares: 5e5 },
        { kind: "pool_top_up", targetPct: 0.1 },
      ],
    });
    expect(byShares!.holdings.pool).toBe(5e5);
    expect(byTarget!.ownership.pool).toBeCloseTo(0.1, 9);
    expect(() =>
      simulate({ holdings: { founders: 1 }, steps: [{ kind: "pool_top_up", targetPct: 1 }] }),
    ).toThrow();
  });
});
