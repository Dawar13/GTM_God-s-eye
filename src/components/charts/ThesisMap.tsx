"use client";

import { ZoomControls, handleZoomKey, useZoomReadout } from "@/components/ui-atlas/ZoomControls";
import { paintFind } from "@/lib/viz/paintFind";
import { paintZoom, setZoomTouchAction, ZOOM_SETTLE_MS } from "@/lib/viz/paintZoom";
import { ZOOM_STEP } from "@/lib/viz/zoom";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useEffectEvent,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import {
  easeCubicOut,
  scaleLinear,
  select,
  zoom as d3zoom,
  zoomIdentity,
  type ScaleLinear,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3";
import { useQueryState } from "nuqs";
import { ChartFrame, Legend, Segmented, VizTooltip } from "@/components/ui-atlas";
import { loadFilterIndex, useLoaded } from "@/lib/client-index";
import {
  AREA_PARAM,
  inArea,
  normalizeArea,
  parseAsArea,
  serializeArea,
  type Area,
} from "@/lib/filters/area";
import { useFilters } from "@/lib/filters/use-filters";
import { filterUrlOptions, serializeFilters } from "@/lib/filters/url";
import { formatCount, formatMonthYear, UNKNOWN } from "@/lib/format";
import { INVESTOR_TYPE_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { darken, FOCUS_HUES, markStyle, withOpacity } from "@/lib/viz";
import { placeLabels, placeNames, textSize, type Box } from "@/lib/viz/labels";
import {
  clusterHulls,
  clusterLegendItems,
  layoutExtent,
  mapHeight,
  robustExtent,
  thesisView,
  topFitIds,
  type ClusterInfo,
  type MapLayout,
  type MapPoint,
  type ThesisRow,
} from "@/lib/viz/transforms/thesisMap";
import { ChartTable } from "./ChartTable";
import { FindForMarks, NO_FIND, sameFind, type MarkFindState } from "./FindForMarks";

const R = 4.5;
const R_ACTIVE = 6.5;
const MOVE_MS = 220;
const LABEL_COUNT = 30;
const NEUTRAL = "#8A919C";
const LABEL_FONT = 11;
const CLUSTER_FONT = 12;
/** Room for the colour dot before a focus cluster's name. */
const SWATCH_SPACE = 14;
/** The first thesis view frames the focus clusters when at least this many are shown. */
const FRAME_MIN = 10;
/** Grey context marks are drawn lighter so the focus clusters stand out. */
const CONTEXT_FILL = 0.5;
const MARGIN: Record<MapLayout, { top: number; right: number; bottom: number; left: number }> = {
  thesis: { top: 12, right: 12, bottom: 12, left: 12 },
  fit: { top: 12, right: 16, bottom: 44, left: 56 },
};

type Tool = "pan" | "select";
type Plot = { x0: number; y0: number; x1: number; y1: number };
type Scales = {
  plot: Plot;
  x: ScaleLinear<number, number>;
  y: ScaleLinear<number, number>;
  /** Zooming out stops once every position fits; panning stays within them. */
  minK: number;
  world: [[number, number], [number, number]];
};
type Ghost = { x: number; y: number; point: MapPoint };
type Mark = { p: MapPoint; x: number; y: number; opacity: number };
/**
 * Lets the frame start the layout move from where the marks are now, and bring a find match
 * into view.
 */
type CanvasHandle = { beginLayoutChange: () => void; focusPoint: (id: string) => void };
const pointId = (p: MapPoint) => p.id;
const pointName = (p: MapPoint) => p.name;
/** Zoom level a find match is brought to, unless the map is already closer. */
const FIND_ZOOM = 3;

const decimal = (v: number | null) => (v === null ? UNKNOWN : v.toFixed(2));
const tick = (v: number) => String(Number(v.toFixed(2)));

/**
 * Unzoomed scales. The thesis layout keeps one unit per pixel on both axes (UMAP distances
 * are isotropic) and fits the marks shown under the current filters.
 */
function baseScales(
  rows: readonly ThesisRow[],
  layout: MapLayout,
  width: number,
  height: number,
  /** Marks of the focus clusters: the first view frames them when there are enough. */
  focus: readonly ThesisRow[] = [],
): Scales {
  const m = MARGIN[layout];
  const plot = { x0: m.left, y0: m.top, x1: width - m.right, y1: height - m.bottom };
  const pw = plot.x1 - plot.x0;
  const ph = plot.y1 - plot.y0;
  if (layout === "fit") {
    const pad = 0.04;
    return {
      plot,
      x: scaleLinear()
        .domain([-pad, 1 + pad])
        .range([plot.x0, plot.x1]),
      y: scaleLinear()
        .domain([-pad, 1 + pad])
        .range([plot.y1, plot.y0]),
      minK: 1,
      world: [
        [0, 0],
        [width, height],
      ],
    };
  }
  // The first view frames the focus clusters (the industrial and AI theses this raise is
  // after) with room for the grey context around them; with few or none shown it fits the
  // shown marks' robust extent. Everything else is a zoom-out away (minK reaches it all).
  const framed = focus.length >= FRAME_MIN;
  const ext = framed ? robustExtent(focus, { pad: 0.3 }) : robustExtent(rows);
  const dx = ext.x[1] - ext.x[0] || 1;
  const dy = ext.y[1] - ext.y[0] || 1;
  const k = Math.min(pw / (dx * 1.04), ph / (dy * 1.04));
  const cx = (ext.x[0] + ext.x[1]) / 2;
  const cy = (ext.y[0] + ext.y[1]) / 2;
  const x = scaleLinear()
    .domain([cx - pw / (2 * k), cx + pw / (2 * k)])
    .range([plot.x0, plot.x1]);
  const y = scaleLinear()
    .domain([cy - ph / (2 * k), cy + ph / (2 * k)])
    .range([plot.y1, plot.y0]);
  const full = layoutExtent(rows, layout);
  const pad = 24;
  const world: [[number, number], [number, number]] = [
    [Math.min(0, x(full.x[0]) - pad), Math.min(0, y(full.y[1]) - pad)],
    [Math.max(width, x(full.x[1]) + pad), Math.max(height, y(full.y[0]) + pad)],
  ];
  const minK = Math.min(
    1,
    width / (world[1][0] - world[0][0]),
    height / (world[1][1] - world[0][1]),
  );
  return { plot, x, y, minK, world };
}

export function ThesisMap({
  rows,
  clusters,
  computedAt,
}: {
  rows: ThesisRow[];
  clusters: ClusterInfo[];
  /** When the pipeline computed the layout (ISO date-time). */
  computedAt: string;
}) {
  const { filters } = useFilters();
  const { id: selectedId, open } = useInspector();
  const [area, setArea] = useQueryState(AREA_PARAM, parseAsArea.withOptions(filterUrlOptions));
  const [layout, setLayout] = useState<MapLayout>(() => area?.layout ?? "thesis");
  const [tool, setTool] = useState<Tool>("pan");
  const universe = useLoaded("filter-index", loadFilterIndex);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const canvas = useRef<CanvasHandle | null>(null);
  const [find, setFind] = useState<MarkFindState>(NO_FIND);

  const view = useMemo(
    () => thesisView(rows, filters, layout, universe.status === "ready" ? universe.data : null),
    [rows, filters, layout, universe],
  );
  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.index, c])), [clusters]);
  const regionActive = area !== null && area.layout === layout;
  const inRegion = useMemo(
    () =>
      regionActive && area
        ? view.points.filter((p) => inArea([p.px, p.py], area)).length
        : view.points.length,
    [regionActive, area, view.points],
  );

  const directoryHref = useMemo(() => {
    const q = [serializeFilters(filters), area ? `${AREA_PARAM}=${serializeArea(area)}` : ""]
      .filter(Boolean)
      .join("&");
    return q ? `/investors/directory?${q}` : "/investors/directory";
  }, [filters, area]);

  const subtitle =
    layout === "thesis"
      ? "Investors placed by how alike their sector weights are (UMAP): near means a similar thesis. The axes have no units, and far single-sector islands are drawn closer in. Colour marks the clusters closest to an industrial AI raise, grey the rest. Scroll or pinch to zoom, drag to pan."
      : "x = industrial affinity, y = stage earliness, both 0 to 1. The top right is the sweet spot for an early industrial raise. Colour marks the clusters closest to it.";

  const fallbackField = layout === "thesis" ? "thesis vector" : "stage earliness";
  const legendItems = [
    ...clusterLegendItems(clusters),
    { label: "Generalist (ring in its nearest cluster's colour)", color: NEUTRAL, hollow: true },
    { label: "Accelerator or incubator", color: NEUTRAL, shape: "square" as const },
  ];

  const tableRows = useMemo(
    () =>
      [...view.points].sort(
        (a, b) => (b.fit ?? -1) - (a.fit ?? -1) || a.name.localeCompare(b.name),
      ),
    [view.points],
  );

  return (
    <ChartFrame
      title="Thesis map"
      subtitle={subtitle}
      legend={<Legend kind="categorical" items={legendItems} />}
      sources={view.sources}
      filteredOut={view.filteredOut}
      notShown={view.notShown ?? [{ field: fallbackField, count: null }]}
      state={
        view.points.length === 0
          ? {
              status: "empty",
              message:
                "No investor with a position matches the current filters. Widen a filter to see the map.",
            }
          : { status: "ready" }
      }
      height={420}
      find={
        <FindForMarks
          label="Find investors"
          items={view.points}
          getId={pointId}
          toSearchable={pointName}
          onFocus={(id) => canvas.current?.focusPoint(id)}
          onOpen={open}
          onChange={(next) => setFind((prev) => sameFind(prev, next))}
        />
      }
      tableAlternative={
        <ChartTable
          caption={`Thesis map, ${layout === "thesis" ? "thesis layout" : "fit view"}`}
          rows={tableRows}
          rowKey={(p) => p.id}
          columns={[
            {
              header: "Investor",
              cell: (p) => (
                <button
                  type="button"
                  className="text-left text-accent hover:underline"
                  onClick={() => open(p.id)}
                >
                  {p.name}
                </button>
              ),
            },
            {
              header: "Cluster",
              cell: (p) =>
                p.cluster === null
                  ? UNKNOWN
                  : `${clusterById.get(p.cluster)?.label ?? p.cluster}${p.generalist ? " (generalist)" : ""}`,
            },
            { header: "Type", cell: (p) => (p.type ? INVESTOR_TYPE_LABELS[p.type] : UNKNOWN) },
            { header: "Industrial affinity", numeric: true, cell: (p) => decimal(p.affinity) },
            { header: "Stage earliness", numeric: true, cell: (p) => decimal(p.earliness) },
            {
              header: "Fit",
              numeric: true,
              cell: (p) =>
                p.fit === null ? UNKNOWN : `${p.fit.toFixed(1)}${p.sparse ? " (sparse)" : ""}`,
            },
          ]}
        />
      }
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented
            label="Map layout"
            value={layout}
            onChange={(next) => {
              if (next === layout) return;
              canvas.current?.beginLayoutChange();
              void setArea(null); // a region belongs to the layout it was drawn on
              setLayout(next);
            }}
            options={[
              { value: "thesis", label: "Thesis layout" },
              { value: "fit", label: "Fit view" },
            ]}
          />
          <Segmented
            label="Map tool"
            value={tool}
            onChange={setTool}
            options={[
              { value: "pan", label: "Pan and zoom" },
              { value: "select", label: "Select region" },
            ]}
          />
        </div>
      }
    >
      <div className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
        {regionActive ? (
          <>
            <span>
              <span className="tabular-nums">{formatCount(inRegion)}</span> of{" "}
              <span className="tabular-nums">{formatCount(view.points.length)}</span> investors on
              the map are in the selected region.
            </span>
            <Link href={directoryHref} className="text-accent hover:underline">
              Open in Directory
            </Link>
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => void setArea(null)}
            >
              Clear region
            </button>
          </>
        ) : (
          <span>
            {tool === "select"
              ? "Drag across the map to select a region, then open it in the Directory."
              : `Labels show the top ${LABEL_COUNT} by fit score (sparse scores left out) and the hovered or selected investor.`}
          </span>
        )}
      </div>
      <MapCanvas
        ref={canvas}
        points={view.points}
        layout={layout}
        tool={tool}
        clusterById={clusterById}
        selectedId={selectedId}
        onOpen={open}
        area={regionActive ? area : null}
        onArea={(a) => void setArea(a)}
        reduced={reduced}
        computedAt={computedAt}
        found={find.found}
        findActiveId={find.activeId}
      />
    </ChartFrame>
  );
}

