/** Shared invariants (PHASE_1 §2.1), checked over seeded random cap tables. */
import { describe, expect, it } from "vitest";
import {
  croreToRupees,
  equityFinancing,
  inrToUsd,
  INDIA_TOPICS,
  mulberry32,
  notesForTopic,
  pricedRound,
  resolveMfn,
  rupeesToCrore,
  simulate,
  simulatePortfolio,
  type CapTableStep,
} from "@/lib/finance";

const SEED = 20261030;
const CASES = 200;

function randomSteps(rand: () => number): CapTableStep[] {
  const steps: CapTableStep[] = [];
  let valuation = 2e6 + rand() * 8e6;
  for (let round = 0; round < 3; round++) {
    if (rand() < 0.6) {
      steps.push({
        kind: "post_money_safe",
        holder: `safe ${round}`,
        amount: 2e5 + rand() * 1e6,
        postMoneyCap: valuation * (0.8 + rand()),
        discount: rand() < 0.5 ? 0.2 : null,
      });
    }
    if (rand() < 0.3) {
      steps.push({
        kind: "pre_money_safe",
        holder: `pre-safe ${round}`,
        amount: 1e5 + rand() * 5e5,
        preMoneyCap: valuation * (0.5 + rand()),
        discount: null,
      });
    }
    if (rand() < 0.3) {
      steps.push({
        kind: "note",
        holder: `note ${round}`,
        principal: 1e5 + rand() * 5e5,
        rate: 0.06,
        compounding: "simple",
        yearsToConversion: 1 + rand(),
        cap: valuation,
        discount: 0.2,
      });
    }
    if (rand() < 0.3) steps.push({ kind: "pool_top_up", targetPct: 0.05 + rand() * 0.1 });
    valuation *= 2 + rand() * 2;
    steps.push({
      kind: "priced_round",
      label: `round ${round}`,
      preMoney: valuation,
      investment: valuation * (0.15 + rand() * 0.2),
      investors: { [`lead ${round}`]: 1e5 },
      pool: rand() < 0.5 ? { targetPostPct: 0.1 } : undefined,
    });
  }
  return steps;
}

