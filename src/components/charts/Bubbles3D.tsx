"use client";

/**
 * The 3D capital bubbles. Loaded only through next/dynamic (ssr: false) from CapitalBubbles,
 * so plotly.js stays out of every other route's bundle.
 */
import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { formatUsd } from "@/lib/format";
import { darken, withOpacity } from "@/lib/viz";
import {
  bubbleDiameter,
  checkDomain,
  glMarkerSize,
  logTicks,
  UNSIZED_DIAMETER,
  type BubbleRow,
  type BubbleSizing,
} from "@/lib/viz/transforms/capitalBubbles";
import type { ClusterInfo } from "@/lib/viz/transforms/thesisMap";
import { useUi } from "@/store/ui";
import { ZoomControls, handleZoomKey } from "@/components/ui-atlas/ZoomControls";
import { clampZoom, ZOOM_STEP } from "@/lib/viz/zoom";
import { BubbleTooltip } from "./BubbleTooltip";

const Plot = createPlotlyComponent(Plotly);

export type CameraPreset = "reset" | "front" | "top" | "side";
type Camera = {
  eye: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
};
const UP_Z = { x: 0, y: 0, z: 1 };
const CENTER = { x: 0, y: 0, z: 0 };
/** Front: check across, affinity up. Top: check across, earliness up. Side: earliness across, affinity up. */
const CAMERAS: Record<CameraPreset, Camera> = {
  reset: { eye: { x: 1.45, y: -1.45, z: 0.9 }, up: UP_Z, center: CENTER },
  front: { eye: { x: 0, y: -2.3, z: 0 }, up: UP_Z, center: CENTER },
  top: { eye: { x: 0, y: 0, z: 2.3 }, up: { x: 0, y: 1, z: 0 }, center: CENTER },
  side: { eye: { x: 2.3, y: 0, z: 0 }, up: UP_Z, center: CENTER },
};
const NEUTRAL = "#8A919C";
const Z_MIN = 0.4;
const Z_MAX = 6;
const norm = (e: { x: number; y: number; z: number }) => Math.hypot(e.x, e.y, e.z);
const UNIT_TICKS = [0, 0.25, 0.5, 0.75, 1];

type PlotEvent = { points?: { customdata?: unknown }[] };
const idOf = (e: PlotEvent) => {
  const id = e.points?.[0]?.customdata;
  return typeof id === "string" ? id : null;
};

function readColors(dark: boolean) {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, light: string, darkFallback: string) =>
    css.getPropertyValue(name).trim() || (dark ? darkFallback : light);
  return {
    rule: v("--rule", "#E3E6EB", "#2C3038"),
    muted: v("--muted", "#676C74", "#8E959F"),
    ink2: v("--ink-2", "#4A5160", "#B4BAC4"),
    sunk: v("--panel-sunk", "#F0F2F5", "#191C21"),
    accent: v("--accent", "#4F5BD5", "#8B94F0"),
    font: getComputedStyle(document.body).fontFamily,
  };
}

