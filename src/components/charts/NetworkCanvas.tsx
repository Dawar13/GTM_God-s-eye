"use client";

/**
 * The Sigma (WebGL) half of the Network view. The only module that imports sigma, graphology
 * and @react-sigma/core; NetworkGraph loads it with next/dynamic (ssr: false), so none of them
 * reach another route's bundle.
 *
 * The graphology graph is built once per payload, in slices that yield to the browser, while a
 * skeleton holds the canvas's place; Sigma is created once it is complete. Filters, modes,
 * colours and highlights never touch it: they live in refs that Sigma's node and edge reducers
 * read, and a change calls `sigma.scheduleRefresh()`.
 */
import Graph from "graphology";
import { SigmaContainer, useRegisterEvents, useSigma } from "@react-sigma/core";
import type Sigma from "sigma";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { sdfCircle, sdfSquare } from "sigma/rendering";
import type { Settings } from "sigma/settings";
import type { EdgeDisplayData, NodeDisplayData, SigmaOptions, WheelCoords } from "sigma/types";
import { Skeleton } from "@/components/ui-atlas";
import type { ThemeColors } from "@/lib/hooks/useThemeColors";
import { LABEL_LEVELS } from "@/lib/network/url";
import { yieldToMain } from "@/lib/scheduling";
import { wheelZoomFactor } from "@/lib/viz/zoom";
import {
  neighbourhood,
  nodeRadius,
  squareHalfSide,
  viewBounds,
  type GraphData,
  type NetworkView,
} from "@/lib/viz/transforms/networkGraph";

