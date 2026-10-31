import { describe, expect, it } from "vitest";
import {
  formatFieldValue,
  parseNumberInput,
  positionToValue,
  roundSignificant,
  valueToPosition,
} from "@/lib/calculators/parse";
import { allFinite, friendlyError } from "@/lib/calculators/useLastValid";
import { formatPricePerShare } from "@/lib/format";
import { pricedRound } from "@/lib/finance";

describe("parseNumberInput", () => {
  it.each([
    ["1000000", "usd", 1_000_000],
    ["$1,500,000", "usd", 1_500_000],
    ["1.5m", "usd", 1_500_000],
    ["9M", "count", 9_000_000],
    ["250k", "usd", 250_000],
    ["10", "percent", 0.1],
    ["12.5%", "percent", 0.125],
  ] as const)("%s as %s is %d", (text, kind, expected) => {
    expect(parseNumberInput(text, kind)).toBeCloseTo(expected, 9);
  });

  it.each(["", "abc", "1e400", "Infinity", "NaN", "--1", "5m", "1,2,x"])(
    "%j is rejected",
    (text) => {
      const kind = text === "5m" ? "percent" : "usd";
      expect(parseNumberInput(text, kind)).toBeNull();
    },
  );
});

describe("field formatting and slider mapping", () => {
  it("formats values for display", () => {
    expect(formatFieldValue(1_000_000, "usd")).toBe("$1,000,000");
    expect(formatFieldValue(9_000_000, "count")).toBe("9,000,000");
    expect(formatFieldValue(0.1, "percent")).toBe("10.0");
    expect(formatFieldValue(Number.NaN, "usd")).toBe("");
  });

  it("round-trips a value through a log slider within two significant digits", () => {
    const p = valueToPosition(1_000_000, 10_000, 1_000_000_000, "log");
    expect(p).toBe(400); // 2 of 5 decades
    expect(positionToValue(p, 10_000, 1_000_000_000, "log", 1)).toBe(1_000_000);
  });

  it("clamps out-of-range values and snaps linear values to the step", () => {
    expect(valueToPosition(5, 10, 100, "linear")).toBe(0);
    expect(valueToPosition(500, 10, 100, "linear")).toBe(1000);
    expect(positionToValue(500, 0, 1_000_000, "linear", 10_000)).toBe(500_000);
    expect(roundSignificant(123_456, 2)).toBe(120_000);
  });
});

describe("last-valid helpers", () => {
  it("allFinite finds NaN and Infinity anywhere in a result", () => {
    expect(allFinite({ a: 1, b: [2, { c: 3 }] })).toBe(true);
    expect(allFinite({ a: 1, b: [2, { c: Number.NaN }] })).toBe(false);
    expect(allFinite({ a: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it("turns engine errors into readable sentences", () => {
    let message = "";
    try {
      pricedRound({ postMoney: 500_000, investment: 1_000_000, preMoneyFDShares: 1e6 });
    } catch (e) {
      message = friendlyError(e);
    }
    expect(message).toBe("Pre-money must be positive.");
  });
});

describe("formatPricePerShare", () => {
  it("shows four decimals and a dash for unknown", () => {
    expect(formatPricePerShare(0.9)).toBe("$0.9000");
    expect(formatPricePerShare(Number.NaN)).toBe("—");
  });
});
