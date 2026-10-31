/**
 * Thesis map data (PHASE_2 S6). Rows are built once on the server from the pipeline's
 * layout_thesis (UMAP or PCA position, cluster, generalist flag) and layout_bubbles (the fit
 * view axes); the view function runs on the client whenever the URL filters change.
 */
import { polygonArea, polygonCentroid, polygonHull } from "d3";
import { fitScore } from "@/lib/fit/score";
import { applyFilters, type FilterableInvestor, type FilterState } from "@/lib/filters";
import { toFilterable } from "@/lib/data/directory";
import { SECTOR_LABELS } from "@/lib/format/labels";
import type {
  BubblePoint,
  Cluster,
  Confidence,
  FitFeatures,
  Investor,
  ThesisPoint,
} from "@/lib/schema";
import { clusterColor } from "../palette";
import { markerShapeFor, type MarkerShape } from "../markers";
import { provenanceOf } from "./common";

export type ThesisRow = FilterableInvestor & {
  name: string;
  /** Thesis layout position (layout_thesis; no units). */
  x: number;
  y: number;
  /** Fit view x: industrial affinity, 0–1 (layout_bubbles). */
  affinity: number | null;
  /** Fit view y: stage earliness, 0–1 (layout_bubbles). */
  earliness: number | null;
  /** Cluster index (layout_thesis.cluster_id); generalists carry their nearest cluster's. */
  cluster: number | null;
  generalist: boolean;
  marker: MarkerShape;
  /** Fit score with the default weights, as in the Directory; null when no feature is known. */
  fit: number | null;
  fitCoverage: number | null;
  sparse: boolean;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type ClusterInfo = {
  index: number;
  id: string;
  /**
   * The cluster's name in every view (map, legends, tooltips, the competitor heatmap, the
   * network): its top two sectors, e.g. "Robotics and physical AI · AI infrastructure".
   */
  label: string;
  size: number;
  color: string;
};

export function toClusterInfo(clusters: readonly Cluster[]): ClusterInfo[] {
  return [...clusters]
    .sort((a, b) => a.index - b.index)
    .map((c) => {
      const names = c.top_sectors.map((s) => SECTOR_LABELS[s.sector]);
      return {
        index: c.index,
        id: c.id,
        label: names.length ? names.slice(0, 2).join(" · ") : c.name,
        size: c.size,
        color: clusterColor(c.index),
      };
    });
}

/** One row per layout_thesis point whose investor exists, with the filter fields and the fit score. */
export function toThesisRows(
  investors: readonly Investor[],
  layout: readonly ThesisPoint[],
  bubbles: readonly BubblePoint[],
  fits: readonly FitFeatures[],
): ThesisRow[] {
  const byId = new Map(investors.map((i) => [i.id, i]));
  const axes = new Map(bubbles.map((b) => [b.id, b]));
  const fitById = new Map(fits.map((f) => [f.investor_id, f]));
  const rows: ThesisRow[] = [];
  for (const p of layout) {
    const inv = byId.get(p.id);
    if (!inv) continue;
    const b = axes.get(p.id);
    const fit = fitById.get(p.id);
    const score = fit ? fitScore(fit) : null;
    rows.push({
      ...toFilterable(inv),
      name: inv.name,
      x: p.x,
      y: p.y,
      affinity: b?.industrial_affinity ?? null,
      earliness: b?.stage_earliness ?? null,
      cluster: p.cluster_id,
      generalist: p.is_generalist,
      marker: markerShapeFor(inv.type),
      fit: score ? score.total : null,
      fitCoverage: score ? score.coverage : null,
      sparse: fit?.flags.includes("sparse") ?? false,
      ...provenanceOf([inv]),
    });
  }
  return rows;
}

export type MapLayout = "thesis" | "fit";
export type MapPoint = ThesisRow & { px: number; py: number };
export type NotShownCount = { field: string; count: number };

/** A row's position in a layout, or null when that layout lacks a coordinate for it. */
export function positionOf(row: ThesisRow, layout: MapLayout): [number, number] | null {
  if (layout === "thesis") return [row.x, row.y];
  return row.affinity === null || row.earliness === null ? null : [row.affinity, row.earliness];
}

export type ThesisView = {
  points: MapPoint[];
  /** Rows that have coordinates in this layout but fail the filters. */
  filteredOut: number;
  /**
   * Investors that pass the filters but have no coordinates, by the first missing field.
   * Null until the universe (every investor's filter fields) is known.
   */
  notShown: NotShownCount[] | null;
  sources: string[];
};

/**
 * The marks for one layout under the URL filters. `universe` is every investor's filter
 * fields (the Directory's rows, or /api/filter-index on the client); with it the not-shown
 * count is "investors the Directory lists for these filters that the map cannot place".
 */
export function thesisView(
  rows: readonly ThesisRow[],
  filters: FilterState,
  layout: MapLayout,
  universe?: readonly FilterableInvestor[] | null,
): ThesisView {
  const placed = rows.flatMap((r) => {
    const pos = positionOf(r, layout);
    return pos ? [{ ...r, px: pos[0], py: pos[1] }] : [];
  });
  const points = applyFilters(placed, filters);

  let notShown: NotShownCount[] | null = null;
  if (universe) {
    const rowById = new Map(rows.map((r) => [r.id, r]));
    const shown = new Set(points.map((p) => p.id));
    const counts = new Map<string, number>();
    const add = (field: string) => counts.set(field, (counts.get(field) ?? 0) + 1);
    for (const u of applyFilters(universe, filters)) {
      if (shown.has(u.id)) continue;
      const r = rowById.get(u.id);
      if (!r) add("thesis vector");
      else if (r.affinity === null) add("industrial affinity");
      else add("stage earliness");
    }
    notShown = [...counts].map(([field, count]) => ({ field, count }));
    if (notShown.length === 0) notShown = [{ field: "thesis vector", count: 0 }];
  }

  return {
    points,
    filteredOut: placed.length - points.length,
    notShown,
    sources: topSourceDomains(points, 4),
  };
}

/** The most common primary source domains among the marks, with "N more domains" when others exist. */
function topSourceDomains(points: readonly MapPoint[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const p of points) {
    const d = p.sourceDomain?.split(" +")[0];
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked.slice(0, n).map(([d]) => d);
  const more = ranked.length - top.length;
  return more > 0 ? [...top, `${more} more domains`] : top;
}

/**
 * Ids of the `n` best-fitting marks, as S2 ranks them: default weights, investors flagged
 * `sparse` left out, ties by coverage then id (rankByFit in src/lib/fit/score.ts).
 */
export function topFitIds(points: readonly MapPoint[], n = 30): string[] {
  return points
    .filter((p) => p.fit !== null && !p.sparse)
    .sort(
      (a, b) =>
        (b.fit ?? 0) - (a.fit ?? 0) ||
        (b.fitCoverage ?? 0) - (a.fitCoverage ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, n)
    .map((p) => p.id);
}

export type ClusterHull = {
  cluster: number;
  /** Convex hull of the cluster's core, in layout coordinates. */
  polygon: [number, number][];
  /** Where the cluster name goes: the hull's centroid. */
  centroid: [number, number];
  /** Non-generalist members shown, and how many of them form the core. */
  members: number;
  core: number;
};

const median = (vs: number[]) => {
  const s = [...vs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * One hull per cluster with at least three shown, non-generalist members. Generalists are
 * coloured by their nearest cluster but were not used to fit it, so they are left out.
 * The hull wraps the cluster's core: members within `spread` × the median distance from the
 * cluster's median position (always the closest three), so a few far-flung members do not
 * stretch it across the map. They keep their cluster colour.
 */
export function clusterHulls(points: readonly MapPoint[], spread = 2.5): ClusterHull[] {
  const groups = new Map<number, MapPoint[]>();
  for (const p of points) {
    if (p.generalist || p.cluster === null) continue;
    const g = groups.get(p.cluster) ?? [];
    g.push(p);
    groups.set(p.cluster, g);
  }
  const hulls: ClusterHull[] = [];
  for (const [cluster, members] of [...groups].sort((a, b) => a[0] - b[0])) {
    if (members.length < 3) continue;
    const cx = median(members.map((m) => m.px));
    const cy = median(members.map((m) => m.py));
    const ranked = members
      .map((m) => ({ m, d: Math.hypot(m.px - cx, m.py - cy) }))
      .sort((a, b) => a.d - b.d || a.m.id.localeCompare(b.m.id));
    const limit = spread * median(ranked.map((r) => r.d));
    const core = ranked
      .filter((r, i) => i < 3 || r.d <= limit)
      .map(({ m }): [number, number] => [m.px, m.py]);
    const polygon = polygonHull(core);
    if (!polygon || polygon.length < 3 || Math.abs(polygonArea(polygon)) < 1e-12) continue; // collinear: no area to fill
    hulls.push({
      cluster,
      polygon,
      centroid: polygonCentroid(polygon),
      members: members.length,
      core: core.length,
    });
  }
  return hulls;
}

/**
 * The thesis layout's initial view. UMAP leaves a few tight islands far from everyone else;
 * fitting them would squeeze the rest into a corner. Per axis: start from the 5th–95th
 * percentile, extend outwards while consecutive positions are closer than `gap` × that span,
 * and stop at the first wider gap. Then pad by `pad` of the span. Zooming out reaches the rest.
 */
export function robustExtent(
  rows: readonly { x: number; y: number }[],
  { core = 0.05, gap = 0.15, pad = 0.08 }: { core?: number; gap?: number; pad?: number } = {},
): { x: [number, number]; y: [number, number] } {
  if (rows.length === 0) return { x: [0, 1], y: [0, 1] };
  const span = (vs: number[]): [number, number] => {
    const s = [...vs].sort((a, b) => a - b);
    const last = s.length - 1;
    let lo = Math.round(core * last);
    let hi = Math.round((1 - core) * last);
    const width = s[hi]! - s[lo]! || 1;
    while (lo > 0 && s[lo]! - s[lo - 1]! <= gap * width) lo--;
    while (hi < last && s[hi + 1]! - s[hi]! <= gap * width) hi++;
    const d = s[hi]! - s[lo]! || 1;
    return [s[lo]! - d * pad, s[hi]! + d * pad];
  };
  return { x: span(rows.map((r) => r.x)), y: span(rows.map((r) => r.y)) };
}

/** Extent of every row's position in a layout (all rows, so marks do not jump when filters change). */
export function layoutExtent(
  rows: readonly ThesisRow[],
  layout: MapLayout,
): { x: [number, number]; y: [number, number] } {
  if (layout === "fit") return { x: [0, 1], y: [0, 1] };
  if (rows.length === 0) return { x: [0, 1], y: [0, 1] };
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const r of rows) {
    x0 = Math.min(x0, r.x);
    x1 = Math.max(x1, r.x);
    y0 = Math.min(y0, r.y);
    y1 = Math.max(y1, r.y);
  }
  return { x: [x0, x1], y: [y0, y1] };
}