function MapCanvas({
  ref,
  points,
  layout,
  tool,
  clusterById,
  selectedId,
  onOpen,
  area,
  onArea,
  reduced,
  computedAt,
  found,
  findActiveId,
}: {
  ref: Ref<CanvasHandle>;
  points: MapPoint[];
  layout: MapLayout;
  tool: Tool;
  clusterById: Map<number, ClusterInfo>;
  selectedId: string | null;
  onOpen: (id: string) => void;
  area: Area | null;
  onArea: (area: Area) => void;
  reduced: boolean;
  computedAt: string;
  /** Find matches (null: no query); the rest fade, painted without a render. */
  found: ReadonlySet<string> | null;
  /** The active find match: labelled and glowing. */
  findActiveId: string | null;
}) {
  const clipId = useId();
  const [width, setWidth] = useState(0);
  // Height follows the width, so a phone gets a shorter map instead of a tall thin strip.
  const height = width > 0 ? mapHeight(width) : 520;
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Plot | null>(null);
  const [anim, setAnim] = useState<{ from: Map<string, Ghost>; start: number } | null>(null);
  const [now, setNow] = useState(0);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const toolRef = useRef<Tool>(tool);
  const shownRef = useRef<Mark[]>([]);
  const readout = useZoomReadout();

  // While a zoom is under way React stays out: `transform` is the view last rendered, and
  // paintZoom moves marks, labels and shapes from it to the live view (transformRef) once per
  // frame. The map renders again, with labels, collisions, counts and hover, once the zoom has
  // been idle for ZOOM_SETTLE_MS.
  const zooming = useRef(false);
  const settle = useRef(0);
  const frame = useRef(0);
  const paintLive = useEffectEvent(() => {
    frame.current = 0;
    if (!svgEl) return;
    paintZoom(svgEl, transform, transformRef.current);
    setZoomTouchAction(svgEl, transformRef.current.k);
  });
  const onZoom = useEffectEvent((t: ZoomTransform) => {
    transformRef.current = t;
    readout.set(t.k);
    if (!zooming.current) {
      zooming.current = true;
      setHoverId(null);
    }
    if (!frame.current) frame.current = requestAnimationFrame(() => paintLive());
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      zooming.current = false;
      setTransform(transformRef.current);
    }, ZOOM_SETTLE_MS);
  });
  // Every render lays marks out at `transform`; carry on from there to the live view.
  useLayoutEffect(() => {
    if (svgEl) paintZoom(svgEl, transform, transformRef.current);
  });
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(settle.current);
    },
    [],
  );
  // Find: new marks start unpainted, so paint after every render while a query is active.
  const findPainted = useRef(false);
  useLayoutEffect(() => {
    if (!found && !findPainted.current) return;
    findPainted.current = found !== null;
    paintFind(svgEl, found, findActiveId);
  });

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // Width follows the panel. A callback ref, because the table view unmounts this element.
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // d3-zoom owns wheel and drag; marks are re-projected through the zoomed scales, so mark,
  // stroke and label sizes stay constant at every zoom level.
  // Fitted to the shown marks, so a filtered subset fills the view instead of a corner of it.
  const focusPoints = useMemo(
    () =>
      layout === "thesis"
        ? points.filter(
            (p) => !p.generalist && p.cluster !== null && clusterById.get(p.cluster)?.focus,
          )
        : [],
    [points, layout, clusterById],
  );
  const base = useMemo(
    () => (width > 0 ? baseScales(points, layout, width, height, focusPoints) : null),
    [points, layout, width, height, focusPoints],
  );
  const minK = base?.minK ?? 1;
  const world = base?.world;
  useEffect(() => {
    if (!svgEl || width === 0 || !world) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([minK, 20])
      .extent([
        [0, 0],
        [width, height],
      ])
      .translateExtent(world)
      .filter((event: Event) => {
        if (event.type === "wheel" || event.type === "dblclick") return true;
        if (toolRef.current === "select") return false;
        const e = event as MouseEvent;
        return !e.ctrlKey && !e.button;
      })
      .on("zoom", (e: { transform: ZoomTransform }) => onZoom(e.transform));
    zoomRef.current = z;
    const sel = select(svgEl);
    sel.call(z);
    z.transform(sel, transformRef.current);
    return () => {
      sel.on(".zoom", null);
    };
  }, [svgEl, width, height, minK, world]);

  // A layout switch (called in the same event as the parent's setLayout, so one render
  // follows): reset the zoom and move every shared mark from where it is now (220ms).
  useImperativeHandle(
    ref,
    () => ({
      focusPoint: (id: string) => {
        const p = points.find((q) => q.id === id);
        const z = zoomRef.current;
        if (!p || !base || !z || !svgEl) return;
        const k = Math.max(transformRef.current.k, FIND_ZOOM);
        const t = zoomIdentity
          .translate(width / 2 - k * base.x(p.px), height / 2 - k * base.y(p.py))
          .scale(k);
        const sel = select(svgEl);
        z.transform((reduced ? sel : sel.transition().duration(300)) as typeof sel, t);
      },
      beginLayoutChange: () => {
        setHoverId(null);
        if (!reduced) {
          const from = new Map(
            shownRef.current.map((m) => [m.p.id, { x: m.x, y: m.y, point: m.p }]),
          );
          setNow(0);
          setAnim({ from, start: -1 });
        }
        transformRef.current = zoomIdentity;
        setTransform(zoomIdentity);
        if (svgEl && zoomRef.current) zoomRef.current.transform(select(svgEl), zoomIdentity);
      },
    }),
    [reduced, svgEl, points, base, width, height],
  );
  useEffect(() => {
    if (!anim) return;
    let raf = 0;
    let start = anim.start;
    const step = (t: number) => {
      if (start < 0) start = t;
      if (t - start >= MOVE_MS) {
        setAnim(null);
        return;
      }
      setNow((t - start) / MOVE_MS);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [anim]);
  const progress = anim ? easeCubicOut(Math.min(1, Math.max(0, now))) : 1;

  const hulls = useMemo(() => (layout === "thesis" ? clusterHulls(points) : []), [layout, points]);
  const labelIds = useMemo(() => topFitIds(points, LABEL_COUNT), [points]);

  const zx = base ? transform.rescaleX(base.x) : null;
  const zy = base ? transform.rescaleY(base.y) : null;

  const marks: Mark[] = [];
  if (zx && zy) {
    const ids = new Set<string>();
    for (const p of points) {
      ids.add(p.id);
      const x = zx(p.px);
      const y = zy(p.py);
      const f = anim?.from.get(p.id);
      if (anim && f) {
        marks.push({ p, x: f.x + (x - f.x) * progress, y: f.y + (y - f.y) * progress, opacity: 1 });
      } else marks.push({ p, x, y, opacity: anim ? progress : 1 });
    }
    if (anim) {
      for (const [id, f] of anim.from) {
        if (!ids.has(id)) marks.push({ p: f.point, x: f.x, y: f.y, opacity: 1 - progress });
      }
    }
  }
  useEffect(() => {
    shownRef.current = marks;
  });

  if (!base || !zx || !zy) return <div ref={measureRef} style={{ height: height }} />;
  const { plot } = base;
  const pw = plot.x1 - plot.x0;
  const ph = plot.y1 - plot.y0;
  const settled = anim === null;
  const isFocus = (p: MapPoint) =>
    (p.cluster !== null && clusterById.get(p.cluster)?.focus) === true;

  // Cluster names at hull centroids, in ink (colour stays on the marks); a focus cluster's
  // name carries its colour as a dot. Focus names go first, most relevant first, then larger
  // clusters; a name steps a line up or down to clear one already placed, else it is dropped.
  const clusterLabels: { cluster: ClusterInfo; x: number; y: number; w: number; box: Box }[] = [];
  if (settled) {
    const rank = (c: ClusterInfo) =>
      c.focus ? FOCUS_HUES.indexOf(c.color as (typeof FOCUS_HUES)[number]) : FOCUS_HUES.length;
    const ordered = hulls
      .map((h) => ({ h, c: clusterById.get(h.cluster) }))
      .filter((e): e is { h: (typeof hulls)[number]; c: ClusterInfo } => e.c !== undefined)
      .sort((a, b) => rank(a.c) - rank(b.c) || b.h.members - a.h.members);
    const byIndex = new Map(ordered.map(({ c }) => [String(c.index), c]));
    const widths = new Map<string, number>();
    const names = placeNames(
      ordered.map(({ h, c }) => {
        const text = textSize(c.label, CLUSTER_FONT, 0.55);
        const w = text.w + (c.focus ? SWATCH_SPACE : 0);
        widths.set(String(c.index), w);
        return {
          id: String(c.index),
          x: zx(h.centroid[0]) - plot.x0,
          y: zy(h.centroid[1]) - plot.y0,
          w,
          h: text.h,
        };
      }),
      { width: pw, height: ph },
    );
    for (const n of names) {
      clusterLabels.push({
        cluster: byIndex.get(n.id)!,
        x: n.x + plot.x0,
        y: n.y + plot.y0,
        w: widths.get(n.id)!,
        box: n.box,
      });
    }
  }

  const markById = new Map(marks.map((m) => [m.p.id, m]));
  const labels = settled
    ? placeLabels(
        [
          ...[findActiveId, selectedId, hoverId].flatMap((id) => {
            const m = id ? markById.get(id) : undefined;
            return m
              ? [
                  {
                    id: m.p.id,
                    text: m.p.name,
                    x: m.x - plot.x0,
                    y: m.y - plot.y0,
                    r: R_ACTIVE,
                    force: true,
                  },
                ]
              : [];
          }),
          ...labelIds.flatMap((id) => {
            const m = markById.get(id);
            return m ? [{ id, text: m.p.name, x: m.x - plot.x0, y: m.y - plot.y0, r: R }] : [];
          }),
        ],
        {
          width: pw,
          height: ph,
          fontSize: LABEL_FONT,
          // Names stay off cluster names and off the other labelled dots.
          obstacles: [
            ...clusterLabels.map((l) => l.box),
            ...labelIds.flatMap((id) => {
              const m = markById.get(id);
              if (!m) return [];
              const x = m.x - plot.x0;
              const y = m.y - plot.y0;
              return [{ x0: x - R, y0: y - R, x1: x + R, y1: y + R }];
            }),
          ],
        },
      )
    : [];

  const hovered = hoverId && !drag ? markById.get(hoverId) : undefined;
  const outside = settled
    ? marks.filter((m) => m.x < plot.x0 || m.x > plot.x1 || m.y < plot.y0 || m.y > plot.y1).length
    : 0;

  const idFrom = (target: EventTarget) =>
    (target as Element).closest?.("[data-id]")?.getAttribute("data-id") ?? null;

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (tool !== "select" || e.button !== 0 || !svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const clampX = (v: number) => Math.min(plot.x1, Math.max(plot.x0, v - rect.left));
    const clampY = (v: number) => Math.min(plot.y1, Math.max(plot.y0, v - rect.top));
    const x0 = clampX(e.clientX);
    const y0 = clampY(e.clientY);
    setDrag({ x0, y0, x1: x0, y1: y0 });
    const move = (ev: PointerEvent) =>
      setDrag({ x0, y0, x1: clampX(ev.clientX), y1: clampY(ev.clientY) });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      const x1 = clampX(ev.clientX);
      const y1 = clampY(ev.clientY);
      if (Math.abs(x1 - x0) < 4 || Math.abs(y1 - y0) < 4) return; // a click, not a brush
      onArea(
        normalizeArea({
          layout,
          x0: zx.invert(x0),
          x1: zx.invert(x1),
          y0: zy.invert(y0),
          y1: zy.invert(y1),
        }),
      );
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const zoomBy = (dir: 1 | -1) => {
    const z = zoomRef.current;
    if (!z || !svgEl) return;
    const sel = select(svgEl);
    const factor = dir === 1 ? ZOOM_STEP : 1 / ZOOM_STEP;
    // Scale around the centre of the view.
    const target = reduced ? sel : sel.transition().duration(160);
    z.scaleBy(target as typeof sel, factor, [width / 2, height / 2]);
  };
  const resetZoom = () => {
    const z = zoomRef.current;
    if (!z || !svgEl) return;
    const sel = select(svgEl);
    const target = reduced ? sel : sel.transition().duration(160);
    z.transform(target as typeof sel, zoomIdentity);
  };
  const zoomHandlers = {
    onZoomIn: () => zoomBy(1),
    onZoomOut: () => zoomBy(-1),
    onReset: resetZoom,
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    handleZoomKey(e, zoomHandlers);
  };

  const fitTicks = layout === "fit" ? [0, 0.25, 0.5, 0.75, 1] : [];
  const tooltipLeft = hovered
    ? hovered.x + 16 + 256 > width
      ? hovered.x - 16 - 256
      : hovered.x + 16
    : 0;
  const tooltipTop = hovered ? Math.min(hovered.y + 12, height - 190) : 0;

  return (
    <div ref={measureRef} className="relative" style={{ height: height }}>
      <svg
        ref={setSvgEl}
        width={width}
        height={height}
        tabIndex={0}
        role="group"
        aria-roledescription="map"
        aria-label={`Thesis map, ${layout === "thesis" ? "thesis layout" : "fit view"}: ${formatCount(points.length)} investors. Plus and minus zoom, 0 resets; the table view lists every investor.`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        style={{ touchAction: transform.k > 1 ? "none" : "pan-y" }}
        className={`block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent ${tool === "select" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={plot.x0} y={plot.y0} width={pw} height={ph} />
          </clipPath>
        </defs>

        {layout === "fit" && (
          <g aria-hidden>
            <g clipPath={`url(#${clipId})`}>
              <rect
                data-zaffine
                x={zx(0.5)}
                y={zy(1)}
                width={Math.max(0, zx(1) - zx(0.5))}
                height={Math.max(0, zy(0.5) - zy(1))}
                fill="var(--accent-soft)"
                opacity={0.7}
              />
              <line
                data-zx={zx(0.5)}
                x1={zx(0.5)}
                x2={zx(0.5)}
                y1={plot.y0}
                y2={plot.y1}
                stroke="var(--rule)"
                strokeDasharray="4 4"
              />
              <line
                data-zy={zy(0.5)}
                x1={plot.x0}
                x2={plot.x1}
                y1={zy(0.5)}
                y2={zy(0.5)}
                stroke="var(--rule)"
                strokeDasharray="4 4"
              />
              <text
                data-zx={zx(1)}
                data-zy={zy(1)}
                x={zx(1) - 8}
                y={zy(1) + 18}
                textAnchor="end"
                fontSize={12}
                fontWeight={500}
                fill="var(--accent)"
              >
                Sweet spot
              </text>
            </g>
            <line x1={plot.x0} x2={plot.x1} y1={plot.y1} y2={plot.y1} stroke="var(--rule)" />
            <line x1={plot.x0} x2={plot.x0} y1={plot.y0} y2={plot.y1} stroke="var(--rule)" />
            {fitTicks.map((t) => {
              const x = zx(t);
              const y = zy(t);
              return (
                <g
                  key={t}
                  className="font-condensed tabular-nums"
                  fontSize={12}
                  fill="var(--muted)"
                >
                  {x >= plot.x0 && x <= plot.x1 && (
                    <text data-zx={x} x={x} y={plot.y1 + 16} textAnchor="middle">
                      {tick(t)}
                    </text>
                  )}
                  {y >= plot.y0 && y <= plot.y1 && (
                    <text data-zy={y} x={plot.x0 - 8} y={y + 4} textAnchor="end">
                      {tick(t)}
                    </text>
                  )}
                </g>
              );
            })}
            <text
              x={(plot.x0 + plot.x1) / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize={12}
              fill="var(--ink-2)"
            >
              Industrial affinity (0–1, share of thesis weight)
            </text>
            <text
              transform={`translate(14 ${(plot.y0 + plot.y1) / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={12}
              fill="var(--ink-2)"
            >
              Stage earliness (0–1, 1 = pre-seed only)
            </text>
          </g>
        )}

        <g clipPath={`url(#${clipId})`}>
          {/* Outlines for the focus clusters only; grey context clusters are just named. */}
          {settled &&
            hulls.map((h) => {
              const c = clusterById.get(h.cluster);
              if (!c?.focus) return null;
              const d = `M${h.polygon.map(([x, y]) => `${zx(x)},${zy(y)}`).join("L")}Z`;
              return (
                <path
                  key={h.cluster}
                  data-zaffine
                  d={d}
                  fill={c.color}
                  fillOpacity={0.06}
                  stroke={c.color}
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  aria-hidden
                />
              );
            })}

          {area && (
            <rect
              data-zaffine
              x={zx(area.x0)}
              y={zy(area.y1)}
              width={Math.max(0, zx(area.x1) - zx(area.x0))}
              height={Math.max(0, zy(area.y0) - zy(area.y1))}
              fill="var(--accent-soft)"
              fillOpacity={0.5}
              stroke="var(--accent)"
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              aria-hidden
            />
          )}

          <g
            onPointerOver={(e) => {
              if (!drag && !zooming.current) setHoverId(idFrom(e.target));
            }}
            onPointerOut={() => setHoverId(null)}
            onClick={(e) => {
              const id = idFrom(e.target);
              if (id) onOpen(id);
            }}
          >
            {/* Grey context first, so focus marks sit on top where clusters overlap. */}
            {[...marks]
              .sort((a, b) => Number(isFocus(a.p)) - Number(isFocus(b.p)))
              .map(({ p, x, y, opacity }) => {
                const info = p.cluster === null ? undefined : clusterById.get(p.cluster);
                const color = info?.color ?? NEUTRAL;
                const focus = info?.focus ?? false;
                const style = markStyle(color);
                const active = p.id === hoverId || p.id === selectedId || p.id === findActiveId;
                const r = active ? R_ACTIVE : R;
                const dim = area !== null && !inArea([p.px, p.py], area);
                const common = {
                  fill: p.generalist
                    ? "none"
                    : focus
                      ? style.fill
                      : withOpacity(color, CONTEXT_FILL),
                  stroke: p.generalist ? darken(color, 0.1) : style.stroke,
                  strokeWidth: p.generalist ? 1.5 : 1,
                  pointerEvents: "all" as const,
                };
                return (
                  <g
                    key={p.id}
                    data-id={p.id}
                    data-find-id={p.id}
                    data-zx={x}
                    data-zy={y}
                    opacity={opacity * (dim ? 0.2 : 1)}
                    className="mark-glow cursor-pointer"
                    data-glow={active ? "on" : "off"}
                    style={{ "--glow": color } as CSSProperties}
                  >
                    {p.id === selectedId && (
                      <circle
                        cx={x}
                        cy={y}
                        r={r + 3}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth={2}
                      />
                    )}
                    {p.marker === "square" ? (
                      <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...common} />
                    ) : (
                      <circle cx={x} cy={y} r={r} {...common} />
                    )}
                  </g>
                );
              })}
          </g>
        </g>

        <g pointerEvents="none" className="font-condensed">
          {clusterLabels.map((l) => {
            const left = l.x - l.w / 2;
            return (
              <g key={l.cluster.index} data-zx={l.x} data-zy={l.y}>
                {l.cluster.focus && (
                  <circle
                    cx={left + 5}
                    cy={l.y}
                    r={5}
                    fill={l.cluster.color}
                    stroke="var(--panel)"
                    strokeWidth={1.5}
                  />
                )}
                <text
                  x={l.cluster.focus ? left + SWATCH_SPACE : l.x}
                  y={l.y + CLUSTER_FONT * 0.35}
                  textAnchor={l.cluster.focus ? "start" : "middle"}
                  fontSize={CLUSTER_FONT}
                  fontWeight={l.cluster.focus ? 600 : 500}
                  fill={l.cluster.focus ? "var(--ink)" : "var(--ink-2)"}
                  stroke="var(--panel)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {l.cluster.label}
                </text>
              </g>
            );
          })}
          {labels.map((l) => (
            <text
              key={l.id}
              data-find-id={l.id}
              data-zx={markById.get(l.id)?.x ?? l.x + plot.x0}
              data-zy={markById.get(l.id)?.y ?? l.y + plot.y0}
              x={l.x + plot.x0}
              y={l.y + plot.y0}
              textAnchor={l.anchor}
              fontSize={LABEL_FONT}
              fill="var(--ink)"
              stroke="var(--panel)"
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {l.text}
            </text>
          ))}
        </g>

        {drag && (
          <rect
            x={Math.min(drag.x0, drag.x1)}
            y={Math.min(drag.y0, drag.y1)}
            width={Math.abs(drag.x1 - drag.x0)}
            height={Math.abs(drag.y1 - drag.y0)}
            fill="var(--accent-soft)"
            fillOpacity={0.4}
            stroke="var(--accent)"
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}
      </svg>

      <ZoomControls
        readout={readout}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onReset={resetZoom}
        className="absolute right-2 bottom-2"
      />

      {outside > 0 && (
        <p className="pointer-events-none absolute bottom-1 left-3 rounded-md bg-panel/80 px-1 text-xs text-ink-2">
          <span className="tabular-nums">{formatCount(outside)}</span> outside this view. Scroll out
          or press minus to see them.
        </p>
      )}

      {hovered && (
        <div
          className="pointer-events-none absolute z-10"
          style={{ left: tooltipLeft, top: tooltipTop }}
        >
          <MapTooltip
            p={hovered.p}
            cluster={hovered.p.cluster === null ? undefined : clusterById.get(hovered.p.cluster)}
            computedAt={computedAt}
          />
        </div>
      )}
    </div>
  );
}

function MapTooltip({
  p,
  cluster,
  computedAt,
}: {
  p: MapPoint;
  cluster: ClusterInfo | undefined;
  computedAt: string;
}) {
  return (
    <VizTooltip
      title={p.name}
      value={p.fit === null ? "Fit score unknown" : `Fit ${p.fit.toFixed(1)} of 100`}
      period={`Layout computed ${formatMonthYear(computedAt)}`}
      confidence={p.confidence}
      sourceDomain={p.sourceDomain}
    >
      <p>
        {cluster ? cluster.label : "No cluster"}
        {p.generalist ? " (generalist: coloured by nearest cluster)" : ""}
      </p>
      <p className="tabular-nums">
        Industrial affinity {decimal(p.affinity)} · stage earliness {decimal(p.earliness)}
      </p>
      {p.type && <p>{INVESTOR_TYPE_LABELS[p.type]}</p>}
      {p.sparse && <p>Sparse data: fit score not ranked</p>}
    </VizTooltip>
  );
}
