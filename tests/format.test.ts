import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatMultiple,
  formatInrCrore,
  formatMonthYear,
  formatPercent,
  formatUsd,
  UNKNOWN,
} from "@/lib/format";

describe("formatUsd", () => {
  it.each([
    [1_200_000, "$1.2M"],
    [740_000_000, "$740M"],
    [160_000_000, "$160M"],
    [7_500_000, "$7.5M"],
    [50_000_000, "$50M"],
    [1_600_000_000, "$1.6B"],
    [1_000_000_000, "$1B"],
    [500_000, "$500K"],
    [25_000, "$25K"],
    [0, "$0"],
  ])("%d → %s", (value, expected) => {
    expect(formatUsd(value)).toBe(expected);
  });

  it("shows unknown values as a dash", () => {
    expect(formatUsd(null)).toBe(UNKNOWN);
    expect(formatUsd(undefined)).toBe(UNKNOWN);
    expect(formatUsd(Number.NaN)).toBe(UNKNOWN);
  });
});

describe("formatInrCrore", () => {
  it("formats crore", () => {
    expect(formatInrCrore(15_000_000)).toBe("₹1.5 Cr");
    expect(formatInrCrore(100_000_000)).toBe("₹10 Cr");
    expect(formatInrCrore(null)).toBe(UNKNOWN);
  });
});

describe("formatPercent", () => {
  it("rounds to one decimal place", () => {
    expect(formatPercent(0.0912)).toBe("9.1%");
    expect(formatPercent(0.09)).toBe("9.0%");
    expect(formatPercent(null)).toBe(UNKNOWN);
  });
});

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(973)).toBe("973");
    expect(formatCount(1234)).toBe("1,234");
  });
});

describe("formatUsd billions", () => {
  it("keeps two decimals under a billion-scale value", () => {
    expect(formatUsd(1_750_000_000)).toBe("$1.75B");
    expect(formatUsd(1_600_000_000)).toBe("$1.6B");
  });
});

describe("formatMonthYear", () => {
  it.each([
    ["2026-03-14", "Mar 2026"],
    ["2026-03", "Mar 2026"],
    ["2026", "2026"],
  ])("%s → %s", (iso, expected) => {
    expect(formatMonthYear(iso)).toBe(expected);
  });

  it("shows unknown or malformed values as a dash", () => {
    expect(formatMonthYear(null)).toBe(UNKNOWN);
    expect(formatMonthYear("soon")).toBe(UNKNOWN);
    expect(formatMonthYear("2026-13")).toBe(UNKNOWN);
  });
});

describe("formatMultiple", () => {
  it("shows two decimals and a times sign", () => {
    expect(formatMultiple(0.64)).toBe("0.64×");
    expect(formatMultiple(10)).toBe("10.00×");
    expect(formatMultiple(null)).toBe("—");
    expect(formatMultiple(Number.NaN)).toBe("—");
  });
});
