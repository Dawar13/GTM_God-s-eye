"use client";

import { select, zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3";
import {
  useCallback,
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { ZoomControls, handleZoomKey, useZoomReadout } from "@/components/ui-atlas/ZoomControls";
import { paintFind } from "@/lib/viz/paintFind";
import { paintZoom, setZoomTouchAction, ZOOM_SETTLE_MS } from "@/lib/viz/paintZoom";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { ZOOM_MAX, ZOOM_STEP } from "@/lib/viz/zoom";
import { formatUsd } from "@/lib/format";
import { darken, linearScale, logScale, markStyle, type Scale } from "@/lib/viz";
import {
  bubbleDiameter,
  checkDomain,
  logTicks,
  UNSIZED_DIAMETER,
  type BubbleRow,
  type BubbleSizing,
} from "@/lib/viz/transforms/capitalBubbles";
import type { ClusterInfo } from "@/lib/viz/transforms/thesisMap";
import { BubbleTooltip } from "./BubbleTooltip";

type Axis = "check" | "earliness" | "affinity";
const AXIS_TITLES: Record<Axis, string> = {
  check: "Typical check (USD, log scale)",
  earliness: "Stage earliness (0–1)",
  affinity: "Industrial affinity (0–1)",
};
const PANELS: readonly { key: string; x: Axis; y: Axis; title: string }[] = [
  { key: "xy", x: "check", y: "earliness", title: "Check and stage earliness" },
  { key: "xz", x: "check", y: "affinity", title: "Check and industrial affinity" },
  { key: "yz", x: "earliness", y: "affinity", title: "Stage earliness and industrial affinity" },
];
const M = { top: 10, right: 14, bottom: 42, left: 48 };
const PANEL_HEIGHT = 340;
const NEUTRAL = "#8A919C";
const UNIT_TICKS = [0, 0.25, 0.5, 0.75, 1];
/** A square of side r·√π has the same area as the circle of radius r, so squares stay area-true. */
const SQUARE_SIDE = Math.sqrt(Math.PI);
/** Zoom level a find match is brought to in every panel, unless they are already closer. */
const FIND_ZOOM = 2.5;

/** Brings a find match to the centre of all three panels. */
export type ProjectionsHandle = { focusPoint: (id: string) => void };

/**
 * Three linked 2D projections of the capital bubbles (x–y, x–z, y–z). Hovering a bubble
 * highlights it in all three; clicking opens the Inspector.
 */
export function BubbleProjections({
  ref,
  points,
  clusterById,
  sizing,
  checkExtent,
  selectedId,
  onOpen,
  computedLabel,
  found,
  findActiveId,
}: {
  ref?: Ref<ProjectionsHandle>;
  points: BubbleRow[];
  clusterById: Map<number, ClusterInfo>;
  sizing: BubbleSizing | null;
  checkExtent: [number, number] | null;
  selectedId: string | null;
  onOpen: (id: string) => void;
  computedLabel: string;
  /** Find matches (null: no query); the rest fade in all three panels, painted without a render. */
  found: ReadonlySet<string> | null;
  /** The active find match glows and wears the accent ring in all three panels. */
  findActiveId: string | null;
}) {
  const [width, setWidth] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ id: string; panel: string } | null>(null);
  const clipBase = useId();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  // One shared zoom level; each panel keeps its own pan.
  const [view, setView] = useState<{ k: number; t: Record<string, { x: number; y: number }> }>({
    k: 1,
    t: {},
  });
  const svgs = useRef(new Map<string, SVGSVGElement>());
  const zooms = useRef(new Map<string, ZoomBehavior<SVGSVGElement, unknown>>());
  const kRef = useRef(1);
  const readout = useZoomReadout();

  // While a zoom is under way React stays out: `view` is the zoom last rendered, `kRef` and
  // `live` hold the live one, and paintZoom moves each panel's marks and ticks between them once
  // per frame. The panels render again (ticks, hover) once the zoom has been idle.
  const live = useRef<Record<string, { x: number; y: number }>>({});
  const zooming = useRef(false);
  const settle = useRef(0);
  const frame = useRef(0);
  const paintAll = useEffectEvent(() => {
    for (const panel of PANELS) {
      const el = svgs.current.get(panel.key);
      if (!el) continue;
      const from = view.t[panel.key] ?? { x: 0, y: 0 };
      const to = live.current[panel.key] ?? { x: 0, y: 0 };
      paintZoom(el, { k: view.k, ...from }, { k: kRef.current, ...to });
      setZoomTouchAction(el, kRef.current);
    }
  });
  const onZoom = useEffectEvent(() => {
    readout.set(kRef.current);
    if (!zooming.current) {
      zooming.current = true;
      setHover(null);
    }
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        paintAll();
      });
    }
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      zooming.current = false;
      setView({ k: kRef.current, t: { ...live.current } });
    }, ZOOM_SETTLE_MS);
  });
  useLayoutEffect(() => paintAll());
  // Find: new marks start unpainted, so paint after every render while a query is active.
  const findPainted = useRef(false);
  useLayoutEffect(() => {
    if (!found && !findPainted.current) return;
    findPainted.current = found !== null;
    paintFind(root.current, found, findActiveId);
  });
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(settle.current);
    },
    [],
  );
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Largest first, so small bubbles stay on top and reachable.
  const ordered = useMemo(() => {
    const d = (p: BubbleRow) => (sizing && bubbleDiameter(p.fundUsd, sizing)) ?? UNSIZED_DIAMETER;
    return [...points].sort((a, b) => d(b) - d(a) || a.id.localeCompare(b.id));
  }, [points, sizing]);

  const gap = 16;
  const wide = width >= 900;
  const panelWidth = wide ? Math.floor((width - 2 * gap) / 3) : width;
  const domain = checkDomain(checkExtent);
  const scaleFor = (axis: Axis, range: [number, number]): Scale =>
    axis === "check" ? logScale(domain, range) : linearScale([-0.03, 1.03], range);
  const ticksFor = (axis: Axis) => (axis === "check" ? logTicks(domain) : UNIT_TICKS);
  const tickLabel = (axis: Axis, v: number) => (axis === "check" ? formatUsd(v) : String(v));

  const pw = wide ? Math.floor((width - 2 * gap) / 3) : width;
  useEffect(() => {
    if (width === 0) return;
    const rect: [[number, number], [number, number]] = [
      [M.left, M.top],
      [pw - M.right, PANEL_HEIGHT - M.bottom],
    ];
    const cleanups: (() => void)[] = [];
    for (const panel of PANELS) {
      const el = svgs.current.get(panel.key);
      if (!el) continue;
      const z = d3zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, ZOOM_MAX])
        .extent(rect)
        .translateExtent(rect)
        .filter((event: Event) => {
          if (event.type === "wheel" || event.type === "dblclick") return true;
          const touches = (event as TouchEvent).touches;
          if (touches && touches.length > 1) return true;
          return (
            kRef.current > 1 && !(event as MouseEvent).button && !(event as MouseEvent).ctrlKey
          );
        })
        .on("zoom", (e: { transform: ZoomTransform; sourceEvent: unknown }) => {
          const { k, x, y } = e.transform;
          const prevK = kRef.current;
          kRef.current = k;
          live.current[panel.key] = { x, y };
          onZoom();
          if (!e.sourceEvent || k === prevK) return;
          // A gesture changed the level: bring the other panels to it, around their centres.
          const cx = (rect[0][0] + rect[1][0]) / 2;
          const cy = (rect[0][1] + rect[1][1]) / 2;
          for (const other of PANELS) {
            if (other.key === panel.key) continue;
            const oel = svgs.current.get(other.key);
            const oz = zooms.current.get(other.key);
            if (!oel || !oz) continue;
            const old = (oel as unknown as { __zoom: ZoomTransform }).__zoom ?? zoomIdentity;
            const r = k / old.k;
            oz.transform(
              select(oel),
              zoomIdentity.translate(cx - (cx - old.x) * r, cy - (cy - old.y) * r).scale(k),
            );
          }
        });
      zooms.current.set(panel.key, z);
      const sel = select(el);
      sel.call(z);
      cleanups.push(() => sel.on(".zoom", null));
    }
    return () => cleanups.forEach((c) => c());
  }, [width, pw]);

  const applyAll = (fn: (z: ZoomBehavior<SVGSVGElement, unknown>, el: SVGSVGElement) => void) => {
    for (const panel of PANELS) {
      const el = svgs.current.get(panel.key);
      const z = zooms.current.get(panel.key);
      if (el && z) fn(z, el);
    }
  };
  const zoomBy = (dir: 1 | -1) => {
    const f = dir === 1 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const c: [number, number] = [
      (M.left + pw - M.right) / 2,
      (M.top + PANEL_HEIGHT - M.bottom) / 2,
    ];
    applyAll((z, el) => {
      const sel = select(el);
      z.scaleBy((reduced ? sel : sel.transition().duration(160)) as typeof sel, f, c);
    });
  };
  useImperativeHandle(ref, () => ({
    focusPoint: (id: string) => {
      const p = points.find((q) => q.id === id);
      if (!p) return;
      const k = Math.min(ZOOM_MAX, Math.max(kRef.current, FIND_ZOOM));
      const cx = (M.left + pw - M.right) / 2;
      const cy = (M.top + PANEL_HEIGHT - M.bottom) / 2;
      for (const panel of PANELS) {
        const el = svgs.current.get(panel.key);
        const z = zooms.current.get(panel.key);
        if (!el || !z) continue;
        const px = scaleFor(panel.x, [M.left, panelWidth - M.right])(p[panel.x]) ?? cx;
        const py = scaleFor(panel.y, [PANEL_HEIGHT - M.bottom, M.top])(p[panel.y]) ?? cy;
        const sel = select(el);
        z.transform(
          (reduced ? sel : sel.transition().duration(300)) as typeof sel,
          zoomIdentity.translate(cx - k * px, cy - k * py).scale(k),
        );
      }
    },
  }));
  const resetZoom = () =>
    applyAll((z, el) => {
      const sel = select(el);
      z.transform((reduced ? sel : sel.transition().duration(160)) as typeof sel, zoomIdentity);
    });
  const zoomHandlers = {
    onZoomIn: () => zoomBy(1),
    onZoomOut: () => zoomBy(-1),
    onReset: resetZoom,
  };

  const hovered = hover ? points.find((p) => p.id === hover.id) : undefined;

  return (
    <div ref={root} className="relative">
      <div
        ref={measureRef}
        tabIndex={0}
        onKeyDown={(e) => void handleZoomKey(e, zoomHandlers)}
        aria-label="Capital bubble projections. Plus and minus zoom, 0 resets; drag pans when zoomed."
        className={`rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent ${wide ? "grid grid-cols-3 gap-4" : "flex flex-col gap-4"}`}
        onPointerLeave={() => setHover(null)}
      >
        {width > 0 &&
          PANELS.map((panel) => {
            const sx0 = scaleFor(panel.x, [M.left, panelWidth - M.right]);
            const sy0 = scaleFor(panel.y, [PANEL_HEIGHT - M.bottom, M.top]);
            // Zoom re-projects positions (so marks keep their size) and rescales the axes.
            const t = view.t[panel.key] ?? { x: 0, y: 0 };
            const sx = (v: number) => (sx0(v) ?? 0) * view.k + t.x;
            const sy = (v: number) => (sy0(v) ?? 0) * view.k + t.y;
            const clipId = `${clipBase}${panel.key}`;
            const pos = (p: BubbleRow) => [sx(p[panel.x]), sy(p[panel.y])] as const;
            const hp = hovered ? pos(hovered) : null;
            return (
              <figure key={panel.key} className="relative m-0">
                <figcaption className="mb-1 text-sm text-ink-2">{panel.title}</figcaption>
                <svg
                  ref={(el) => {
                    if (el) svgs.current.set(panel.key, el);
                  }}
                  style={{ touchAction: view.k > 1 ? "none" : "pan-y" }}
                  width={panelWidth}
                  height={PANEL_HEIGHT}
                  role="img"
                  aria-label={`${panel.title}: ${points.length} investors, ${AXIS_TITLES[panel.x]} across, ${AXIS_TITLES[panel.y]} up.`}
                >
                  <defs>
                    <clipPath id={clipId}>
                      <rect
                        x={M.left}
                        y={M.top}
                        width={panelWidth - M.left - M.right}
                        height={PANEL_HEIGHT - M.top - M.bottom}
                      />
                    </clipPath>
                  </defs>
                  <g
                    aria-hidden
                    className="font-condensed tabular-nums"
                    fontSize={11}
                    fill="var(--muted)"
                  >
                    {ticksFor(panel.x).map((t) => {
                      const x = sx(t);
                      if (x < M.left - 0.5 || x > panelWidth - M.right + 0.5) return null;
                      return (
                        <g key={`x${t}`} data-zx={x}>
                          <line
                            x1={x}
                            x2={x}
                            y1={M.top}
                            y2={PANEL_HEIGHT - M.bottom}
                            stroke="var(--rule)"
                          />
                          <text x={x} y={PANEL_HEIGHT - M.bottom + 14} textAnchor="middle">
                            {tickLabel(panel.x, t)}
                          </text>
                        </g>
                      );
                    })}
                    {ticksFor(panel.y).map((t) => {
                      const y = sy(t);
                      if (y < M.top - 0.5 || y > PANEL_HEIGHT - M.bottom + 0.5) return null;
                      return (
                        <g key={`y${t}`} data-zy={y}>
                          <line
                            x1={M.left}
                            x2={panelWidth - M.right}
                            y1={y}
                            y2={y}
                            stroke="var(--rule)"
                          />
                          <text x={M.left - 6} y={y + 4} textAnchor="end">
                            {tickLabel(panel.y, t)}
                          </text>
                        </g>
                      );
                    })}
                    <text
                      x={(M.left + panelWidth - M.right) / 2}
                      y={PANEL_HEIGHT - 6}
                      textAnchor="middle"
                      fontSize={12}
                      fill="var(--ink-2)"
                      className="font-sans"
                    >
                      {AXIS_TITLES[panel.x]}
                    </text>
                    <text
                      transform={`translate(12 ${(M.top + PANEL_HEIGHT - M.bottom) / 2}) rotate(-90)`}
                      textAnchor="middle"
                      fontSize={12}
                      fill="var(--ink-2)"
                      className="font-sans"
                    >
                      {AXIS_TITLES[panel.y]}
                    </text>
                  </g>

                  <g
                    clipPath={`url(#${clipId})`}
                    onPointerOver={(e) => {
                      if (zooming.current) return;
                      const id = (e.target as Element)
                        .closest?.("[data-id]")
                        ?.getAttribute("data-id");
                      setHover(id ? { id, panel: panel.key } : null);
                    }}
                    onClick={(e) => {
                      const id = (e.target as Element)
                        .closest?.("[data-id]")
                        ?.getAttribute("data-id");
                      if (id) onOpen(id);
                    }}
                  >
                    {ordered.map((p) => {
                      const [x, y] = pos(p);
                      const color =
                        p.cluster === null
                          ? NEUTRAL
                          : (clusterById.get(p.cluster)?.color ?? NEUTRAL);
                      const style = markStyle(color);
                      const sizedDiameter = sizing ? bubbleDiameter(p.fundUsd, sizing) : null;
                      const r = (sizedDiameter ?? UNSIZED_DIAMETER) / 2;
                      const ring = sizedDiameter === null;
                      const dim = hover !== null && hover.id !== p.id;
                      const common = {
                        fill: ring ? "none" : style.fill,
                        stroke: ring ? darken(color) : style.stroke,
                        strokeWidth: ring ? 1.5 : 1,
                        opacity: dim ? 0.3 : 1,
                        pointerEvents: "all" as const,
                      };
                      const side = r * SQUARE_SIDE;
                      return (
                        <g
                          key={p.id}
                          data-id={p.id}
                          data-find-id={p.id}
                          data-zx={x}
                          data-zy={y}
                          className="mark-glow cursor-pointer"
                          data-glow={
                            p.id === hover?.id || (!hover && p.id === findActiveId) ? "on" : "off"
                          }
                          style={{ "--glow": color } as CSSProperties}
                        >
                          {p.marker === "square" ? (
                            <rect
                              x={x - side / 2}
                              y={y - side / 2}
                              width={side}
                              height={side}
                              {...common}
                            />
                          ) : (
                            <circle cx={x} cy={y} r={r} {...common} />
                          )}
                          {(p.id === selectedId ||
                            p.id === hover?.id ||
                            p.id === findActiveId) && (
                            <circle
                              cx={x}
                              cy={y}
                              r={r + 4}
                              fill="none"
                              stroke="var(--accent)"
                              strokeWidth={2}
                              pointerEvents="none"
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
                {hovered && hp && hover?.panel === panel.key && (
                  <div
                    className="pointer-events-none absolute z-10"
                    style={{
                      left:
                        hp[0] + 16 + 256 > panelWidth ? Math.max(0, hp[0] - 16 - 256) : hp[0] + 16,
                      top: Math.min(hp[1] + 28, PANEL_HEIGHT - 180),
                    }}
                  >
                    <BubbleTooltip
                      p={hovered}
                      cluster={
                        hovered.cluster === null ? undefined : clusterById.get(hovered.cluster)
                      }
                      computedAt={computedLabel}
                    />
                  </div>
                )}
              </figure>
            );
          })}
      </div>
      <ZoomControls
        readout={readout}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onReset={resetZoom}
        className="absolute right-3 bottom-12 z-10"
      />
    </div>
  );
}
