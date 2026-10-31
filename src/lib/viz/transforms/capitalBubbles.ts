/**
 * Capital bubbles data (PHASE_2 S6): x = typical check (log), y = stage earliness,
 * z = industrial affinity, size = latest fund size by area, colour = cluster. Positions and
 * colour come from the pipeline's layout_bubbles; the size is the Directory's latest fund
 * (`latestFund`), so a bubble and its Directory row always name the same fund. Rows are built
 * on the server, the view runs on the client whenever the URL filters change.
 */
import { applyFilters, type FilterableInvestor, type FilterState } from "@/lib/filters";
import { latestFund, toFilterable } from "@/lib/data/directory";
import { formatPartialDate } from "@/lib/format";
import type { BubblePoint, Confidence, Fund, Investor } from "@/lib/schema";
import { markerShapeFor, type MarkerShape } from "../markers";
import { provenanceOf } from "./common";
import type { NotShownCount } from "./thesisMap";

/** Axis fields in axis order; an investor missing several is counted under the first. */
export const BUBBLE_FIELDS = ["typical check", "stage earliness", "industrial affinity"] as const;
export type BubbleField = (typeof BUBBLE_FIELDS)[number];

export type BubbleRow = FilterableInvestor & {
  name: string;
  /** Typical check: geometric mean of check min and max (or the one bound known). */
  check: number;
  checkMin: number | null;
  checkMax: number | null;
  earliness: number;
  affinity: number;
  /** Latest fund size; null draws a fixed-size ring, never a zero-size bubble. */
  fundUsd: number | null;
  /** Close date or vintage of the fund behind `fundUsd`, when it can be identified. */
  fundPeriod: string | null;
  cluster: number | null;
  marker: MarkerShape;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type BubbleData = {
  /** Investors with all three axes known. */
  rows: BubbleRow[];
  /** First missing axis, for investors in layout_bubbles that lack one. Absent ids lack all three. */
  missing: Record<string, BubbleField>;
  /** Largest latest fund among `rows` (unfiltered), so bubble sizes do not change with filters. */
  maxFundUsd: number | null;
  /** Typical check range among `rows`, for a stable log axis. */
  checkExtent: [number, number] | null;
};

const clusterIndex = (key: string | null) => {
  const m = key ? /^cl_(\d+)$/.exec(key) : null;
  return m ? Number(m[1]) : null;
};

export function toBubbleData(
  investors: readonly Investor[],
  bubbles: readonly BubblePoint[],
  funds: readonly Fund[],
): BubbleData {
  const byId = new Map(investors.map((i) => [i.id, i]));
  const fundsBy = new Map<string, Fund[]>();
  for (const f of funds) {
    const list = fundsBy.get(f.investor_id) ?? [];
    list.push(f);
    fundsBy.set(f.investor_id, list);
  }
  const rows: BubbleRow[] = [];
  const missing: Record<string, BubbleField> = {};
  for (const b of bubbles) {
    const inv = byId.get(b.id);
    if (!inv) continue;
    const values = [b.typical_check_usd, b.stage_earliness, b.industrial_affinity];
    const gap = values.findIndex((v) => v === null);
    if (gap >= 0) {
      missing[b.id] = BUBBLE_FIELDS[gap]!;
      continue;
    }
    const latest = latestFund(fundsBy.get(b.id) ?? []);
    const fundUsd = latest?.size_usd ?? null;
    rows.push({
      ...toFilterable(inv),
      name: inv.name,
      check: b.typical_check_usd!,
      checkMin: inv.check_min_usd,
      checkMax: inv.check_max_usd,
      earliness: b.stage_earliness!,
      affinity: b.industrial_affinity!,
      fundUsd,
      fundPeriod:
        latest && fundUsd !== null
          ? latest.close_date
            ? formatPartialDate(latest.close_date)
            : String(latest.vintage_year)
          : null,
      cluster: clusterIndex(b.colour_key),
      marker: markerShapeFor(inv.type),
      ...provenanceOf([inv]),
    });
  }
  const sizes = rows.map((r) => r.fundUsd).filter((v): v is number => v !== null && v > 0);
  const checks = rows.map((r) => r.check).filter((v) => v > 0);
  return {
    rows,
    missing,
    maxFundUsd: sizes.length ? Math.max(...sizes) : null,
    checkExtent: checks.length ? [Math.min(...checks), Math.max(...checks)] : null,
  };
}

export type BubbleView = {
  points: BubbleRow[];
  /** Investors with all three axes that the URL filters hide. */
  filteredOut: number;
  /** Investors the Directory lists for these filters that lack an axis; null until known. */
  notShown: NotShownCount[] | null;
  /** Shown points with no fund size (fixed-size rings). */
  unsized: number;
  sources: string[];
};

export function bubbleView(
  data: BubbleData,
  filters: FilterState,
  universe?: readonly FilterableInvestor[] | null,
): BubbleView {
  const points = applyFilters(data.rows, filters);
  let notShown: NotShownCount[] | null = null;
  if (universe) {
    const shown = new Set(points.map((p) => p.id));
    const counts = new Map<BubbleField, number>();
    for (const u of applyFilters(universe, filters)) {
      if (shown.has(u.id)) continue;
      const field = data.missing[u.id] ?? BUBBLE_FIELDS[0];
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
    notShown = BUBBLE_FIELDS.filter((f) => counts.has(f)).map((field) => ({
      field,
      count: counts.get(field)!,
    }));
    if (notShown.length === 0) notShown = [{ field: BUBBLE_FIELDS[0], count: 0 }];
  }
  const domains = new Map<string, number>();
  for (const p of points) {
    const d = p.sourceDomain?.split(" +")[0];
    if (d) domains.set(d, (domains.get(d) ?? 0) + 1);
  }
  const ranked = [...domains].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sources = ranked.slice(0, 4).map(([d]) => d);
  if (ranked.length > 4) sources.push(`${ranked.length - 4} more domains`);
  return {
    points,
    filteredOut: data.rows.length - points.length,
    notShown,
    unsized: points.filter((p) => p.fundUsd === null).length,
    sources,
  };
}

/* ------------------------------------------------------------------ sizing */

export const BUBBLE_MAX_DIAMETER = 44;
export const BUBBLE_MIN_DIAMETER = 4;
/** Ring drawn for a fund of unknown size; not to scale. */
export const UNSIZED_DIAMETER = 8;

/**
 * Plotly's gl3d renderer draws a scatter3d glyph at about 1.75 × its marker size in CSS
 * pixels. Measured in headless Chromium: size 20 draws at 35px, size 40 at 70px. The renderer
 * always uses `plotGlPixelRatio` (default 2, set explicitly in Bubbles3D) and ignores the
 * device pixel ratio, so the factor is the same on every screen.
 */
export const GL_PX_PER_SIZE = 1.75;
/** Internally a size s becomes 4s glyph units, so one glyph unit is this many pixels. */
const GL_PX_PER_UNIT = GL_PX_PER_SIZE / 4;

/** The scalar Plotly 3D marker size that draws at `px` CSS pixels. */
export function glMarkerSize(px: number): number {
  return px / GL_PX_PER_SIZE;
}

export type BubbleSizing = {
  maxValue: number;
  maxDiameter: number;
  minDiameter: number;
  /** Values below this are drawn at the minimum diameter (stated in the legend). */
  floorValue: number;
  /**
   * Plotly scatter3d with sizemode "area" draws a size-array value v at
   * max(√(2v / sizeref), sizemin) glyph units. Setting sizeref = 2 · max · (u / D)², with u
   * the pixels per glyph unit, draws the largest fund at D pixels; sizemin = d / u floors the
   * smallest at d pixels. The 2D projections then use the same diameters.
   */
  plotly: { sizeref: number; sizemin: number; sizemode: "area" };
};

export function bubbleSizing(
  maxValue: number | null,
  maxDiameter = BUBBLE_MAX_DIAMETER,
  minDiameter = BUBBLE_MIN_DIAMETER,
): BubbleSizing | null {
  if (maxValue === null || !(maxValue > 0)) return null;
  return {
    maxValue,
    maxDiameter,
    minDiameter,
    floorValue: maxValue * (minDiameter / maxDiameter) ** 2,
    plotly: {
      sizeref: 2 * maxValue * (GL_PX_PER_UNIT / maxDiameter) ** 2,
      sizemin: minDiameter / GL_PX_PER_UNIT,
      sizemode: "area",
    },
  };
}

/** Diameter in pixels: area proportional to the value (radius = k·√value), floored at the minimum. */
export function bubbleDiameter(value: number | null, s: BubbleSizing): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return Math.max(s.minDiameter, s.maxDiameter * Math.sqrt(value / s.maxValue));
}

/**
 * The pixel diameter Plotly draws for `value` with these settings: its bubble size function
 * (makeBubbleSizeFn: √((4v / 2) / sizeref), at least sizemin) times pixels per glyph unit.
 */
export function plotlyDiameter(value: number, s: BubbleSizing): number {
  const { sizeref, sizemin } = s.plotly;
  return Math.max(Math.sqrt((4 * value) / 2 / sizeref), sizemin) * GL_PX_PER_UNIT;
}

/** Round sample values for the size legend: powers of ten up to the largest fund. */
export function sizeSamples(maxValue: number): number[] {
  const out: number[] = [];
  for (let v = 1e7; v <= maxValue; v *= 10) out.push(v);
  return out.slice(-3);
}

/** Log-axis ticks (1, 3, 10, 30 … pattern) inside a USD domain. */
export function logTicks([lo, hi]: [number, number]): number[] {
  const out: number[] = [];
  for (let p = Math.floor(Math.log10(lo)); p <= Math.ceil(Math.log10(hi)); p++) {
    for (const m of [1, 3]) {
      const v = m * 10 ** p;
      if (v >= lo && v <= hi) out.push(v);
    }
  }
  return out;
}

/** Padded log domain for the check axis (half a step each side). */
export function checkDomain(extent: [number, number] | null): [number, number] {
  if (!extent) return [1e5, 1e7];
  return [extent[0] / 1.6, extent[1] * 1.6];
}
