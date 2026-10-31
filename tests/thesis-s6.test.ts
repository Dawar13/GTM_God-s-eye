import { describe, expect, it } from "vitest";
import { rowsInArea, toAreaCoords, toDirectoryRows } from "@/lib/data/directory";
import { fitScore } from "@/lib/fit/score";
import { DEFAULT_FILTER_STATE, type FilterState } from "@/lib/filters";
import { inArea, normalizeArea, parseArea, serializeArea } from "@/lib/filters/area";
import type { BubblePoint, Cluster, FitFeatures, ThesisPoint } from "@/lib/schema";
import { CATEGORICAL, clusterColor } from "@/lib/viz";
import { overlaps, placeLabels } from "@/lib/viz/labels";
import {
  clusterHulls,
  positionOf,
  robustExtent,
  thesisView,
  toClusterInfo,
  toThesisRows,
  topFitIds,
  type MapPoint,
} from "@/lib/viz/transforms/thesisMap";
import { investor } from "./fixtures";

const all: FilterState = { ...DEFAULT_FILTER_STATE, region: [] };
const feat = (value: number) => ({ value, method: "test", inputs: ["x"] });
function fit(id: string, thesis: number, flags: FitFeatures["flags"] = []): FitFeatures {
  return {
    id: `fit_${id}`,
    investor_id: id,
    features: {
      thesis: feat(thesis),
      stage: feat(0.5),
      check: feat(1),
      adjacency: feat(0.2),
      geography: feat(1),
      dry_powder: feat(0),
    },
    flags,
    raise_size_usd: 1_000_000,
  };
}
const tp = (
  id: string,
  x: number,
  y: number,
  cluster: number | null = 0,
  gen = false,
): ThesisPoint => ({
  id,
  x,
  y,
  cluster_id: cluster,
  is_generalist: gen,
});
const bp = (id: string, aff: number | null, earl: number | null): BubblePoint => ({
  id,
  typical_check_usd: null,
  stage_earliness: earl,
  industrial_affinity: aff,
  latest_fund_usd: null,
  colour_key: null,
});

describe("area URL format", () => {
  it("round-trips and normalises corners to three decimals", () => {
    const a = normalizeArea({ layout: "thesis", x0: 3.75049, y0: 6, x1: -1.2501, y1: 2.5 });
    expect(a).toEqual({ layout: "thesis", x0: -1.25, y0: 2.5, x1: 3.75, y1: 6 });
    expect(serializeArea(a)).toBe("thesis:-1.25,2.5,3.75,6");
    expect(parseArea("thesis:-1.25,2.5,3.75,6")).toEqual(a);
    expect(parseArea("fit:1,1,0.5,0.5")).toEqual({ layout: "fit", x0: 0.5, y0: 0.5, x1: 1, y1: 1 });
  });

  it("ignores malformed values instead of guessing", () => {
    for (const bad of ["", "thesis", "umap:0,0,1,1", "fit:0,0,1", "fit:a,0,1,1", "fit:0,0,1,1,2"]) {
      expect(parseArea(bad)).toBeNull();
    }
    expect(parseArea(null)).toBeNull();
  });

  it("bounds are inclusive and unknown positions never match", () => {
    const a = parseArea("fit:0.5,0.5,1,1")!;
    expect(inArea([0.5, 1], a)).toBe(true);
    expect(inArea([0.499, 0.7], a)).toBe(false);
    expect(inArea(null, a)).toBe(false);
  });
});

