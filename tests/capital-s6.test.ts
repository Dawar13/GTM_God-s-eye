import { describe, expect, it } from "vitest";
import { toDirectoryRows } from "@/lib/data/directory";
import { DEFAULT_FILTER_STATE, type FilterState } from "@/lib/filters";
import type { BubblePoint } from "@/lib/schema";
import {
  bubbleDiameter,
  bubbleSizing,
  bubbleView,
  checkDomain,
  logTicks,
  plotlyDiameter,
  sizeSamples,
  toBubbleData,
} from "@/lib/viz/transforms/capitalBubbles";
import { fund, investor } from "./fixtures";

const all: FilterState = { ...DEFAULT_FILTER_STATE, region: [] };
const bp = (id: string, over: Partial<BubblePoint> = {}): BubblePoint => ({
  id,
  typical_check_usd: 1_000_000,
  stage_earliness: 0.8,
  industrial_affinity: 0.5,
  latest_fund_usd: 100_000_000,
  colour_key: "cl_2",
  ...over,
});

describe("toBubbleData and bubbleView", () => {
  const investors = [
    investor({ id: "inv_a", name: "A", check_min_usd: 500_000, check_max_usd: 2_000_000 }),
    investor({ id: "inv_b", name: "B", type: "accelerator", region: "india" }),
    investor({ id: "inv_c", name: "C" }),
    investor({ id: "inv_d", name: "D" }),
    investor({ id: "inv_e", name: "E" }), // not in layout_bubbles at all
  ];
  const bubbles = [
    bp("inv_a"),
    bp("inv_b", { latest_fund_usd: null, colour_key: null, typical_check_usd: 150_000 }),
    bp("inv_c", { stage_earliness: null }),
    bp("inv_d", { typical_check_usd: null, industrial_affinity: null }),
  ];
  const funds = [
    fund({
      id: "fund_a1",
      investor_id: "inv_a",
      close_date: "2025-02-10",
      vintage_year: 2025,
      size_usd: 100e6,
    }),
    fund({
      id: "fund_a0",
      investor_id: "inv_a",
      close_date: "2021-01-01",
      vintage_year: 2021,
      size_usd: 40e6,
    }),
  ];
  const data = toBubbleData(investors, bubbles, funds);

  it("keeps investors with all three axes and records the first missing one for the rest", () => {
    expect(data.rows.map((r) => r.id)).toEqual(["inv_a", "inv_b"]);
    expect(data.missing).toEqual({ inv_c: "stage earliness", inv_d: "typical check" });
    const [a, b] = data.rows;
    expect(a!.cluster).toBe(2);
    expect(a!.fundPeriod).toBe("10 Feb 2025");
    expect(b!.cluster).toBeNull();
    expect(b!.marker).toBe("square");
    expect(b!.fundUsd).toBeNull();
    expect(data.maxFundUsd).toBe(100e6);
    expect(data.checkExtent).toEqual([150_000, 1_000_000]);
  });

  it("applies the filters and splits hidden from unplaced investors", () => {
    const universe = toDirectoryRows(investors, funds, []);
    const west = bubbleView(data, DEFAULT_FILTER_STATE, universe);
    expect(west.points.map((p) => p.id)).toEqual(["inv_a"]);
    expect(west.filteredOut).toBe(1);
    expect(west.notShown).toEqual([
      { field: "typical check", count: 2 }, // D (missing check) and E (no axes at all)
      { field: "stage earliness", count: 1 },
    ]);
    const everyone = bubbleView(data, all, universe);
    expect(everyone.unsized).toBe(1);
    const missing = everyone.notShown!.reduce((s, n) => s + n.count, 0);
    expect(everyone.points.length + missing).toBe(universe.length);
    expect(bubbleView(data, all, null).notShown).toBeNull();
  });
});

describe("bubble sizing", () => {
  const s = bubbleSizing(1_500_000_000)!;

  it("is area-proportional: four times the fund, twice the diameter", () => {
    const d1 = bubbleDiameter(100e6, s)!;
    const d4 = bubbleDiameter(400e6, s)!;
    expect(d4 / d1).toBeCloseTo(2, 9);
    expect(bubbleDiameter(s.maxValue, s)).toBeCloseTo(s.maxDiameter, 9);
    expect(bubbleDiameter(null, s)).toBeNull();
    expect(bubbleSizing(null)).toBeNull();
    expect(bubbleSizing(0)).toBeNull();
  });

  it("floors tiny funds at the stated minimum", () => {
    expect(bubbleDiameter(s.floorValue / 10, s)).toBe(s.minDiameter);
    expect(bubbleDiameter(s.floorValue, s)).toBeCloseTo(s.minDiameter, 9);
  });

  it("Plotly's sizeref and sizemin draw the same diameters as the 2D projections", () => {
    for (const v of [s.floorValue / 4, s.floorValue, 50e6, 300e6, s.maxValue]) {
      expect(plotlyDiameter(v, s)).toBeCloseTo(bubbleDiameter(v, s)!, 9);
    }
    expect(s.plotly.sizemode).toBe("area");
  });

  it("legend samples, log ticks and the padded check domain", () => {
    expect(sizeSamples(1.5e9)).toEqual([1e7, 1e8, 1e9]);
    expect(sizeSamples(5e6)).toEqual([]);
    expect(logTicks([1e5, 2.5e6])).toEqual([1e5, 3e5, 1e6]);
    const [lo, hi] = checkDomain([1e5, 2e7]);
    expect(lo).toBeLessThan(1e5);
    expect(hi).toBeGreaterThan(2e7);
  });
});
