"use client";

/**
 * The 3D capital bubbles. Loaded only through next/dynamic (ssr: false) from CapitalBubbles,
 * so plotly.js stays out of every other route's bundle.
 */
import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type MouseEvent } from "react";
import { formatUsd } from "@/lib/format";
import { darken, lighten, withOpacity } from "@/lib/viz";
import {
  bubbleDiameter,
  checkDomain,
  glMarkerSize,
  logTicks,
  plotlyDiameter,
  UNSIZED_DIAMETER,
  type BubbleRow,
  type BubbleSizing,
} from "@/lib/viz/transforms/capitalBubbles";
import type { ClusterInfo } from "@/lib/viz/transforms/thesisMap";
import { useUi } from "@/store/ui";
import { ZoomControls, handleZoomKey, useZoomReadout } from "@/components/ui-atlas/ZoomControls";
import { clampZoom, ZOOM_STEP } from "@/lib/viz/zoom";
import {
  dragOrbit,
  eyeAtDistance,
  orbitCamera,
  orbitFromEye,
  pinchLevel,
  type Vec3,
} from "@/lib/viz/orbit";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
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
/** Touch: midpoint travel (px) before two fingers rotate, so a pinch alone doesn't wobble. */
const ROTATE_SLOP = 10;
const TAP_SLOP = 24;
const TAP_MS = 300;
const DOUBLE_TAP_MS = 320;
/** Idle time that ends a wheel gesture: hover and its glow resume, the zoom clamp applies. */
const WHEEL_IDLE_MS = 150;
/** Stable, so a re-render never makes react-plotly call Plotly.react. */
const PLOT_CONFIG = {
  displayModeBar: false,
  scrollZoom: true,
  doubleClick: false as const,
  responsive: true,
  displaylogo: false,
  // Fixed so the glyph size factor (GL_PX_PER_SIZE) holds on every screen.
  plotGlPixelRatio: 2,
};

type PlotDiv = HTMLElement & {
  _fullLayout?: { scene?: { camera?: Partial<Camera>; _scene?: { getCamera?: () => Camera } } };
};
type Gesture = {
  span: number;
  mid: { x: number; y: number };
  level: number;
  eye: Vec3;
  up: Vec3;
  rotating: boolean;
};
const fingers = (e: TouchEvent) => {
  const [a, b] = [e.touches[0]!, e.touches[1]!];
  return {
    span: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    mid: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
  };
};

type PlotEvent = { points?: { customdata?: unknown }[] };
const idOf = (e: PlotEvent) => {
  const id = e.points?.[0]?.customdata;
  return typeof id === "string" ? id : null;
};

/**
 * Hover glow: WebGL markers can't take a CSS filter, so the hovered point is drawn again in
 * six faint halo traces (one concentric marker each, so the falloff reads as a soft glow rather
 * than rings) plus an outline trace. They sit at the end of
 * `data`, always present and empty, and are filled and cleared with Plotly.restyle.
 */
