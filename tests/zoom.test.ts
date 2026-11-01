import { describe, expect, it } from "vitest";
import {
  clampZoom,
  createZoomReadout,
  stepZoom,
  wheelZoomFactor,
  zoomPercent,
  ZOOM_STEP,
} from "@/lib/viz/zoom";

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

describe("wheel zoom", () => {
  it("is proportional to the delta and symmetric", () => {
    const notch = wheelZoomFactor(-100);
    expect(notch).toBeGreaterThan(1.1);
    expect(notch).toBeLessThan(1.2);
    // Ten small trackpad deltas make one notch.
    expect(wheelZoomFactor(-10) ** 10).toBeCloseTo(notch);
    expect(wheelZoomFactor(100) * notch).toBeCloseTo(1);
  });
  it("normalises lines and pinch", () => {
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(wheelZoomFactor(-75));
    expect(wheelZoomFactor(-4, 0, true)).toBeCloseTo(wheelZoomFactor(-40));
  });
});

describe("zoom readout", () => {
  it("notifies only when the rounded percent changes", () => {
    const r = createZoomReadout();
    let calls = 0;
    const off = r.subscribe(() => calls++);
    r.set(1.001);
    expect(calls).toBe(0);
    r.set(1.5);
    expect(r.get()).toBe(150);
    expect(calls).toBe(1);
    off();
    r.set(2);
    expect(calls).toBe(1);
  });
});