export default function Bubbles3D({
  points,
  clusterById,
  sizing,
  checkExtent,
  selectedId,
  camera,
  onOpen,
  computedLabel,
  height,
}: {
  points: BubbleRow[];
  clusterById: Map<number, ClusterInfo>;
  sizing: BubbleSizing | null;
  checkExtent: [number, number] | null;
  selectedId: string | null;
  camera: { preset: CameraPreset; n: number };
  onOpen: (id: string) => void;
  computedLabel: string;
  height: number;
}) {
  const theme = useUi((s) => s.theme);
  const colors = useMemo(() => readColors(theme === "dark"), [theme]);
  const graphDiv = useRef<HTMLElement | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const presetRef = useRef<CameraPreset>("reset");
  const eyeRef = useRef(CAMERAS.reset.eye);
  const [level, setLevel] = useState(1);
  const [hover, setHover] = useState<{ id: string; x: number; y: number; flip: boolean } | null>(
    null,
  );

  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);

  const data = useMemo(() => {
    const colorOf = (p: BubbleRow) =>
      p.cluster === null ? NEUTRAL : (clusterById.get(p.cluster)?.color ?? NEUTRAL);
    const base = (ps: BubbleRow[]) => ({
      type: "scatter3d",
      mode: "markers",
      x: ps.map((p) => p.check),
      y: ps.map((p) => p.earliness),
      z: ps.map((p) => p.affinity),
      customdata: ps.map((p) => p.id),
      hoverinfo: "none",
    });
    const sized = sizing ? points.filter((p) => p.fundUsd !== null) : [];
    const unsized = sizing ? points.filter((p) => p.fundUsd === null) : points;
    const traces: unknown[] = [];
    if (sizing && sized.length) {
      traces.push({
        ...base(sized),
        name: "Latest fund size known",
        marker: {
          ...sizing.plotly,
          size: sized.map((p) => p.fundUsd),
          color: sized.map((p) => withOpacity(colorOf(p), 0.85)),
          symbol: sized.map((p) => (p.marker === "square" ? "square" : "circle")),
          line: { color: sized.map((p) => darken(colorOf(p))), width: 1 },
        },
      });
    }
    if (unsized.length) {
      traces.push({
        ...base(unsized),
        name: "Latest fund size unknown",
        marker: {
          size: glMarkerSize(UNSIZED_DIAMETER),
          color: unsized.map((p) => darken(colorOf(p))),
          symbol: unsized.map((p) => (p.marker === "square" ? "square-open" : "circle-open")),
        },
      });
    }
    const sel = selectedId ? byId.get(selectedId) : undefined;
    if (sel) {
      const d = (sizing && bubbleDiameter(sel.fundUsd, sizing)) ?? UNSIZED_DIAMETER;
      traces.push({
        ...base([sel]),
        name: "Selected",
        marker: { size: glMarkerSize(d + 10), symbol: "circle-open", color: colors.accent },
      });
    }
    return traces;
  }, [points, sizing, clusterById, selectedId, byId, colors.accent]);

  const layout = useMemo(() => {
    const domain = checkDomain(checkExtent);
    const ticks = logTicks(domain);
    const axis = (title: string, extra: Record<string, unknown>) => ({
      title: { text: title, font: { size: 12, color: colors.ink2 } },
      gridcolor: colors.rule,
      linecolor: colors.rule,
      zerolinecolor: colors.rule,
      showbackground: true,
      backgroundcolor: colors.sunk,
      tickfont: { size: 11, color: colors.muted },
      showspikes: true,
      spikecolor: colors.muted,
      spikethickness: 1,
      ...extra,
    });
    return {
      autosize: true,
      height,
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      font: { family: colors.font, color: colors.ink2 },
      showlegend: false,
      // Keeps the user's camera when filters change the data.
      uirevision: "capital",
      scene: {
        aspectmode: "cube",
        dragmode: "turntable",
        camera: CAMERAS.reset,
        xaxis: axis("Typical check (USD, log scale)", {
          type: "log",
          range: [Math.log10(domain[0]), Math.log10(domain[1])],
          tickvals: ticks,
          ticktext: ticks.map(formatUsd),
        }),
        yaxis: axis("Stage earliness (0–1)", { range: [0, 1.02], tickvals: UNIT_TICKS }),
        zaxis: axis("Industrial affinity (0–1)", { range: [0, 1.02], tickvals: UNIT_TICKS }),
      },
    };
  }, [checkExtent, colors, height]);

  // Camera presets: relayout directly, so pressing the same preset after rotating still applies.
  useEffect(() => {
    if (camera.n === 0 || !graphDiv.current) return;
    presetRef.current = camera.preset;
    void Plotly.relayout(graphDiv.current, { "scene.camera": CAMERAS[camera.preset] });
  }, [camera]);

  // Zoom scales the eye vector (dividing by the factor zooms in), clamped around the preset's distance.
  const zoomBy = (dir: 1 | -1) => {
    if (!graphDiv.current) return;
    const eye = eyeRef.current;
    const base = norm(CAMERAS[presetRef.current].eye);
    const next = clampZoom(
      (base / norm(eye)) * (dir === 1 ? ZOOM_STEP : 1 / ZOOM_STEP),
      Z_MIN,
      Z_MAX,
    );
    const f = base / next / norm(eye);
    const cam = {
      ...CAMERAS[presetRef.current],
      eye: { x: eye.x * f, y: eye.y * f, z: eye.z * f },
    };
    eyeRef.current = cam.eye;
    setLevel(next);
    void Plotly.relayout(graphDiv.current, { "scene.camera": cam });
  };
  const resetZoom = () => {
    if (!graphDiv.current) return;
    const cam = CAMERAS[presetRef.current];
    eyeRef.current = cam.eye;
    setLevel(1);
    void Plotly.relayout(graphDiv.current, { "scene.camera": cam });
  };
  const zoomHandlers = {
    onZoomIn: () => zoomBy(1),
    onZoomOut: () => zoomBy(-1),
    onReset: resetZoom,
  };
  // Wheel and drag also move the camera; keep the readout and eye in step.
  const onRelayout = (e: Record<string, unknown>) => {
    const cam = e["scene.camera"] as Camera | undefined;
    if (!cam?.eye) return;
    const base = norm(CAMERAS[presetRef.current].eye);
    const lv = base / norm(cam.eye);
    if (lv < Z_MIN - 1e-6 || lv > Z_MAX + 1e-6) {
      // Wheel went past the limit: pull the camera back to it.
      const f = lv < Z_MIN ? lv / Z_MIN : lv / Z_MAX;
      const eye = { x: cam.eye.x * f, y: cam.eye.y * f, z: cam.eye.z * f };
      eyeRef.current = eye;
      setLevel(clampZoom(lv, Z_MIN, Z_MAX));
      if (graphDiv.current)
        void Plotly.relayout(graphDiv.current, { "scene.camera": { ...cam, eye } });
      return;
    }
    eyeRef.current = cam.eye;
    setLevel(lv);
  };

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = wrap.current?.getBoundingClientRect();
    if (r) mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const hovered = hover ? byId.get(hover.id) : undefined;

  return (
    <div
      ref={wrap}
      className="relative"
      style={{ height }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHover(null)}
      tabIndex={0}
      onKeyDown={(e) => void handleZoomKey(e, zoomHandlers)}
      role="img"
      aria-label={`3D bubble chart of ${points.length} investors. Use Show as 2D or the table view for exact values.`}
    >
      <Plot
        data={data}
        layout={layout}
        config={{
          displayModeBar: false,
          scrollZoom: true,
          doubleClick: false,
          responsive: true,
          displaylogo: false,
          // Fixed so the glyph size factor (GL_PX_PER_SIZE) holds on every screen.
          plotGlPixelRatio: 2,
        }}
        useResizeHandler
        style={{ width: "100%", height }}
        onInitialized={(_figure, el) => {
          graphDiv.current = el;
        }}
        onRelayout={onRelayout}
        onDoubleClick={() => zoomBy(1)}
        onHover={(e: PlotEvent) => {
          const id = idOf(e);
          const { x, y } = mouse.current;
          const flip = x + 16 + 256 > (wrap.current?.clientWidth ?? Infinity);
          setHover(id ? { id, x, y, flip } : null);
        }}
        onUnhover={() => setHover(null)}
        onClick={(e: PlotEvent) => {
          const id = idOf(e);
          if (id) onOpen(id);
        }}
      />
      <ZoomControls
        level={level}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onReset={resetZoom}
        className="absolute right-2 bottom-2 z-10"
      />
      {hovered && hover && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: hover.flip ? hover.x - 16 - 256 : hover.x + 16,
            top: Math.min(hover.y + 12, height - 200),
          }}
        >
          <BubbleTooltip
            p={hovered}
            cluster={hovered.cluster === null ? undefined : clusterById.get(hovered.cluster)}
            computedAt={computedLabel}
          />
        </div>
      )}
    </div>
  );
}
