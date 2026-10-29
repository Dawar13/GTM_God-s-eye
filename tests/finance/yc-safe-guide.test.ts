/**
 * Y Combinator, "SAFE User Guide", Appendix II, Examples 1 and 2.
 * https://bookface-static.ycombinator.com/assets/ycdc/SAFE%20User%20Guide-a47c6588327d73aa2799e61ed7c2cae9f1a0ee9acfa9c43b62039dc06e715832.pdf
 * (linked from https://www.ycombinator.com/documents, fetched 2026-10-30)
 *
 * YC's tables round the price per share to 4 decimals and issue whole shares,
 * so these tests run the engine with CAP_TABLE_ROUNDING. Share counts match
 * within ±1 share: YC floors in most places but rounds Example 2's new-money
 * total to the nearest share (4,498,425.55 → 4,498,426). The option pool
 * increase is YC's stated input (1,695,000 / 1,573,000 / 1,700,000 shares),
 * not re-derived from the 10% target.
 */
import { describe, expect, it } from "vitest";
import {
  CAP_TABLE_ROUNDING,
  convertPostMoneySafes,
  equityFinancing,
  safeLiquidity,
  type PostMoneySafe,
} from "@/lib/finance";

const within = (actual: number, expected: number, tol: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

const CAP_TABLE = {
  founders: 9_250_000,
  "options outstanding": 300_000,
  "promised options": 350_000,
  pool: 100_000,
};

const SAFES_EX1: PostMoneySafe[] = [
  { holder: "Investor A", amount: 200_000, postMoneyCap: 4_000_000, discount: null },
  { holder: "Investor B", amount: 800_000, postMoneyCap: 8_000_000, discount: null },
];

describe("YC Example 1 — post-money SAFEs only", () => {
  it("Q1: the SAFEs sell at least 15% (5% + 10%)", () => {
    const r = convertPostMoneySafes({ holdings: CAP_TABLE, safes: SAFES_EX1 });
    expect(r.ownership["Investor A"]).toBeCloseTo(0.05, 6);
    expect(r.ownership["Investor B"]).toBeCloseTo(0.1, 6);
  });

  it("Q2: $5M Series A at $15M pre, 1,695,000-share pool increase, B takes pro rata", () => {
    const r = equityFinancing({
      holdings: CAP_TABLE,
      postMoneySafes: SAFES_EX1,
      preMoney: 15_000_000,
      investment: 5_000_000,
      investors: { "Investor C": 4_000_000 },
      proRata: { "Investor B": 0.1 },
      pool: { increaseShares: 1_695_000 },
      rounding: CAP_TABLE_ROUNDING,
    });
    within(r.companyCapitalization, 11_764_705, 1);
    within(r.conversions.find((c) => c.holder === "Investor A")!.shares, 588_235, 1);
    within(r.conversions.find((c) => c.holder === "Investor B")!.shares, 1_176_470, 1);
    expect(r.pricePerShare).toBe(1.1144);
    within(r.newShares, 4_486_719, 1);
    within(r.newSharesByInvestor["Investor C"]!, 3_589_375, 1);
    within(r.newSharesByInvestor["Investor B"]!, 448_671, 1);
    within(r.newSharesByInvestor["new investors"]!, 448_673, 2);
    within(r.holdings["Investor B"]!, 1_625_141, 1);
    within(r.holdings.pool!, 1_795_000, 0);
    within(r.totalFD, 17_946_424, 1);
    within(r.ownership.founders!, 0.5154, 0.00005);
    within(r.ownership["Investor C"]!, 0.2, 0.00005);
  });

  it("Q3: acquired for $10M before a priced round — both SAFEs convert", () => {
    const r = safeLiquidity({
      holdings: { founders: 9_250_000, "options outstanding": 300_000 },
      safes: SAFES_EX1,
      exitValue: 10_000_000,
      rounding: CAP_TABLE_ROUNDING,
    });
    within(r.payouts["Investor A"]!.shares, 561_764, 1);
    within(r.payouts["Investor B"]!.shares, 1_123_529, 1);
    within(r.liquidityCapitalization, 11_235_293, 1);
    expect(r.pricePerShare).toBe(0.8901);
    expect(r.payouts["Investor A"]!.converts).toBe(true);
    within(r.payouts["Investor A"]!.cash, 500_026, 1);
    within(r.payouts["Investor B"]!.cash, 1_000_053, 1);
  });

  it("Q4: acquired for $3M — neither converts; purchase amounts back, $2M to the rest", () => {
    const r = safeLiquidity({
      holdings: { founders: 9_250_000, "options outstanding": 300_000 },
      safes: SAFES_EX1,
      exitValue: 3_000_000,
    });
    expect(r.payouts["Investor A"]!.converts).toBe(false);
    expect(r.payouts["Investor B"]!.converts).toBe(false);
    within(r.payouts["Investor A"]!.cash, 200_000, 0.01);
    within(r.payouts["Investor B"]!.cash, 800_000, 0.01);
    within(r.commonPayout, 2_000_000, 0.01);
  });

  it("Q5: $2.2M Series Seed at $8.8M pre — B converts at the round price", () => {
    const r = equityFinancing({
      holdings: CAP_TABLE,
      postMoneySafes: SAFES_EX1,
      preMoney: 8_800_000,
      investment: 2_200_000,
      investors: { "Investor C": 1_650_000 },
      proRata: { "Investor B": 0.103 },
      pool: { increaseShares: 1_573_000 },
      rounding: CAP_TABLE_ROUNDING,
    });
    const a = r.conversions.find((c) => c.holder === "Investor A")!;
    const b = r.conversions.find((c) => c.holder === "Investor B")!;
    expect(a.method).toBe("cap");
    expect(b.method).toBe("round_price");
    within(b.shares, 1_216_360, 1);
    within(r.companyCapitalization, 11_806_694, 1);
    within(a.shares, 590_334, 1);
    expect(r.pricePerShare).toBe(0.6577);
    within(r.newShares, 3_344_990, 1);
    within(r.newSharesByInvestor["Investor C"]!, 2_508_742, 1);
    within(r.newSharesByInvestor["Investor B"]!, 344_533, 1);
    within(r.newSharesByInvestor["new investors"]!, 491_715, 2);
    within(r.holdings["Investor B"]!, 1_560_893, 1);
    within(r.totalFD, 16_724_684, 1);
  });
});

describe("YC Example 2 — pre-money and post-money SAFEs", () => {
  it("Q2: $5M Series A at $15M pre, 1,700,000-share pool increase", () => {
    const r = equityFinancing({
      holdings: CAP_TABLE,
      preMoneySafes: [
        { holder: "Investor A", amount: 200_000, preMoneyCap: 3_800_000, discount: null },
      ],
      postMoneySafes: [
        { holder: "Investor B", amount: 800_000, postMoneyCap: 8_000_000, discount: null },
      ],
      preMoney: 15_000_000,
      investment: 5_000_000,
      investors: { "Investor C": 4_000_000 },
      proRata: { "Investor B": 0.1 },
      pool: { increaseShares: 1_700_000 },
      rounding: CAP_TABLE_ROUNDING,
    });
    const a = r.conversions.find((c) => c.holder === "Investor A")!;
    expect(a.price).toBe(0.3248);
    within(a.shares, 615_763, 1);
    within(r.companyCapitalization, 11_795_292, 1);
    within(r.conversions.find((c) => c.holder === "Investor B")!.shares, 1_179_529, 1);
    expect(r.pricePerShare).toBe(1.1115);
    within(r.newShares, 4_498_426, 1);
    within(r.newSharesByInvestor["Investor C"]!, 3_598_740, 1);
    within(r.newSharesByInvestor["Investor B"]!, 449_842, 1);
    within(r.holdings["Investor B"]!, 1_629_371, 1);
    within(r.holdings.pool!, 1_800_000, 0);
    within(r.totalFD, 17_993_718, 1);
  });
});
