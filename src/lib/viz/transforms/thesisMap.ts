/**
 * Thesis map data (PHASE_2 S6). Rows are built once on the server from the pipeline's
 * layout_thesis (UMAP or PCA position, cluster, generalist flag) and layout_bubbles (the fit
 * view axes); the view function runs on the client whenever the URL filters change.
 */
import { polygonArea, polygonCentroid, polygonHull, polygonLength } from "d3";
import { fitScore } from "@/lib/fit/score";
import { applyFilters, type FilterableInvestor, type FilterState } from "@/lib/filters";
import { toFilterable } from "@/lib/data/directory";
import { formatCount } from "@/lib/format";
import { SECTOR_LABELS } from "@/lib/format/labels";
import type {
  BubblePoint,
  Cluster,
  Confidence,
  FitFeatures,
  Investor,
  ThesisPoint,
} from "@/lib/schema";
import { compactLayout } from "../compactLayout";
import { CONTEXT_GREY, FOCUS_HUES } from "../palette";
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
   * network): its top sector, and the second when it carries real weight, e.g.
   * "Robotics and physical AI · AI infrastructure".
   */
  label: string;
  size: number;
  color: string;
  /** Close to an industrial AI raise, so it gets a hue; the rest are grey context. */
  focus: boolean;
};

/** A second sector names a cluster only when it holds at least this share of its weight. */
export const SECOND_SECTOR_MIN = 0.15;
/** Clusters below this relevance are context (grey). */
export const FOCUS_MIN = 0.1;

/**
 * How close a cluster's thesis is to an industrial AI raise, from its top sectors: the
 * industrial affinity formula (PROJECT_CONTEXT §4: industrial and robotics in full; hardware,
 * logistics and mobility at half) plus half the AI weight, as the fit score's thesis feature.
 */
const RELEVANCE: Partial<Record<Cluster["top_sectors"][number]["sector"], number>> = {
  industrial_manufacturing: 1,
  robotics_physical_ai: 1,
  hardware_deeptech: 0.5,
  supply_chain_logistics: 0.5,
  mobility_ev: 0.5,
  ai_infra: 0.5,
  ai_apps_agents: 0.5,
};

export function clusterRelevance(cluster: Pick<Cluster, "top_sectors">): number {
  return cluster.top_sectors.reduce((sum, s) => sum + (RELEVANCE[s.sector] ?? 0) * s.weight, 0);
}

export function clusterLabel(cluster: Pick<Cluster, "top_sectors" | "name">): string {
  const [first, second] = cluster.top_sectors;
  if (!first) return cluster.name;
  const names = [first, ...(second && second.weight >= SECOND_SECTOR_MIN ? [second] : [])];
  return names.map((s) => SECTOR_LABELS[s.sector]).join(" · ");
}

/**
 * Cluster names and colours. The most relevant clusters (relevance ≥ FOCUS_MIN, then size)
 * take FOCUS_HUES in order; every other cluster is CONTEXT_GREY. Colours come from the whole
 * cluster list, never the filtered view, so a cluster keeps its colour under any filter.
 */
export function toClusterInfo(clusters: readonly Cluster[]): ClusterInfo[] {
  const ranked = [...clusters]
    .map((c) => ({ c, r: clusterRelevance(c) }))
    .filter(({ r }) => r >= FOCUS_MIN)
    .sort((a, b) => b.r - a.r || b.c.size - a.c.size || a.c.index - b.c.index)
    .slice(0, FOCUS_HUES.length);
  const hue = new Map(ranked.map(({ c }, i) => [c.index, FOCUS_HUES[i]!]));
  return [...clusters]
    .sort((a, b) => a.index - b.index)
    .map((c) => ({
      index: c.index,
      id: c.id,
      label: clusterLabel(c),
      size: c.size,
      color: hue.get(c.index) ?? CONTEXT_GREY,
      focus: hue.has(c.index),
    }));
}

/** Legend entries: each focus cluster, most relevant first, then one entry for the rest. */
export function clusterLegendItems(
  clusters: readonly ClusterInfo[],
): { label: string; color: string }[] {
  const focus = clusters
    .filter((c) => c.focus)
    .sort((a, b) => FOCUS_HUES.indexOf(a.color as never) - FOCUS_HUES.indexOf(b.color as never));
  const rest = clusters.filter((c) => !c.focus);
  return [
    ...focus.map((c) => ({ label: c.label, color: c.color })),
    ...(rest.length
      ? [
          {
            label: `Other theses (${formatCount(rest.length)}, named on the map)`,
            color: CONTEXT_GREY,
          },
        ]
      : []),
  ];
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
  // Far single-sector islands drawn closer in (compactLayout); the Directory uses the same.
  for (const p of compactLayout(layout)) {
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
/** Hull roundness (4πA / P², 1 for a circle) below which a hull is a sliver and is not drawn. */
export const MIN_ROUNDNESS = 0.15;

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
    if (!polygon || polygon.length < 3) continue;
    // Collinear, or a thin sliver between far-apart members: no shape worth filling.
    const area = Math.abs(polygonArea(polygon));
    if (area < 1e-12 || (4 * Math.PI * area) / polygonLength(polygon) ** 2 < MIN_ROUNDNESS)
      continue;
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

/** Map height follows its width: 0.62 of it, between 360px (phones) and 640px. */
export function mapHeight(width: number): number {
  return Math.round(Math.min(640, Math.max(360, width * 0.62)));
}
