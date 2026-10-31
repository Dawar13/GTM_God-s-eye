"use client";

import { useState } from "react";
import { VizTooltip } from "@/components/ui-atlas";
import { formatCount, formatMultiple, formatPercent } from "@/lib/format";
import { CATEGORICAL, linearScale, markStyle } from "@/lib/viz";
import type { PowerLawSeries } from "@/lib/viz/transforms/calcPowerLaw";

const W = 720;
const H = 300;
const M = { top: 40, right: 12, bottom: 46, left: 72 };
const MARK = markStyle(CATEGORICAL[0]);

/**
 * Histogram of simulated fund multiples: bars from zero on a linear count axis, a solid line
 * at the median and a dashed one at the 90th percentile, both at their exact x. Hover a bar
 * for its range; the same numbers are in the table alternative.
 */
export function MultipleHistogram({ series }: { series: PowerLawSeries }) {
  const [hover, setHover] = useState<number | null>(null);
  const x = linearScale([0, series.domainMax], [M.left, W - M.right]);
  const peak = Math.max(1, ...series.bins.map((b) => b.count));
  const y = linearScale([0, peak], [H - M.bottom, M.top]);
  const px = (v: number) => x(v) as number;
  const py = (v: number) => y(v) as number;
  const xTicks = x.ticks(7);
  const yTicks = y.ticks(4);

  const medianX = px(series.median);
  const p90X = px(series.p90);
  // Put the second label on its own row when the two lines are close.
  const crowded = Math.abs(p90X - medianX) < 120;
  const hovered = hover === null ? null : series.bins[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Histogram of ${formatCount(series.trials)} simulated fund multiples. Median ${formatMultiple(series.median)}, 90th percentile ${formatMultiple(series.p90)}. A table with the same numbers is available.`}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={py(t)} y2={py(t)} stroke="var(--rule)" />
            <text
              x={M.left - 8}
              y={py(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted text-xs"
            >
              {formatCount(t)}
            </text>
          </g>
        ))}
        {series.bins.map((b, i) => {
          const x0 = px(b.from);
          const x1 = px(b.to);
          return (
            <rect
              key={b.from}
              x={x0 + 0.5}
              y={py(b.count)}
              width={Math.max(0, x1 - x0 - 1)}
              height={H - M.bottom - py(b.count)}
              fill={hover === i ? MARK.stroke : MARK.fill}
              stroke={MARK.stroke}
              strokeWidth={MARK.strokeWidth}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        <line
          x1={M.left}
          x2={W - M.right}
          y1={H - M.bottom}
          y2={H - M.bottom}
          stroke="var(--rule)"
        />
        {xTicks.map((t) => (
          <text
            key={t}
            x={px(t)}
            y={H - M.bottom + 16}
            textAnchor="middle"
            className="fill-muted text-xs"
          >
            {formatMultiple(t)}
          </text>
        ))}
        <text
          x={(M.left + W - M.right) / 2}
          y={H - 8}
          textAnchor="middle"
          className="fill-ink-2 text-xs"
        >
          Fund multiple (linear scale)
        </text>
        <text
          transform={`translate(12 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-ink-2 text-xs"
        >
          Simulated funds
        </text>
        <line
          x1={medianX}
          x2={medianX}
          y1={M.top - 8}
          y2={H - M.bottom}
          stroke="var(--ink)"
          strokeWidth={2}
        />
        <text x={medianX + 5} y={M.top - 14} className="fill-ink text-xs font-medium">
          Median {formatMultiple(series.median)}
        </text>
        <line
          x1={p90X}
          x2={p90X}
          y1={M.top - (crowded ? 26 : 8)}
          y2={H - M.bottom}
          stroke="var(--ink)"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        <text x={p90X + 5} y={M.top - (crowded ? 32 : 14)} className="fill-ink text-xs font-medium">
          90th percentile {formatMultiple(series.p90)}
        </text>
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-8 z-10"
          style={{
            left: `${((px(hovered.from) + px(hovered.to)) / 2 / W) * 100}%`,
            transform: px(hovered.from) > W / 2 ? "translateX(-105%)" : "translateX(5%)",
          }}
        >
          <VizTooltip
            title={`${formatMultiple(hovered.from)} to ${formatMultiple(hovered.to)}`}
            value={`${formatCount(hovered.count)} funds`}
            period={`${formatPercent(hovered.share)} of ${formatCount(series.trials)} trials`}
            confidence={null}
            sourceDomain={null}
            computed
          />
        </div>
      )}
    </div>
  );
}
