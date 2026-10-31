import { describe, expect, it } from "vitest";
import {
  fundScenario,
  liquidationBreakpoints,
  noteScenario,
  type PreferredClass,
} from "@/lib/finance";

describe("noteScenario", () => {
  // $100K at 8% simple for 1 year = $108,000. $5M pre-money on 5,000,000 shares = $1.00.
  const base = {
    principal: 100_000,
    rate: 0.08,
    compounding: "simple" as const,
    years: 1,
    capBasis: "pre_money" as const,
    roundPreMoney: 5e6,
    roundInvestment: 1e6,
    capitalization: 5e6,
  };

  it("converts at the cap price when it is lower than the discounted price", () => {
    // Cap $4M / 5M shares = $0.80; 10% discount = $0.90 → cap wins; 108,000 / 0.8 = 135,000.
    const s = noteScenario({ ...base, cap: 4e6, discount: 0.1 });
    expect(s.accrued).toBeCloseTo(108_000, 6);
    expect(s.interest).toBeCloseTo(8_000, 6);
    expect(s.conversion.method).toBe("cap");
    expect(s.conversion.shares).toBeCloseTo(135_000, 6);
    expect(s.newInvestorShares).toBeCloseTo(1_000_000, 6);
    expect(s.totalShares).toBeCloseTo(6_135_000, 6);
    expect(s.ownership.note).toBeCloseTo(135_000 / 6_135_000, 12);
    const o = s.ownership;
    expect(o.existing + o.note + o.newInvestors).toBeCloseTo(1, 12);
  });

  it("converts at the discounted price when the cap is high", () => {
    // Cap $10M / 5M = $2.00; 20% discount = $0.80 → discount wins.
    const s = noteScenario({ ...base, cap: 1e7, discount: 0.2 });
    expect(s.conversion.method).toBe("discount");
    expect(s.conversion.conversionPrice).toBeCloseTo(0.8, 12);
    expect(s.conversion.shares).toBeCloseTo(135_000, 6);
  });

  it("converts at the round price with no cap and no discount", () => {
    const s = noteScenario({ ...base, cap: null, discount: null });
    expect(s.conversion.method).toBe("round_price");
    expect(s.conversion.shares).toBeCloseTo(108_000, 6);
  });

  it("rejects a round with no pre-money", () => {
    expect(() => noteScenario({ ...base, cap: null, discount: null, roundPreMoney: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("liquidationBreakpoints", () => {
  const A: PreferredClass = {
    name: "Series A",
    invested: 4e6,
    shares: 2e6,
    multiple: 1,
    participation: "none",
    seniority: 1,
  };
  const B: PreferredClass = { ...A, name: "Series B", invested: 12e6, seniority: 2 };

  it("finds preference and conversion points for two non-participating classes", () => {
    // B (senior) is covered at $12M, A at $16M. A converts when (X-12M)/8M shares = $2 → $28M.
    // B converts when X/10M = $6 → $60M.
    const bp = liquidationBreakpoints({ commonShares: 6e6, classes: [A, B] }, 100e6);
    const find = (name: string, kind: string) =>
      bp.find((b) => b.className === name && b.kind === kind)?.exit;
    expect(find("Series B", "preference_covered")).toBeCloseTo(12e6, 0);
    expect(find("Series A", "preference_covered")).toBeCloseTo(16e6, 0);
    expect(find("Series A", "converts")).toBeCloseTo(28e6, 0);
    expect(find("Series B", "converts")).toBeCloseTo(60e6, 0);
    expect(bp.map((b) => b.exit)).toEqual([...bp.map((b) => b.exit)].sort((a, b) => a - b));
  });

  it("finds the cap and conversion points of a capped participating class", () => {
    // $4M 1x, 3x cap ($12M), 2M of 10M shares: 4M + 0.2(X-4M) = 12M → $44M; converts at 0.2X = 12M → $60M.
    const capped: PreferredClass = {
      ...A,
      participation: "capped",
      capMultiple: 3,
    };
    const bp = liquidationBreakpoints({ commonShares: 8e6, classes: [capped] }, 100e6);
    expect(bp.map((b) => b.kind)).toEqual(["preference_covered", "cap_reached", "converts"]);
    expect(bp[0]?.exit).toBeCloseTo(4e6, 0);
    expect(bp[1]?.exit).toBeCloseTo(44e6, 0);
    expect(bp[2]?.exit).toBeCloseTo(60e6, 0);
  });

  it("gives no conversion point when the class never converts below the maximum exit", () => {
    const bp = liquidationBreakpoints({ commonShares: 6e6, classes: [A, B] }, 20e6);
    expect(bp.some((b) => b.kind === "converts")).toBe(false);
  });
});

describe("fundScenario", () => {
  const base = {
    entryOwnership: 0.1,
    laterRounds: 2,
    dilutionPerRound: 0.2,
    multiple: 1,
    assumedExit: 500e6,
  };

  it("a $50M fund at 10% entry diluted by two 20% rounds needs a $781.25M exit", () => {
    const s = fundScenario({ ...base, fundSize: 50e6 });
    expect(s.ownershipAtExit).toBeCloseTo(0.064, 12);
    expect(s.exitNeeded).toBeCloseTo(781_250_000, 4);
    expect(s.returnAtAssumedExit).toBeCloseTo(0.64, 12);
  });

  it("a $1B fund needs twenty times the exit at the same ownership", () => {
    expect(fundScenario({ ...base, fundSize: 1e9 }).exitNeeded).toBeCloseTo(15_625_000_000, 2);
  });

  it("rejects a fractional number of rounds", () => {
    expect(() => fundScenario({ ...base, fundSize: 50e6, laterRounds: 1.5 })).toThrow(RangeError);
  });
});
