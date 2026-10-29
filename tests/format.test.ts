import { describe, expect, it } from "vitest";
import { formatCount, formatInrCrore, formatPercent, formatUsd, UNKNOWN } from "@/lib/format";

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
