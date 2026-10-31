import { describe, expect, it } from "vitest";
import { generateChallenge, scenarioOutcome, scoreGuess } from "@/lib/finance";

// Founders 9,000,000 shares and a 1,000,000-share pool (10,000,000 fully diluted).
// Round 1: $10M pre, $2M in -> price $1.00, 2,000,000 new shares, 12,000,000 total (founders 75%).
// Round 2: $30M pre, $6M in -> price $2.50, 2,400,000 new shares, 14,400,000 total (62.5%).
// Round 3: $86.4M pre, $21.6M in -> price $6.00, 3,600,000 new shares, 18,000,000 total (50%).
const base = {
  founderShares: 9_000_000,
  poolShares: 1_000_000,
  rounds: [
    { preMoney: 10e6, investment: 2e6 },
    { preMoney: 30e6, investment: 6e6 },
    { preMoney: 86.4e6, investment: 21.6e6 },
  ],
  exitValues: [20e6, 60e6, 180e6],
};

describe("scenarioOutcome", () => {
  const out = scenarioOutcome(base);

  it("walks the cap table through three rounds (hand-checked)", () => {
    expect(out.founderOwnership).toEqual([0.9, 0.75, 0.625, 0.5]);
    expect(out.finalFounderOwnership).toBe(0.5);
    expect(out.totalRaised).toBe(29.6e6);
    expect(out.snapshots).toHaveLength(4);
  });

  it("pays founders nothing when the exit is below the latest preference", () => {
    // $20M is less than Round 3's $21.6M preference and converting would pay Round 3 less.
    expect(out.exits[0]?.founderPayout).toBe(0);
    expect(out.exits[0]?.investors.find((i) => i.name === "Round 3")?.total).toBeCloseTo(20e6, 6);
  });

  it("splits by shares when everyone converts (hand-checked)", () => {
    // 17,000,000 paid shares (the unissued pool is not paid): founders hold 9,000,000.
    const e = out.exits[2];
    expect(e?.founderPayout).toBeCloseTo((180e6 * 9) / 17, 4);
    expect(e?.investors.every((i) => i.converted)).toBe(true);
  });

  it("always pays out exactly the exit value", () => {
    for (const e of out.exits) {
      const total = e.founderPayout + e.investors.reduce((a, i) => a + i.total, 0);
      expect(total).toBeCloseTo(e.exitValue, 4);
    }
  });

  it("rejects a scenario with no rounds", () => {
    expect(() => scenarioOutcome({ ...base, rounds: [] })).toThrow(RangeError);
  });
});

describe("generateChallenge", () => {
  it("is deterministic for a seed", () => {
    expect(generateChallenge(12345)).toEqual(generateChallenge(12345));
  });

  it("uses all three question kinds over a run of seeds, with answers in (0, 1]", () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const c = generateChallenge(seed);
      kinds.add(c.kind);
      expect(c.answer).toBeGreaterThan(0);
      expect(c.answer).toBeLessThanOrEqual(1);
    }
    expect([...kinds].sort()).toEqual(["founder_after", "investor_post", "two_rounds"]);
  });

  it("answers match the closing arithmetic (hand-checked formulas)", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = generateChallenge(seed);
      if (c.kind === "investor_post") {
        expect(c.answer).toBeCloseTo(c.investment / (c.preMoney + c.investment), 12);
      } else if (c.kind === "founder_after") {
        expect(c.answer).toBeCloseTo(
          (c.founderBefore * c.preMoney) / (c.preMoney + c.investment),
          12,
        );
      } else {
        const [a, b] = c.rounds;
        expect(c.answer).toBeCloseTo(
          c.founderBefore *
            (a.preMoney / (a.preMoney + a.investment)) *
            (b.preMoney / (b.preMoney + b.investment)),
          12,
        );
        expect(b.preMoney).toBeGreaterThan(a.preMoney + a.investment);
      }
    }
  });
});

describe("scoreGuess", () => {
  it("scores within one percentage point, inclusive", () => {
    expect(scoreGuess(0.1, 0.11).correct).toBe(true);
    expect(scoreGuess(0.12, 0.11).correct).toBe(true);
    expect(scoreGuess(0.121, 0.11).correct).toBe(false);
    expect(scoreGuess(0.5, 0.5).errorPoints).toBe(0);
  });

  it("rejects a non-finite guess", () => {
    expect(() => scoreGuess(Number.NaN, 0.1)).toThrow(RangeError);
  });
});
