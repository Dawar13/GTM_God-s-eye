import { describe, expect, it } from "vitest";
import {
  CATEGORICAL,
  categoricalColor,
  companyGrey,
  darken,
  markStyle,
  sequentialColor,
} from "@/lib/viz/palette";
import { linearScale, logScale, sqrtScale } from "@/lib/viz/scales";
import { axisFormat, logAxisTitle } from "@/lib/viz/axis";

describe("palette", () => {
  it("has eight categorical hues and wraps", () => {
    expect(CATEGORICAL).toHaveLength(8);
    expect(categoricalColor(8)).toBe(CATEGORICAL[0]);
    expect(categoricalColor(-1)).toBe(CATEGORICAL[7]);
  });

  it("darkens each channel by 15%", () => {
    expect(darken("#FFFFFF")).toBe("#D9D9D9");
    expect(darken("#000000")).toBe("#000000");
    expect(darken("#4E79A7")).toBe("#42678E");
  });

  it("marks use an 85% fill and a darkened 1px stroke", () => {
    const m = markStyle("#4E79A7");
    expect(m.fill).toBe("rgba(78, 121, 167, 0.85)");
    expect(m.stroke).toBe(darken("#4E79A7"));
    expect(m.strokeWidth).toBe(1);
  });

  it("sequential ramp hits both endpoints and clamps", () => {
    expect(sequentialColor(0)).toBe("#EEF0FB");
    expect(sequentialColor(1)).toBe("#4F5BD5");
    expect(sequentialColor(5)).toBe("#4F5BD5");
    expect(sequentialColor(-1)).toBe("#EEF0FB");
  });

  it("company grey runs light to dark by capital and never invents a grey for unknown", () => {
    expect(companyGrey(0, 100)).toBe("#C4C9D1");
    expect(companyGrey(100, 100)).toBe("#8A919C");
    expect(companyGrey(null, 100)).toBeNull();
    expect(companyGrey(10, 0)).toBeNull();
  });

  it("rejects non-hex input", () => {
    expect(() => darken("red")).toThrow();
  });
});

describe("scales", () => {
  it("linear maps and returns null for unknown", () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(5)).toBe(50);
    expect(s(null)).toBeNull();
    expect(s(Number.NaN)).toBeNull();
  });

  it("log guards non-positive domain and values", () => {
    expect(() => logScale([0, 100], [0, 1])).toThrow(RangeError);
    const s = logScale([1, 100], [0, 100]);
    expect(s(10)).toBeCloseTo(50);
    expect(s(0)).toBeNull();
    expect(s(-5)).toBeNull();
    expect(s(null)).toBeNull();
  });

  it("sqrt size scale makes area proportional to value", () => {
    const r = sqrtScale(100, 40);
    const area = (v: number) => Math.PI * (r(v) as number) ** 2;
    expect(r(100)).toBeCloseTo(40);
    expect(r(0)).toBe(0);
    expect(area(100) / area(25)).toBeCloseTo(4);
    expect(area(50) / area(10)).toBeCloseTo(5);
    expect(r(null)).toBeNull();
    expect(r(-1)).toBeNull();
  });
});

describe("axis formatters", () => {
  it("delegate to src/lib/format", () => {
    expect(axisFormat.usd(1_750_000_000)).toBe("$1.75B");
    expect(axisFormat.percent(0.0912)).toBe("9.1%");
    expect(axisFormat.date("2026-03-01")).toBe("Mar 2026");
    expect(axisFormat.year(null)).toBe("—");
  });

  it("log axis titles say so", () => {
    expect(logAxisTitle("Fund size")).toBe("Fund size (log scale)");
  });
});