export type CanvasHandle = {
  /** Centre the camera on a node (instant under reduced motion). */
  focus: (i: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Re-run the reducers once, next frame (after the find state changed). */
  refresh: () => void;
};

/**
 * Find-box matches, shared by reference with NetworkGraph's find box: it writes here and calls
 * `refresh`, so a query never re-renders this component. Matches stay lit, the rest fade; the
 * active match keeps its label.
 */
export type CanvasFind = { found: ReadonlySet<number>; active: number | null };

/** Up to this many matches all show their labels; beyond it only the active one does. */
const FIND_LABELS_MAX = 12;

const EDGE_ALPHA = 0.15;
const FADED = 0.1;
const MOTION_MS = 300;

const WHEEL_IDLE_MS = 150;

/** Label density and camera motion settings for a label level and the motion preference. */
function liveSettings(labelLevel: number, reduced: boolean): Partial<Settings> {
  const level = LABEL_LEVELS[labelLevel] ?? LABEL_LEVELS[2];
  const motion: Partial<Settings> = reduced
    ? { zoomDuration: 0, inertiaDuration: 0, doubleClickZoomingDuration: 0 }
    : { zoomDuration: 250, inertiaDuration: 200, doubleClickZoomingDuration: 200 };
  return { ...motion, labelDensity: level.density, labelRenderedSizeThreshold: level.threshold };
}

/** Camera state that frames the nodes shown in this view (the whole graph is ratio 1). */
function frameView(sigma: Sigma, data: GraphData, view: NetworkView) {
  const b = viewBounds(data, view);
  if (!b) return null;
  const p0 = sigma.graphToFramedGraph({ x: b.x[0], y: b.y[0] });
  const p1 = sigma.graphToFramedGraph({ x: b.x[1], y: b.y[1] });
  const extent = Math.max(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
  return {
    x: (p0.x + p1.x) / 2,
    y: (p0.y + p1.y) / 2,
    // A margin round the shown nodes; never tighter than a small cluster, never wider than all.
    ratio: Math.min(1, Math.max(0.08, extent * 1.15)),
    angle: 0,
  };
}

type Refs = {
  view: NetworkView;
  colours: string[];
  theme: ThemeColors;
  /** Node whose neighbourhood is highlighted (locked, else hovered). */
  active: number | null;
  highlight: Set<number> | null;
  selected: number | null;
};

type NodeAttrs = { i: number; x: number; y: number; size: number; shape: string; label: string };
type EdgeAttrs = { i: number; k: 0 | 1 };

/** Items added per slice: each slice stays well under the 50 ms long-task line. */
const SLICE = 1000;

/**
 * The whole graph (every node, participation and co-investment edge), built in slices with a
 * yield between them. Resolves null if `cancelled()` turns true between slices.
 */
async function buildGraph(
  data: GraphData,
  cancelled: () => boolean,
): Promise<Graph<NodeAttrs, EdgeAttrs> | null> {
  const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected", multi: false });
  const steps: (() => void)[] = [];
  for (let from = 0; from < data.nodes.length; from += SLICE) {
    steps.push(() => {
      for (const v of data.nodes.slice(from, from + SLICE)) {
        const r = nodeRadius(v.wd);
        g.addNode(v.id, {
          i: v.i,
          x: v.x,
          y: v.y,
          size: v.marker === "square" ? squareHalfSide(r) : r,
          shape: v.marker,
          label: v.label,
        });
      }
    });
  }
  for (let from = 0; from < data.edges.length; from += SLICE) {
    steps.push(() => {
      for (const e of data.edges.slice(from, from + SLICE)) {
        g.addEdgeWithKey(`p${e.i}`, data.nodes[e.inv]!.id, data.nodes[e.co]!.id, { i: e.i, k: 0 });
      }
    });
  }
  for (let from = 0; from < data.coEdges.length; from += SLICE) {
    steps.push(() => {
      for (const c of data.coEdges.slice(from, from + SLICE)) {
        g.addEdgeWithKey(`c${c.i}`, data.nodes[c.a]!.id, data.nodes[c.b]!.id, { i: c.i, k: 1 });
      }
    });
  }
  for (const step of steps) {
    await yieldToMain();
    if (cancelled()) return null;
    step();
  }
  return g;
}

export default function NetworkCanvas({
  ref,
  data,
  view,
  colours,
  theme,
  selected,
  locked,
  onSelect,
  onUnlock,
  onZoom,
  labelLevel,
  reduced,
  renderTooltip,
  findRef,
  className,
}: {
  ref?: Ref<CanvasHandle>;
  /** Live find state (see `CanvasFind`); read by the reducers, never a render input. */
  findRef?: { current: CanvasFind | null };
  data: GraphData;
  view: NetworkView;
  colours: string[];
  theme: ThemeColors;
  /** Inspector selection (drawn with a ring and a label). */
  selected: number | null;
  /** Locked highlight (set by a click). */
  locked: number | null;
  onSelect: (i: number) => void;
  onUnlock: () => void;
  /** Zoom level relative to the first framed view (1 = first view). */
  onZoom?: (level: number) => void;
  labelLevel: number;
  reduced: boolean;
  renderTooltip: (i: number) => ReactNode;
  className?: string;
}) {
  const [built, setBuilt] = useState<{
    data: GraphData;
    graph: Graph<NodeAttrs, EdgeAttrs>;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void buildGraph(data, () => cancelled).then((graph) => {
      if (graph && !cancelled) setBuilt({ data, graph });
    });
    return () => {
      cancelled = true;
    };
  }, [data]);
  const graph = built && built.data === data ? built.graph : null;
  // Labels use the page font (next/font's generated family); read once, in the browser.
  const [fontFamily] = useState(() => getComputedStyle(document.body).fontFamily || "sans-serif");
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  // A callback ref, because the table view unmounts this element.
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const active = locked ?? hover?.i ?? null;
  // Mount-time label and motion settings go into Sigma's options, so mounting re-indexes once.
  const [initialSettings] = useState(() => liveSettings(labelLevel, reduced));
  const stateRef = useRef<Refs>({
    view,
    colours,
    theme,
    active: null,
    highlight: null,
    selected,
  });

  // Reducers read only `stateRef`, so the options object never changes and Sigma is created once.
  const options = useMemo<Partial<SigmaOptions>>(
    () => ({
      primitives: {
        nodes: {
          shapes: [sdfCircle(), sdfSquare()],
          label: { font: { family: fontFamily, size: 12 }, margin: 4 },
        },
      },
      styles: {
        nodes: {
          x: { attribute: "x" },
          y: { attribute: "y" },
          size: { attribute: "size" },
          shape: { attribute: "shape" },
          label: { attribute: "label" },
          color: "#8a919c",
          labelSize: 12,
          visibility: "visible",
          labelVisibility: "auto",
          depth: "nodes",
          backdropVisibility: "hidden",
          backdropArea: "node",
          backdropShadowBlur: 0,
          backdropShadowColor: "rgba(0, 0, 0, 0)",
          backdropPadding: 2,
        },
        edges: {
          size: 1,
          color: "#8a919c",
          visibility: "visible",
          depth: "edges",
        },
      },
      settings: {
        itemSizesReference: "screen",
        hideEdgesOnMove: true,
        renderEdgeLabels: false,
        enableEdgeEvents: false,
        enableCameraRotation: false,
        enableCameraMouseRotation: false,
        minEdgeThickness: 0.6,
        stagePadding: 24,
        minCameraRatio: 0.03,
        maxCameraRatio: 2,
        labelGridCellSize: 120,
        ...initialSettings,
      },
      nodeReducer: (_key, _data, attrs) => {
        const r = stateRef.current;
        const i = (attrs as NodeAttrs).i;
        if (!r.view.node[i]) return { visibility: "hidden", labelVisibility: "hidden" };
        const out: Partial<NodeDisplayData> = { color: r.colours[i], labelColor: r.theme.ink };
        const node = data.nodes[i]!;
        const find = findRef?.current ?? null;
        const found = find ? find.found.has(i) : false;
        const lit = find
          ? found || (r.highlight?.has(i) ?? false)
          : r.highlight
            ? r.highlight.has(i)
            : true;
        if (!lit) {
          out.opacity = FADED;
          out.labelVisibility = "hidden";
        } else if (r.highlight || find) {
          out.depth = "topNodes";
          if (i === r.active) out.labelVisibility = "visible";
        }
        if (find && found && (i === find.active || find.found.size <= FIND_LABELS_MAX)) {
          out.labelVisibility = "visible";
        }
        if (find && i === find.active) {
          out.backdropVisibility = "visible";
          out.backdropColor = r.theme.accent;
          out.backdropPadding = 3;
        }
        if (node.kind === "competitor" && lit) {
          out.depth = "topNodes";
          out.backdropVisibility = "visible";
          out.backdropColor = r.theme.accent;
        }
        if (i === r.selected) {
          out.depth = "topNodes";
          out.opacity = 1;
          out.labelVisibility = "visible";
          out.backdropVisibility = "visible";
          out.backdropColor = r.theme.ink;
          out.backdropPadding = 2.5;
        }
        return out;
      },
      edgeReducer: (_key, _data, attrs) => {
        const r = stateRef.current;
        const { i, k } = attrs as EdgeAttrs;
        let a: number;
        let b: number;
        const out: Partial<EdgeDisplayData> = {};
        if (k === 0) {
          if (!r.view.edge[i]) return { visibility: "hidden" };
          const e = data.edges[i]!;
          a = e.inv;
          b = e.co;
          const lead = r.view.lead[i] === 1;
          out.color = lead ? r.theme.ink2 : r.theme.muted;
          out.size = lead ? 1.4 : 0.8;
        } else {
          const w = r.view.coWeight[i]!;
          if (!w) return { visibility: "hidden" };
          const c = data.coEdges[i]!;
          a = c.a;
          b = c.b;
          out.color = r.theme.ink2;
          out.size = 1 + (w - 2) * 0.8;
        }
        const find = findRef?.current ?? null;
        if (r.active === null && find) {
          if (find.found.has(a) || find.found.has(b)) {
            out.opacity = 0.5;
            out.depth = "topEdges";
          } else {
            out.opacity = EDGE_ALPHA * FADED;
          }
        } else if (r.active === null) {
          out.opacity = EDGE_ALPHA;
        } else if (a === r.active || b === r.active) {
          out.opacity = 0.7;
          out.depth = "topEdges";
        } else {
          out.opacity = EDGE_ALPHA * FADED;
        }
        return out;
      },
    }),
    // `data` is fixed for the life of the graph; the font and settings are read once at mount.
    [data, fontFamily, initialSettings, findRef],
  );

  return (
    <div ref={measureRef} className={className}>
      {graph === null ? (
        <Skeleton className="h-full w-full" />
      ) : (
        <SigmaContainer
          graph={graph}
          options={options}
          className="h-full w-full bg-transparent [&_.sigma-container]:h-full [&_.sigma-container]:w-full"
        >
          <Behaviour
            ref={ref}
            stateRef={stateRef}
            data={data}
            view={view}
            colours={colours}
            theme={theme}
            active={active}
            locked={locked}
            selected={selected}
            labelLevel={labelLevel}
            reduced={reduced}
            onSelect={onSelect}
            onUnlock={onUnlock}
            onZoom={onZoom}
            onHover={setHover}
            width={box.width}
            height={box.height}
          />
        </SigmaContainer>
      )}
      {hover && (
        <TooltipOverlay x={hover.x} y={hover.y} width={box.width} height={box.height}>
          {renderTooltip(hover.i)}
        </TooltipOverlay>
      )}
    </div>
  );
}

function TooltipOverlay({
  x,
  y,
  width,
  height,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const left = x + 16 + 256 > width ? Math.max(0, x - 16 - 256) : x + 16;
  const top = Math.max(0, Math.min(y + 12, height - 200));
  return (
    <div className="pointer-events-none absolute z-10" style={{ left, top }}>
      {children}
    </div>
  );
}

/** Lives inside SigmaContainer: events, refreshes, settings and the camera handle. */
function Behaviour({
  ref,
  stateRef,
  data,
  view,
  colours,
  theme,
  active,
  locked,
  selected,
  labelLevel,
  reduced,
  onSelect,
  onUnlock,
  onZoom,
  onHover,
  width,
  height,
}: {
  ref?: Ref<CanvasHandle>;
  stateRef: { current: Refs };
  data: GraphData;
  view: NetworkView;
  colours: string[];
  theme: ThemeColors;
  active: number | null;
  locked: number | null;
  selected: number | null;
  labelLevel: number;
  reduced: boolean;
  onSelect: (i: number) => void;
  onUnlock: () => void;
  /** Zoom level relative to the first framed view (1 = first view). */
  onZoom?: (level: number) => void;
  onHover: (h: { i: number; x: number; y: number } | null) => void;
  width: number;
  height: number;
}) {
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();

  // Filters, mode, colours or the highlight changed: new state for the reducers, then one
  // refresh, batched to the next frame so a fast hover sweep costs one pass per frame. The
  // graph and its positions are untouched.
  // A full refresh re-indexes every node and edge at once (about 10,000 here), so nothing
  // calls it when the reducers' inputs are unchanged, as on mount.
  useEffect(() => {
    const r = stateRef.current;
    const a = active !== null && view.node[active] ? active : null;
    if (
      r.view === view &&
      r.colours === colours &&
      r.theme === theme &&
      r.selected === selected &&
      r.active === a
    ) {
      return;
    }
    r.view = view;
    r.colours = colours;
    r.theme = theme;
    r.selected = selected;
    r.active = a;
    r.highlight = a === null ? null : neighbourhood(data, view, a);
    sigma.scheduleRefresh();
  }, [sigma, stateRef, data, view, colours, theme, selected, active]);

  // First view: frame the nodes in view, not the whole graph, so a narrow filter does not
  // leave them small in one corner. Later filter changes keep the user's camera.
  const framed = useRef(false);
  const baseRatio = useRef(1);
  useEffect(() => {
    if (framed.current) return;
    framed.current = true;
    const target = frameView(sigma, data, view);
    if (target) sigma.getCamera().setState(target);
    baseRatio.current = target?.ratio ?? sigma.getCamera().ratio;
    onZoom?.(1);
  }, [sigma, data, view, onZoom]);

  // Every zoom path (wheel, pinch, double-click, buttons) reports one level.
  useEffect(() => {
    const camera = sigma.getCamera();
    const report = () => onZoom?.(baseRatio.current / camera.ratio);
    camera.on("updated", report);
    return () => {
      camera.off("updated", report);
    };
  }, [sigma, onZoom]);

  // Wheel and trackpad zoom are ours, not Sigma's: Sigma zooms a fixed ×1.7 per event (a
  // trackpad's many small deltas jump) through a camera animation, and each animation start and
  // end flips its `isZooming` graph state, which re-runs both reducers over every node and edge
  // (about 100 ms per wheel event). Here deltas add up and apply once per frame, proportionally
  // and without animation, so Sigma only redraws. Hover pauses until the wheel has been idle for
  // WHEEL_IDLE_MS: a node sliding under the cursor would re-run the reducers for its highlight.
  const wheeling = useRef(false);
  useEffect(() => {
    const captor = sigma.getMouseCaptor();
    let idle = 0;
    let frame = 0;
    let factor = 1;
    let at = { x: 0, y: 0 };
    const apply = () => {
      frame = 0;
      const camera = sigma.getCamera();
      const ratio = camera.getBoundedRatio(camera.ratio / factor);
      factor = 1;
      if (ratio !== camera.ratio && !camera.isAnimating()) {
        camera.setState(sigma.getViewportZoomedState(at, ratio));
      }
    };
    const onWheel = (e: WheelCoords) => {
      e.preventSigmaDefault();
      const w = e.original as WheelEvent;
      if (w.cancelable) w.preventDefault();
      wheeling.current = true;
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        wheeling.current = false;
      }, WHEEL_IDLE_MS);
      factor *= wheelZoomFactor(w.deltaY, w.deltaMode, w.ctrlKey);
      at = { x: e.x, y: e.y };
      if (!frame) frame = requestAnimationFrame(apply);
    };
    captor.on("wheel", onWheel);
    return () => {
      captor.off("wheel", onWheel);
      cancelAnimationFrame(frame);
      window.clearTimeout(idle);
    };
  }, [sigma]);

  // The box changed size (fullscreen, panel resize): Sigma only listens to the window. Sigma
  // sized itself from the box when it was created, so the first size seen needs no resize (a
  // forced resize reallocates the canvas and draws the whole graph again).
  const sizedTo = useRef<string | null>(null);
  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    const key = `${Math.round(width)}x${Math.round(height)}`;
    const first = sizedTo.current === null;
    if (sizedTo.current === key) return;
    sizedTo.current = key;
    if (!first) sigma.resize(true);
  }, [sigma, width, height]);

  // The mount-time values are already in Sigma's options; setSettings refreshes in full.
  const appliedSettings = useRef(`${labelLevel}:${reduced}`);
  useEffect(() => {
    const key = `${labelLevel}:${reduced}`;
    if (appliedSettings.current === key) return;
    appliedSettings.current = key;
    sigma.setSettings(liveSettings(labelLevel, reduced));
  }, [sigma, labelLevel, reduced]);

  useEffect(() => {
    registerEvents({
      enterNode: ({ node, event }) => {
        if (wheeling.current) return;
        const i = data.index.get(node);
        if (i !== undefined) onHover({ i, x: event.x, y: event.y });
      },
      leaveNode: () => {
        if (wheeling.current) return;
        onHover(null);
      },
      clickNode: ({ node }) => {
        const i = data.index.get(node);
        if (i !== undefined) onSelect(i);
      },
      // A node double-click must not also zoom: the click already opened the Inspector.
      doubleClickNode: (e) => e.preventSigmaDefault(),
      clickStage: () => {
        if (locked !== null) onUnlock();
      },
    });
  }, [registerEvents, data, onHover, onSelect, onUnlock, locked]);

  useImperativeHandle(ref, () => {
    const duration = reduced ? 0 : MOTION_MS;
    const camera = () => sigma.getCamera();
    return {
      focus: (i) => {
        const v = data.nodes[i];
        if (!v) return;
        const p = sigma.graphToFramedGraph({ x: v.x, y: v.y });
        const target = { x: p.x, y: p.y, ratio: Math.min(camera().ratio, 0.35) };
        if (duration === 0) camera().setState(target);
        else void camera().animate(target, { duration });
      },
      zoomIn: () => void camera().zoomIn({ duration }),
      zoomOut: () => void camera().zoomOut({ duration }),
      // Back to the first view: the nodes in view, framed.
      reset: () => {
        const target = frameView(sigma, data, view);
        if (!target) void camera().reset({ duration });
        else if (duration === 0) camera().setState(target);
        else void camera().animate(target, { duration });
      },
      refresh: () => sigma.scheduleRefresh(),
    };
  }, [sigma, data, view, reduced]);

  return null;
}
