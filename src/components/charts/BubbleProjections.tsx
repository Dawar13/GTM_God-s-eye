"use client";

import { useCallback, useMemo, useState } from "react";
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

/**
 * Three linked 2D projections of the capital bubbles (x–y, x–z, y–z). Hovering a bubble
 * highlights it in all three; clicking opens the Inspector.
 */
export function BubbleProjections({
  points,
  clusterById,
  sizing,
  checkExtent,
  selectedId,
  onOpen,
  computedLabel,
}: {
  points: BubbleRow[];
  clusterById: Map<number, ClusterInfo>;
  sizing: BubbleSizing | null;
  checkExtent: [number, number] | null;
  selectedId: string | null;
  onOpen: (id: string) => void;
  computedLabel: string;
}) {
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ id: string; panel: string } | null>(null);
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

  const hovered = hover ? points.find((p) => p.id === hover.id) : undefined;

  return (
    <div
      ref={measureRef}
      className={wide ? "grid grid-cols-3 gap-4" : "flex flex-col gap-4"}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 &&
        PANELS.map((panel) => {
          const sx = scaleFor(panel.x, [M.left, panelWidth - M.right]);
          const sy = scaleFor(panel.y, [PANEL_HEIGHT - M.bottom, M.top]);
          const pos = (p: BubbleRow) => [sx(p[panel.x]) ?? 0, sy(p[panel.y]) ?? 0] as const;
          const hp = hovered ? pos(hovered) : null;
          return (
            <figure key={panel.key} className="relative m-0">
              <figcaption className="mb-1 text-sm text-ink-2">{panel.title}</figcaption>
              <svg
                width={panelWidth}
                height={PANEL_HEIGHT}
                role="img"
                aria-label={`${panel.title}: ${points.length} investors, ${AXIS_TITLES[panel.x]} across, ${AXIS_TITLES[panel.y]} up.`}
              >
                <g
                  aria-hidden
                  className="font-condensed tabular-nums"
                  fontSize={11}
                  fill="var(--muted)"
                >
                  {ticksFor(panel.x).map((t) => {
                    const x = sx(t) ?? 0;
                    return (
                      <g key={`x${t}`}>
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
                    const y = sy(t) ?? 0;
                    return (
                      <g key={`y${t}`}>
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
                  onPointerOver={(e) => {
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
                      p.cluster === null ? NEUTRAL : (clusterById.get(p.cluster)?.color ?? NEUTRAL);
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
                      <g key={p.id} data-id={p.id} className="cursor-pointer">
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
                        {(p.id === selectedId || p.id === hover?.id) && (
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
  );
}
