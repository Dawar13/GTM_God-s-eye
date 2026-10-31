"use client";

/**
 * The Sigma (WebGL) half of the Network view. The only module that imports sigma, graphology
 * and @react-sigma/core; NetworkGraph loads it with next/dynamic (ssr: false), so none of them
 * reach another route's bundle.
 *
 * The graphology graph is built once per payload. Filters, modes, colours and highlights never
 * touch it: they live in refs that Sigma's node and edge reducers read, and a change calls
 * `sigma.refresh()`.
 */
import Graph from "graphology";
import { SigmaContainer, useRegisterEvents, useSigma } from "@react-sigma/core";
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
import type { EdgeDisplayData, NodeDisplayData, SigmaOptions } from "sigma/types";
import type { ThemeColors } from "@/lib/hooks/useThemeColors";
import { LABEL_LEVELS } from "@/lib/network/url";
import {
  neighbourhood,
  nodeRadius,
  squareHalfSide,
  type GraphData,
  type NetworkView,
} from "@/lib/viz/transforms/networkGraph";

export type CanvasHandle = {
  /** Centre the camera on a node (instant under reduced motion). */
  focus: (i: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
};

const EDGE_ALPHA = 0.15;
const FADED = 0.1;
const MOTION_MS = 300;

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

function buildGraph(data: GraphData): Graph<NodeAttrs, EdgeAttrs> {
  const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected", multi: false });
  for (const v of data.nodes) {
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
  for (const e of data.edges) {
    g.addEdgeWithKey(`p${e.i}`, data.nodes[e.inv]!.id, data.nodes[e.co]!.id, { i: e.i, k: 0 });
  }
  for (const c of data.coEdges) {
    g.addEdgeWithKey(`c${c.i}`, data.nodes[c.a]!.id, data.nodes[c.b]!.id, { i: c.i, k: 1 });
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
  labelLevel,
  reduced,
  renderTooltip,
  className,
}: {
  ref?: Ref<CanvasHandle>;
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
  labelLevel: number;
  reduced: boolean;
  renderTooltip: (i: number) => ReactNode;
  className?: string;
}) {
  const graph = useMemo(() => buildGraph(data), [data]);
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
      },
      nodeReducer: (_key, _data, attrs) => {
        const r = stateRef.current;
        const i = (attrs as NodeAttrs).i;
        if (!r.view.node[i]) return { visibility: "hidden", labelVisibility: "hidden" };
        const out: Partial<NodeDisplayData> = { color: r.colours[i], labelColor: r.theme.ink };
        const node = data.nodes[i]!;
        const lit = r.highlight ? r.highlight.has(i) : true;
        if (!lit) {
          out.opacity = FADED;
          out.labelVisibility = "hidden";
        } else if (r.highlight) {
          out.depth = "topNodes";
          if (i === r.active) out.labelVisibility = "visible";
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
        if (r.active === null) {
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
    // `data` is fixed for the life of the graph; the font is read once at mount.
    [data, fontFamily],
  );

  return (
    <div ref={measureRef} className={className}>
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
          onHover={setHover}
          width={box.width}
          height={box.height}
        />
      </SigmaContainer>
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
  onHover: (h: { i: number; x: number; y: number } | null) => void;
  width: number;
  height: number;
}) {
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();

  // Filters, mode, colours or the highlight changed: new state for the reducers, then one
  // refresh, batched to the next frame so a fast hover sweep costs one pass per frame. The
  // graph and its positions are untouched.
  useEffect(() => {
    stateRef.current.view = view;
    stateRef.current.colours = colours;
    stateRef.current.theme = theme;
    stateRef.current.selected = selected;
    const a = active !== null && view.node[active] ? active : null;
    stateRef.current.active = a;
    stateRef.current.highlight = a === null ? null : neighbourhood(data, view, a);
    sigma.scheduleRefresh();
  }, [sigma, stateRef, data, view, colours, theme, selected, active]);

  // The box changed size (fullscreen, panel resize): Sigma only listens to the window.
  useEffect(() => {
    if (width > 0 && height > 0) sigma.resize(true);
  }, [sigma, width, height]);

  useEffect(() => {
    const level = LABEL_LEVELS[labelLevel] ?? LABEL_LEVELS[2];
    const motion: Partial<Settings> = reduced
      ? { zoomDuration: 0, inertiaDuration: 0, doubleClickZoomingDuration: 0 }
      : { zoomDuration: 250, inertiaDuration: 200, doubleClickZoomingDuration: 200 };
    sigma.setSettings({
      ...motion,
      labelDensity: level.density,
      labelRenderedSizeThreshold: level.threshold,
    });
  }, [sigma, labelLevel, reduced]);

  useEffect(() => {
    registerEvents({
      enterNode: ({ node, event }) => {
        const i = data.index.get(node);
        if (i !== undefined) onHover({ i, x: event.x, y: event.y });
      },
      leaveNode: () => {
        onHover(null);
      },
      clickNode: ({ node }) => {
        const i = data.index.get(node);
        if (i !== undefined) onSelect(i);
      },
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
      reset: () => void camera().reset({ duration }),
    };
  }, [sigma, data, reduced]);

  return null;
}