const HALO_SCALE = [1.25, 1.5, 1.8, 2.15, 2.55, 3.0] as const;
const HALO_OPACITY = {
  dark: [0.42, 0.3, 0.2, 0.12, 0.07, 0.04],
  light: [0.26, 0.18, 0.12, 0.075, 0.045, 0.025],
} as const;
const HALO_TRACES = HALO_SCALE.length + 1;
const OUTLINE_WIDTH = 2;

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
  const dark = theme === "dark";
  const colors = useMemo(() => readColors(dark), [dark]);
  const graphDiv = useRef<HTMLElement | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const presetRef = useRef<CameraPreset>("reset");
  const eyeRef = useRef(CAMERAS.reset.eye);
  // The readout re-renders itself; camera moves never re-render this component.
  const readout = useZoomReadout();
  // Touch screens: Plotly's own touch drag rotates freely and tips the scene over, so it is
  // off and the touch handlers below orbit the camera with z kept up.
  const coarse = useMediaQuery("(pointer: coarse)");
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
    // Hover glow traces: empty until a point is hovered. Never hoverable, never in a legend.
    const empty = { x: [], y: [], z: [], hoverinfo: "none", showlegend: false };
    HALO_SCALE.forEach((_, i) =>
      traces.push({
        ...empty,
        type: "scatter3d",
        mode: "markers",
        name: "Glow",
        marker: { size: 1, color: NEUTRAL, opacity: HALO_OPACITY[dark ? "dark" : "light"][i] },
      }),
    );
    traces.push({
      ...empty,
      type: "scatter3d",
      mode: "markers",
      name: "Hover outline",
      marker: { size: 1, symbol: "circle-open", color: NEUTRAL, line: { width: OUTLINE_WIDTH } },
    });
    return traces;
  }, [points, sizing, clusterById, selectedId, byId, colors.accent, dark]);

  // Draws (or clears) the glow for one point. At most one restyle per frame; the last id wins.
  const haloId = useRef<string | null>(null);
  const haloFrame = useRef(0);
  const haloShown = useRef(false);
  const setHalo = (id: string | null) => {
    haloId.current = id;
    if (haloFrame.current) return;
    haloFrame.current = requestAnimationFrame(() => {
      haloFrame.current = 0;
      const gd = graphDiv.current as (HTMLElement & { data?: unknown[] }) | null;
      if (!gd?.isConnected || !gd.data) return;
      const first = gd.data.length - HALO_TRACES;
      if (first < 0) return;
      const idx = Array.from({ length: HALO_TRACES }, (_, i) => first + i);
      const p = haloId.current ? byId.get(haloId.current) : undefined;
      if (!p) {
        if (!haloShown.current) return;
        haloShown.current = false;
        void Plotly.restyle(
          gd,
          {
            x: idx.map(() => []),
            y: idx.map(() => []),
            z: idx.map(() => []),
            customdata: idx.map(() => []),
          },
          idx,
        );
        return;
      }
      const color = p.cluster === null ? NEUTRAL : (clusterById.get(p.cluster)?.color ?? NEUTRAL);
      const d =
        (sizing && p.fundUsd !== null && plotlyDiameter(p.fundUsd, sizing)) || UNSIZED_DIAMETER;
      const halo = dark ? lighten(color, 0.25) : color;
      const outline = dark ? lighten(color, 0.4) : darken(color, 0.4);
      haloShown.current = true;
      void Plotly.restyle(
        gd,
        {
          x: idx.map(() => [p.check]),
          y: idx.map(() => [p.earliness]),
          z: idx.map(() => [p.affinity]),
          customdata: idx.map(() => [p.id]),
          "marker.size": [...HALO_SCALE.map((k) => glMarkerSize(d * k)), glMarkerSize(d)],
          "marker.color": [halo, halo, halo, outline],
          "marker.symbol": [
            ...HALO_SCALE.map(() => "circle"),
            p.marker === "square" ? "square-open" : "circle-open",
          ],
        },
        idx,
      );
    });
  };
  useEffect(
    () => () => {
      if (haloFrame.current) cancelAnimationFrame(haloFrame.current);
    },
    [],
  );

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
        // Turntable keeps z up under the mouse; false hands touch gestures to our handlers.
        dragmode: coarse ? false : "turntable",
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
  }, [checkExtent, colors, height, coarse]);

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
    readout.set(next);
    void Plotly.relayout(graphDiv.current, { "scene.camera": cam });
  };
  const resetZoom = () => {
    if (!graphDiv.current) return;
    const cam = CAMERAS[presetRef.current];
    eyeRef.current = cam.eye;
    readout.set(1);
    void Plotly.relayout(graphDiv.current, { "scene.camera": cam });
  };
  const zoomHandlers = {
    onZoomIn: () => zoomBy(1),
    onZoomOut: () => zoomBy(-1),
    onReset: resetZoom,
  };
  // Plotly's own scroll zoom drives the camera during a wheel gesture. Hover (tooltip and glow
  // restyles) pauses until the wheel has been idle for WHEEL_IDLE_MS, and a camera past the zoom
  // limits is pulled back once, then, instead of fighting Plotly on every event.
  const lastCam = useRef<Camera | null>(null);
  const wheeling = useRef(false);
  const wheelIdle = useRef(0);
  const clampCamera = () => {
    // Plotly's last relayout event can trail its damped scroll zoom; the scene has the camera.
    const now = (graphDiv.current as PlotDiv | null)?._fullLayout?.scene?._scene?.getCamera?.();
    if (now?.eye) lastCam.current = now;
    const cam = lastCam.current;
    if (!cam || !graphDiv.current?.isConnected) return;
    const lv = norm(CAMERAS[presetRef.current].eye) / norm(cam.eye);
    const k = clampZoom(lv, Z_MIN, Z_MAX);
    eyeRef.current = cam.eye;
    readout.set(k);
    if (Math.abs(k - lv) < 1e-6) return;
    const f = lv / k;
    const eye = { x: cam.eye.x * f, y: cam.eye.y * f, z: cam.eye.z * f };
    eyeRef.current = eye;
    void Plotly.relayout(graphDiv.current, { "scene.camera": { ...cam, eye } });
  };
  const onWheel = useEffectEvent(() => {
    if (!wheeling.current) {
      wheeling.current = true;
      setHover(null);
      setHalo(null);
    }
    window.clearTimeout(wheelIdle.current);
    wheelIdle.current = window.setTimeout(() => {
      wheeling.current = false;
      clampCamera();
    }, WHEEL_IDLE_MS);
  });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // Capture, so it runs before Plotly's own listener; passive, so it never delays the zoom.
    const opts = { capture: true, passive: true } as const;
    const wheel = () => onWheel();
    el.addEventListener("wheel", wheel, opts);
    return () => {
      el.removeEventListener("wheel", wheel, opts);
      window.clearTimeout(wheelIdle.current);
    };
  }, []);
  // Wheel and drag also move the camera; keep the readout and eye in step.
  const onRelayout = (e: Record<string, unknown>) => {
    const cam = e["scene.camera"] as Camera | undefined;
    if (!cam?.eye) return;
    lastCam.current = cam;
    eyeRef.current = cam.eye;
    readout.set(clampZoom(norm(CAMERAS[presetRef.current].eye) / norm(cam.eye), Z_MIN, Z_MAX));
  };

  // Touch gestures. Two fingers are ours: pinch zooms through the same level and clamps as the
  // buttons, moving both fingers orbits (turntable, elevation clamped). One finger is left to the
  // page (scroll) and to Plotly's tap, which picks a bubble and opens it. Double-tap zooms in.
  const gesture = useRef<Gesture | null>(null);
  const tap = useRef<{ t: number; x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const lastTapZoom = useRef(-Infinity);
  const frame = useRef(0);
  const queued = useRef<{ cam: Camera; level: number } | null>(null);

  const startGesture = (e: TouchEvent) => {
    const eye = eyeRef.current;
    const up = (graphDiv.current as PlotDiv | null)?._fullLayout?.scene?.camera?.up;
    gesture.current = {
      ...fingers(e),
      level: norm(CAMERAS[presetRef.current].eye) / norm(eye),
      eye,
      up: up ?? CAMERAS[presetRef.current].up,
      rotating: false,
    };
  };
  // At most one relayout per frame.
  const queueCamera = (cam: Camera, lv: number) => {
    queued.current = { cam, level: lv };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const q = queued.current;
      queued.current = null;
      if (!q || !graphDiv.current?.isConnected) return;
      eyeRef.current = q.cam.eye;
      readout.set(q.level);
      void Plotly.relayout(graphDiv.current, { "scene.camera": q.cam });
    });
  };
  const onTouchStart = useEffectEvent((e: TouchEvent) => {
    if (e.touches.length >= 2) {
      // Plotly never sees a two-finger gesture, and the page doesn't zoom.
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      tap.current = null;
      startGesture(e);
      return;
    }
    const t = e.touches[0];
    tap.current = t ? { t: e.timeStamp, x: t.clientX, y: t.clientY, moved: false } : null;
  });
  const onTouchMove = useEffectEvent((e: TouchEvent) => {
    // Plotly's touchmove listener cancels every move, which would block one-finger scrolling.
    e.stopPropagation();
    const g = gesture.current;
    if (!g || e.touches.length < 2) {
      const t = e.touches[0];
      const d = tap.current;
      if (d && t && Math.hypot(t.clientX - d.x, t.clientY - d.y) > TAP_SLOP) d.moved = true;
      return;
    }
    if (e.cancelable) e.preventDefault();
    const f = fingers(e);
    const base = norm(CAMERAS[presetRef.current].eye);
    const lv = pinchLevel(g.level, g.span, f.span, Z_MIN, Z_MAX);
    if (!g.rotating && Math.hypot(f.mid.x - g.mid.x, f.mid.y - g.mid.y) > ROTATE_SLOP) {
      // Rotation starts from here, so crossing the slop doesn't jump.
      g.rotating = true;
      g.mid = f.mid;
    }
    const cam: Camera = g.rotating
      ? orbitCamera(
          dragOrbit(
            { ...orbitFromEye(g.eye, g.up), distance: base / lv },
            f.mid.x - g.mid.x,
            f.mid.y - g.mid.y,
            Math.PI / Math.max(1, wrap.current?.clientHeight ?? height),
          ),
        )
      : { eye: eyeAtDistance(g.eye, base / lv), up: g.up, center: CENTER };
    queueCamera(cam, lv);
  });
  const onTouchEnd = useEffectEvent((e: TouchEvent) => {
    if (gesture.current) {
      e.stopPropagation();
      if (e.touches.length >= 2) startGesture(e);
      else gesture.current = null;
      return;
    }
    const d = tap.current;
    tap.current = null;
    if (!d || d.moved || e.type === "touchcancel" || e.timeStamp - d.t > TAP_MS) return;
    const last = lastTap.current;
    if (last && d.t - last.t < DOUBLE_TAP_MS && Math.hypot(d.x - last.x, d.y - last.y) < TAP_SLOP) {
      lastTap.current = null;
      lastTapZoom.current = performance.now();
      zoomBy(1);
    } else lastTap.current = { t: e.timeStamp, x: d.x, y: d.y };
  });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // Capture phase, so these run before Plotly's listeners on the canvas; not passive, so
    // two-finger moves can be cancelled.
    const opts = { capture: true, passive: false } as const;
    const start = (e: TouchEvent) => onTouchStart(e);
    const move = (e: TouchEvent) => onTouchMove(e);
    const end = (e: TouchEvent) => onTouchEnd(e);
    el.addEventListener("touchstart", start, opts);
    el.addEventListener("touchmove", move, opts);
    el.addEventListener("touchend", end, opts);
    el.addEventListener("touchcancel", end, opts);
    return () => {
      el.removeEventListener("touchstart", start, opts);
      el.removeEventListener("touchmove", move, opts);
      el.removeEventListener("touchend", end, opts);
      el.removeEventListener("touchcancel", end, opts);
    };
  }, []);

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = wrap.current?.getBoundingClientRect();
    if (r) mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const hovered = hover ? byId.get(hover.id) : undefined;

  return (
    <div
      ref={wrap}
      className="relative"
      style={{ height, touchAction: "pan-y" }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        setHover(null);
        setHalo(null);
      }}
      tabIndex={0}
      onKeyDown={(e) => void handleZoomKey(e, zoomHandlers)}
      role="img"
      aria-label={`3D bubble chart of ${points.length} investors. Use Show as 2D or the table view for exact values.`}
    >
      <Plot
        data={data}
        layout={layout}
        config={PLOT_CONFIG}
        useResizeHandler
        style={{ width: "100%", height }}
        onInitialized={(_figure, el) => {
          graphDiv.current = el;
        }}
        onRelayout={onRelayout}
        onDoubleClick={() => {
          // A double tap already zoomed through the touch handler.
          if (performance.now() - lastTapZoom.current > 600) zoomBy(1);
        }}
        onHover={(e: PlotEvent) => {
          // No tooltip or glow restyle while a wheel or pinch zoom is under way.
          if (wheeling.current || gesture.current) return;
          const id = idOf(e);
          const { x, y } = mouse.current;
          const flip = x + 16 + 256 > (wrap.current?.clientWidth ?? Infinity);
          setHover(id ? { id, x, y, flip } : null);
          setHalo(id);
        }}
        onUnhover={() => {
          setHover(null);
          setHalo(null);
        }}
        onClick={(e: PlotEvent) => {
          const id = idOf(e);
          if (id) onOpen(id);
        }}
      />
      <ZoomControls
        readout={readout}
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