describe("toThesisRows and thesisView", () => {
  const investors = [
    investor({ id: "inv_a", name: "A", region: "western" }),
    investor({ id: "inv_b", name: "B", region: "india", type: "accelerator" }),
    investor({ id: "inv_c", name: "C", region: "western" }),
    investor({ id: "inv_d", name: "D", region: "western" }), // no thesis vector
  ];
  const layout = [
    tp("inv_a", 0, 0),
    tp("inv_b", 1, 1, 1, true),
    tp("inv_c", 2, 0),
    tp("inv_x", 9, 9),
  ];
  const bubbles = [bp("inv_a", 0.8, 0.9), bp("inv_b", 0.2, null), bp("inv_c", 0.6, 0.7)];
  const fits = [fit("inv_a", 0.9), fit("inv_c", 0.4, ["sparse"])];
  const rows = toThesisRows(investors, layout, bubbles, fits);

  it("joins layout, axes and fit; skips layout points with no investor", () => {
    expect(rows.map((r) => r.id)).toEqual(["inv_a", "inv_b", "inv_c"]);
    const a = rows[0]!;
    expect(a.fit).toBeCloseTo(fitScore(fits[0]!).total, 9);
    expect([a.affinity, a.earliness, a.cluster]).toEqual([0.8, 0.9, 0]);
    expect(rows[1]!.marker).toBe("square");
    expect(rows[1]!.generalist).toBe(true);
    expect(rows[2]!.sparse).toBe(true);
    expect(positionOf(rows[1]!, "fit")).toBeNull();
  });

  it("matches the Directory's fit score for the same investor", () => {
    const dir = toDirectoryRows(investors, [], fits);
    expect(rows[0]!.fit).toBe(dir.find((r) => r.id === "inv_a")!.fit);
  });

  it("applies the URL filters and counts hidden and unplaced investors apart", () => {
    const universe = toDirectoryRows(investors, [], fits);
    const west = thesisView(rows, DEFAULT_FILTER_STATE, "thesis", universe);
    expect(west.points.map((p) => p.id)).toEqual(["inv_a", "inv_c"]);
    expect(west.filteredOut).toBe(1); // B is in India
    expect(west.notShown).toEqual([{ field: "thesis vector", count: 1 }]); // D

    const fitAll = thesisView(rows, all, "fit", universe);
    expect(fitAll.points.map((p) => [p.id, p.px, p.py])).toEqual([
      ["inv_a", 0.8, 0.9],
      ["inv_c", 0.6, 0.7],
    ]);
    expect(fitAll.filteredOut).toBe(0);
    expect(fitAll.notShown).toEqual([
      { field: "stage earliness", count: 1 },
      { field: "thesis vector", count: 1 },
    ]);
    const missing = fitAll.notShown!.reduce((s, n) => s + n.count, 0);
    expect(fitAll.points.length + missing).toBe(universe.length);
    expect(thesisView(rows, all, "fit", null).notShown).toBeNull();
  });
});

describe("topFitIds", () => {
  const pt = (id: string, fit: number | null, sparse = false, coverage = 1) =>
    ({ id, fit, sparse, fitCoverage: coverage }) as MapPoint;
  it("ranks by fit, leaves out sparse and unknown, ties by coverage then id", () => {
    const pts = [
      pt("a", 50),
      pt("b", 90, true),
      pt("c", 70),
      pt("d", null),
      pt("e", 70, false, 0.5),
      pt("f", 50),
    ];
    expect(topFitIds(pts, 30)).toEqual(["c", "e", "a", "f"]);
    expect(topFitIds(pts, 2)).toEqual(["c", "e"]);
  });
});

describe("clusterHulls", () => {
  const p = (id: string, px: number, py: number, cluster: number | null, generalist = false) =>
    ({ id, px, py, cluster, generalist }) as MapPoint;

  it("needs three non-generalist members and leaves generalists out", () => {
    const hulls = clusterHulls([
      p("a", 0, 0, 0),
      p("b", 1, 0, 0),
      p("c", 0, 1, 1),
      p("g", 5, 5, 0, true),
      p("d", 0, 2, 0),
    ]);
    expect(hulls).toHaveLength(1);
    expect(hulls[0]!.cluster).toBe(0);
    expect(hulls[0]!.members).toBe(3);
    expect(hulls[0]!.polygon.some(([x, y]) => x === 5 && y === 5)).toBe(false);
  });

  it("leaves far-flung members out of the hull so they do not stretch it", () => {
    const core = Array.from({ length: 19 }, (_, i) => p(`p${i}`, Math.cos(i), Math.sin(i), 2));
    const hulls = clusterHulls([...core, p("far", 40, 40, 2), p("far2", -30, 5, 2)]);
    const h = hulls[0]!;
    expect(h.members).toBe(21);
    expect(h.core).toBe(19);
    expect(h.polygon.every(([x, y]) => Math.abs(x) <= 1 && Math.abs(y) <= 1)).toBe(true);
    const [cx, cy] = h.centroid;
    expect(Math.hypot(cx, cy)).toBeLessThan(1);
  });

  it("skips collinear clusters (no area to fill)", () => {
    expect(clusterHulls([p("a", 0, 0, 0), p("b", 1, 1, 0), p("c", 2, 2, 0)])).toEqual([]);
  });
});