describe("cap-table invariants", () => {
  it("ownership sums to 1, shares are never negative, founders never rise", () => {
    const rand = mulberry32(SEED);
    for (let i = 0; i < CASES; i++) {
      const snaps = simulate({
        holdings: { founders: 8e6, pool: rand() * 1e6 },
        steps: randomSteps(rand),
      });
      let lastFounders = 1;
      for (const s of snaps) {
        const sum = Object.values(s.ownership).reduce((a, b) => a + b, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
        for (const shares of Object.values(s.holdings)) expect(shares).toBeGreaterThanOrEqual(0);
        const founders = s.ownership.founders!;
        expect(founders).toBeLessThanOrEqual(lastFounders + 1e-12);
        lastFounders = founders;
        if (s.financing) {
          // post = pre + new money
          expect(s.financing.postMoney).toBeCloseTo(
            s.financing.pricePerShare * (s.financing.postConversionFD + s.financing.poolIncrease) +
              s.financing.newShares * s.financing.pricePerShare,
            -1,
          );
        }
      }
    }
  });

  it("priced rounds: post = pre + investment and the new investors own investment / post", () => {
    const rand = mulberry32(SEED + 1);
    for (let i = 0; i < CASES; i++) {
      const pre = 1e6 + rand() * 1e8;
      const inv = 1e5 + rand() * 2e7;
      const r = pricedRound({
        preMoney: pre,
        investment: inv,
        preMoneyFDShares: 1e6 + rand() * 1e7,
      });
      expect(r.postMoney).toBeCloseTo(pre + inv, 4);
      expect(r.ownership.newInvestors).toBeCloseTo(inv / (pre + inv), 9);
      expect(r.ownership.existing + r.ownership.newInvestors).toBeCloseTo(1, 12);
    }
  });
});

describe("SAFE edge cases", () => {
  it("MFN SAFE takes the best later cap and discount", () => {
    const [mfn] = resolveMfn([
      { holder: "mfn", amount: 1, postMoneyCap: null, discount: null, mfn: true },
      { holder: "a", amount: 1, postMoneyCap: 12e6, discount: 0.1 },
      { holder: "b", amount: 1, postMoneyCap: 9e6, discount: 0.2 },
    ]);
    expect(mfn!.postMoneyCap).toBe(9e6);
    expect(mfn!.discount).toBe(0.2);
  });

  it("an uncapped, undiscounted SAFE converts at the round price", () => {
    const r = equityFinancing({
      holdings: { founders: 1e7 },
      postMoneySafes: [{ holder: "s", amount: 1e6, postMoneyCap: null, discount: null }],
      preMoney: 2e7,
      investment: 5e6,
    });
    expect(r.conversions[0]!.method).toBe("round_price");
    expect(r.conversions[0]!.price).toBeCloseTo(r.pricePerShare, 9);
  });

  it("rejects SAFEs that would sell 100% or more", () => {
    expect(() =>
      equityFinancing({
        holdings: { founders: 1e6 },
        postMoneySafes: [{ holder: "s", amount: 2e6, postMoneyCap: 2e6, discount: null }],
        preMoney: 1e7,
        investment: 1e6,
      }),
    ).toThrow();
  });

  it("a pool target is met after the round", () => {
    const r = equityFinancing({
      holdings: { founders: 9e6, pool: 2e5 },
      postMoneySafes: [{ holder: "s", amount: 5e5, postMoneyCap: 5e6, discount: null }],
      preMoney: 12e6,
      investment: 3e6,
      pool: { targetPostPct: 0.1 },
    });
    expect(r.holdings.pool! / r.totalFD).toBeCloseTo(0.1, 9);
  });
});

describe("power law simulation", () => {
  const args = {
    n: 25,
    distribution: {
      kind: "buckets" as const,
      buckets: [
        { p: 0.6, multiple: 0 },
        { p: 0.25, multiple: 1 },
        { p: 0.1, multiple: 5 },
        { p: 0.05, multiple: 30 },
      ],
    },
    trials: 2000,
    seed: 42,
  };

  it("is reproducible for a seed", () => {
    expect(simulatePortfolio(args).fundMultiples).toEqual(simulatePortfolio(args).fundMultiples);
  });

  it("averages to the expected multiple", () => {
    // E = 0.25·1 + 0.1·5 + 0.05·30 = 2.25
    expect(simulatePortfolio(args).mean).toBeCloseTo(2.25, 1);
  });

  it("summarises the distribution", () => {
    const r = simulatePortfolio({ ...args, bins: 10 });
    expect(r.histogram).toHaveLength(10);
    expect(r.histogram.reduce((a, b) => a + b.count, 0)).toBe(args.trials);
    expect(r.p10).toBeLessThanOrEqual(r.median);
    expect(r.median).toBeLessThanOrEqual(r.p90);
    expect(r.pAtLeast1x).toBeGreaterThanOrEqual(r.pAtLeast3x);
  });

  it("supports a Pareto tail", () => {
    const r = simulatePortfolio({
      n: 30,
      distribution: { kind: "pareto", alpha: 1.5, xm: 1, lossRate: 0.5 },
      trials: 500,
      seed: 7,
    });
    expect(r.mean).toBeGreaterThan(0);
  });

  it("rejects buckets that don't sum to 1", () => {
    expect(() =>
      simulatePortfolio({
        ...args,
        distribution: { kind: "buckets", buckets: [{ p: 0.5, multiple: 1 }] },
      }),
    ).toThrow();
  });
});

describe("india helpers", () => {
  it("converts crore and USD", () => {
    expect(croreToRupees(1.5)).toBe(15_000_000);
    expect(rupeesToCrore(15_000_000)).toBe(1.5);
    expect(inrToUsd(94_940, 94.94)).toBeCloseTo(1000, 9);
    expect(() => inrToUsd(1, 0)).toThrow();
  });

  it("orders notes by topic, newest verification first", () => {
    const notes = [
      { topic: "angel_tax" as const, last_verified: "2026-01-01" },
      { topic: "angel_tax" as const, last_verified: "2026-10-30" },
      { topic: "ccps" as const, last_verified: "2026-10-30" },
    ];
    expect(notesForTopic(notes, "angel_tax").map((n) => n.last_verified)).toEqual([
      "2026-10-30",
      "2026-01-01",
    ]);
    expect(INDIA_TOPICS).toContain("fema_pricing");
  });
});
