import { describe, expect, it } from "vitest";
import { liquidationBreakpoints, noteScenario, type PreferredClass } from "@/lib/finance";
import { formatUsd } from "@/lib/format";
import { exitByFundSize, exitGauge, postMoneyByMultiple } from "@/lib/viz/transforms/calcFund";
import {
  breakpointLabels,
  payoutSeries,
  payoutSeriesKeys,
  payoutTable,
} from "@/lib/viz/transforms/calcLiquidation";
import {
  accruedSeries,
  noteOwnership,
  noteWhy,
  priceComparison,
} from "@/lib/viz/transforms/calcNote";

const note = (cap: number | null, discount: number | null) =>
  noteScenario({
    principal: 100_000,
    rate: 0.08,
    compounding: "simple",
    years: 1,
    cap,
    capBasis: "pre_money",
    discount,
    roundPreMoney: 5e6,
    roundInvestment: 1e6,
    capitalization: 5e6,
  });

describe("accruedSeries", () => {
  it("starts at principal and ends at the converting amount", () => {
    const s = accruedSeries({ principal: 100_000, rate: 0.08, compounding: "simple", months: 12 });
    expect(s).toHaveLength(13);
    expect(s[0]).toEqual({ month: 0, value: 100_000, interest: 0 });
    expect(s[12]?.value).toBeCloseTo(108_000, 6);
    expect(s[6]?.value).toBeCloseTo(104_000, 6);
  });
  it("compound annual interest gives 121,000 after two years at 10%", () => {
    const c = accruedSeries({ principal: 100_000, rate: 0.1, compounding: "annual", months: 24 });
    expect(c[24]?.value).toBeCloseTo(121_000, 6);
  });
  it("rejects fractional months", () => {
    expect(() =>
      accruedSeries({ principal: 1, rate: 0.1, compounding: "simple", months: 1.5 }),
    ).toThrow(RangeError);
  });
});

describe("priceComparison and noteWhy", () => {
  it("marks the cap as the applied price when it is lowest", () => {
    const s = note(4e6, 0.1);
    const bars = priceComparison(s, true);
    expect(bars.map((b) => [b.key, b.price, b.applies])).toEqual([
      ["round", 1, false],
      ["discount", 0.9, false],
      ["cap", 0.8, true],
    ]);
    expect(noteWhy(s, true)).toMatch(/cap price is lower/);
  });
  it("omits the discount bar when there is no discount", () => {
    const bars = priceComparison(note(1e7, null), false);
    expect(bars.map((b) => b.key)).toEqual(["round", "cap"]);
    expect(bars.find((b) => b.applies)?.key).toBe("round");
  });
  it("ownership segments sum to one", () => {
    const sum = noteOwnership(note(4e6, 0.1)).reduce((a, s) => a + s.fraction, 0);
    expect(sum).toBeCloseTo(1, 12);
  });
});

describe("liquidation transforms", () => {
  const A: PreferredClass = {
    name: "Series A",
    invested: 4e6,
    shares: 2e6,
    multiple: 1,
    participation: "none",
    seniority: 1,
  };
  const B: PreferredClass = { ...A, name: "Series B", invested: 12e6, seniority: 2 };
  const base = { commonShares: 6e6, classes: [A, B] };
  const bps = liquidationBreakpoints(base, 100e6);

  it("linear series runs 0 to max and every row pays out the whole exit", () => {
    const rows = payoutSeries({ base, maxExit: 100e6, scale: "linear", breakpoints: bps });
    expect(rows[0]?.exit).toBe(0);
    expect(rows.at(-1)?.exit).toBe(100e6);
    for (const r of rows)
      expect((r.common as number) + (r.c0 as number) + (r.c1 as number)).toBeCloseTo(r.exit, 4);
  });
  it("includes each breakpoint exit in the sample", () => {
    const rows = payoutSeries({ base, maxExit: 100e6, scale: "linear", breakpoints: bps });
    for (const b of bps) expect(rows.some((r) => r.exit === b.exit)).toBe(true);
  });
  it("log series starts at max/1000 and never at zero", () => {
    const rows = payoutSeries({ base, maxExit: 100e6, scale: "log", breakpoints: bps });
    expect(rows[0]?.exit).toBeCloseTo(100_000, 6);
    expect(rows.every((r) => r.exit > 0)).toBe(true);
  });
  it("labels breakpoints in plain words", () => {
    const labels = breakpointLabels(bps).map((l) => l.label);
    expect(labels).toContain("Series A converts above $28M");
    expect(labels).toContain("Series B preference covered at $12M");
  });
  it("table rows include breakpoints and keys match the series", () => {
    const rows = payoutTable(base, 100e6, bps);
    expect(rows.length).toBe(8 + bps.length);
    expect(payoutSeriesKeys(base).map((k) => k.key)).toEqual(["common", "c0", "c1"]);
  });
});

describe("fund transforms", () => {
  it("exit needed scales linearly with fund size at fixed ownership", () => {
    const bars = exitByFundSize({
      selectedFundSize: 75e6,
      ownershipAtExit: 0.064,
      multiple: 1,
      formatSize: formatUsd,
    });
    expect(bars.map((b) => b.fundSize)).toEqual([50e6, 75e6, 100e6, 250e6, 500e6, 1e9]);
    expect(bars[0]?.exitNeeded).toBeCloseTo(781_250_000, 4);
    expect(bars.at(-1)?.exitNeeded).toBeCloseTo(15_625_000_000, 2);
    expect(bars.filter((b) => b.selected).map((b) => b.fundSize)).toEqual([75e6]);
  });
  it("does not duplicate a selected size that is already a preset", () => {
    const bars = exitByFundSize({
      selectedFundSize: 1e9,
      ownershipAtExit: 0.05,
      multiple: 1,
      formatSize: formatUsd,
    });
    expect(bars).toHaveLength(5);
  });
  it("gauge puts both marks on one scale from zero", () => {
    const g = exitGauge(781_250_000, 500e6);
    expect(g.max).toBeCloseTo(859_375_000, 2);
    expect(g.requiredFrac).toBeCloseTo(1 / 1.1, 12);
    expect(g.assumedFrac).toBeCloseTo(500e6 / 859_375_000, 12);
    expect(g.reaches).toBe(false);
    expect(exitGauge(100, 200).reaches).toBe(true);
  });
  it("gauge rejects non-positive input", () => {
    expect(() => exitGauge(0, 5)).toThrow(RangeError);
  });
  it("post-money by multiple: $1B exit, 50% retained, $5M in", () => {
    // post = $1B x 0.5 / multiple: 10x -> $50M, 5x -> $100M.
    const bars = postMoneyByMultiple({
      exitValue: 1e9,
      retention: 0.5,
      investment: 5e6,
      selectedMultiple: 10,
    });
    expect(bars.find((b) => b.multiple === 10)?.postMoney).toBeCloseTo(50e6, 4);
    expect(bars.find((b) => b.multiple === 5)?.postMoney).toBeCloseTo(100e6, 4);
    expect(bars.find((b) => b.multiple === 10)?.selected).toBe(true);
  });
  it("leaves out a preset multiple the exit cannot support", () => {
    const bars = postMoneyByMultiple({
      exitValue: 100e6,
      retention: 0.5,
      investment: 5e6,
      selectedMultiple: 5,
    });
    // 30x -> post-money $1.67M, below the $5M invested: dropped.
    expect(bars.some((b) => b.multiple === 30)).toBe(false);
    expect(bars.some((b) => b.multiple === 5)).toBe(true);
  });
});