describe("robustExtent", () => {
  it("fits the main body and leaves a far island for zooming out", () => {
    const body = Array.from({ length: 100 }, (_, i) => ({ x: i / 10, y: i / 10 }));
    const island = Array.from({ length: 4 }, () => ({ x: 100, y: -50 }));
    const ext = robustExtent([...body, ...island], { pad: 0 });
    expect(ext.x).toEqual([0, 9.9]);
    expect(ext.y).toEqual([0, 9.9]);
  });

  it("keeps a continuous tail in view", () => {
    const tail = Array.from({ length: 100 }, (_, i) => ({ x: i, y: 0 }));
    expect(robustExtent(tail, { pad: 0 }).x).toEqual([0, 99]);
  });
});

describe("placeLabels", () => {
  it("never overlaps labels or obstacles and keeps them inside the plot", () => {
    const cands = Array.from({ length: 40 }, (_, i) => ({
      id: `l${i}`,
      x: 50 + (i % 8) * 18,
      y: 50 + Math.floor(i / 8) * 9,
      r: 4,
      text: `Investor ${i}`,
    }));
    const obstacle = { x0: 0, y0: 0, x1: 400, y1: 30 };
    const placed = placeLabels(cands, { width: 400, height: 200, obstacles: [obstacle] });
    expect(placed.length).toBeGreaterThan(0);
    expect(placed.length).toBeLessThan(cands.length);
    for (const [i, a] of placed.entries()) {
      expect(overlaps(a.box, obstacle)).toBe(false);
      expect(a.box.x0).toBeGreaterThanOrEqual(0);
      expect(a.box.x1).toBeLessThanOrEqual(400);
      for (const b of placed.slice(i + 1)) expect(overlaps(a.box, b.box)).toBe(false);
    }
  });

  it("always places forced labels and skips marks off screen", () => {
    const placed = placeLabels(
      [
        { id: "a", x: 100, y: 100, r: 4, text: "Alpha" },
        { id: "hover", x: 101, y: 100, r: 6, text: "Hovered", force: true },
        { id: "off", x: -10, y: 50, r: 4, text: "Off" },
      ],
      { width: 300, height: 200 },
    );
    expect(placed[0]!.id).toBe("hover");
    expect(placed.some((l) => l.id === "off")).toBe(false);
  });
});

describe("clusters and area coordinates", () => {
  it("names clusters from their top sectors and gives a ninth cluster its own colour", () => {
    const cl: Cluster = {
      id: "cl_8",
      index: 8,
      name: "enterprise saas · fintech · ai infra",
      size: 12,
      top_sectors: [
        { sector: "enterprise_saas", weight: 0.4 },
        { sector: "fintech", weight: 0.3 },
        { sector: "ai_infra", weight: 0.1 },
      ],
    };
    const [info] = toClusterInfo([cl]);
    expect(info!.label).toBe("Enterprise SaaS · Fintech · AI infrastructure");
    expect(info!.shortLabel).toBe("Enterprise SaaS · Fintech");
    expect(info!.color).not.toBe(CATEGORICAL[0]);
    expect(new Set(Array.from({ length: 10 }, (_, i) => clusterColor(i))).size).toBe(10);
  });

  it("resolves a brushed area to Directory rows with the same coordinates as the map", () => {
    const coords = toAreaCoords(
      [tp("inv_a", 0, 0), tp("inv_b", 5, 5)],
      [bp("inv_a", 0.9, 0.9), bp("inv_b", 0.1, null)],
    );
    expect(coords.inv_b!.fit).toBeNull();
    const rows = [{ id: "inv_a" }, { id: "inv_b" }, { id: "inv_z" }];
    expect(rowsInArea(rows, coords, parseArea("thesis:-1,-1,1,1")).map((r) => r.id)).toEqual([
      "inv_a",
    ]);
    expect(rowsInArea(rows, coords, parseArea("fit:0,0,1,1")).map((r) => r.id)).toEqual(["inv_a"]);
    expect(rowsInArea(rows, coords, null)).toHaveLength(3);
  });
});
