import { describe, expect, it } from "vitest";
import { clampZoom, stepZoom, zoomPercent, ZOOM_STEP } from "@/lib/viz/zoom";

describe("zoom math", () => {
  it("steps by about 1.4 in and out", () => {
    expect(ZOOM_STEP).toBeCloseTo(1.4);
    expect(stepZoom(1, 1)).toBeCloseTo(1.4);
    expect(stepZoom(2.8, -1)).toBeCloseTo(2);
  });
  it("clamps to min and max", () => {
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(19, 1)).toBe(20);
    expect(clampZoom(0.2, 0.5, 4)).toBe(0.5);
    expect(stepZoom(3, 1, 0.5, 4)).toBe(4);
  });
  it("formats the percent label", () => {
    expect(zoomPercent(1)).toBe("100%");
    expect(zoomPercent(1.5)).toBe("150%");
    expect(zoomPercent(1.996)).toBe("200%");
  });
});
