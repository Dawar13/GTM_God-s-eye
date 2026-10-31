"use client";

import { useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, Legend, VizTooltip } from "@/components/ui-atlas";
import { formatCount, formatMonthYear, formatPartialDate, formatUsd, UNKNOWN } from "@/lib/format";
import { LAYER_LABELS, ROUND_STAGE_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import { COMPANY_GREY, clusterColor, darken, markStyle, sequentialColor } from "@/lib/viz";
import {
  areaRadius,
  heatPosition,
  type FoundedVsRaised,
  type FundingTimeline,
  type OverlapMatrix,
  type ScatterPoint,
  type TimelineDot,
} from "@/lib/viz/transforms/competitorCharts";
import type { ClusterInfo } from "@/lib/viz/transforms/thesisMap";
import { ChartTable } from "./ChartTable";

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const AXIS_LINE = { stroke: "var(--rule)" } as const;
const GRID = "var(--rule)";
const GREY = COMPANY_GREY.high;
/** Marks with a computed radius below this are drawn at it, so they stay visible and clickable. */
const MIN_R = 2.5;
const RING_R = 5;

function hovered<T>(p: { active?: boolean; payload?: readonly { payload?: unknown }[] }): T | null {
  return p.active && p.payload?.[0]?.payload ? (p.payload[0].payload as T) : null;
}

/* ------------------------------------------------------------ founded vs total raised */

type Pt = ScatterPoint & { r: number };

export function FoundedVsRaisedChart({
  data,
  sources,
}: {
  data: FoundedVsRaised;
  sources: readonly string[];
}) {
  const { open } = useInspector();
  const MAX_R = 20;
  // Big marks first, so small ones stay on top and reachable.
  const points: Pt[] = useMemo(
    () =>
      data.points
        .map((p) => ({
          ...p,
          r:
            p.headcount === null || data.maxHeadcount === null
              ? RING_R
              : areaRadius(p.headcount, data.maxHeadcount, MAX_R, MIN_R),
        }))
        .sort((a, b) => (b.headcount ?? 0) - (a.headcount ?? 0)),
    [data],
  );
  const [x0, x1] = data.xDomain ?? [2000, 2026];
  const [y0, y1] = data.yDomain ?? [1e6, 1e9];
  const yTicks: number[] = [];
  for (let v = y0; v <= y1; v *= 10) yTicks.push(v);
  const xTicks: number[] = [];
  for (let v = Math.ceil(x0 / 2) * 2; v <= x1; v += 2) xTicks.push(v);
  const m = markStyle(GREY);
  const shape = (p: { cx?: number; cy?: number; payload?: Pt }) => {
    const d = p.payload;
    if (!d || p.cx === undefined || p.cy === undefined) return <g />;
    const unknown = d.headcount === null;
    return (
      <circle
        cx={p.cx}
        cy={p.cy}
        r={d.r}
        fill={unknown ? "none" : m.fill}
        stroke={unknown ? darken(GREY) : m.stroke}
        strokeWidth={unknown ? 1.5 : 1}
        style={{ cursor: "pointer" }}
      />
    );
  };
  const maxH = data.maxHeadcount;
  return (
    <ChartFrame
      title="Founded year against total raised"
      subtitle="One mark per competitor: older companies sit left, bigger raisers higher. Mark area shows approximate headcount."
      legend={
        <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
          {maxH !== null && (
            <Legend
              kind="size"
              title="Headcount (approx.), area-proportional"
              samples={[
                { value: Math.max(1, Math.round(maxH / 16)), label: formatCount(Math.max(1, Math.round(maxH / 16))) },
                { value: Math.round(maxH / 4), label: formatCount(Math.round(maxH / 4)) },
                { value: maxH, label: formatCount(maxH) },
              ]}
              maxRadius={MAX_R}
            />
          )}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted">Headcount unknown</p>
            <span className="flex items-center gap-1.5 text-sm text-ink-2">
              <svg width="14" height="14" aria-hidden>
                <circle cx="7" cy="7" r={RING_R} fill="none" stroke={darken(GREY)} strokeWidth="1.5" />
              </svg>
              Fixed ring, not to scale ({formatCount(data.unknownHeadcount)} of {formatCount(points.length)})
            </span>
          </div>
        </div>
      }
      sources={sources}
      notShown={[
        { count: data.missingFounded, field: "founded year", noun: "competitors" },
        { count: data.missingRaised, field: "total raised", noun: "competitors" },
      ]}
      height={380}
      state={
        points.length === 0
          ? { status: "empty", message: "No competitor has both a founded year and a total raised. The table above lists what is known for each." }
          : { status: "ready" }
      }
      tableAlternative={
        <ChartTable
          caption="Founded year and total raised by competitor"
          rows={points}
          rowKey={(p) => p.id}
          initialSort={{ column: "Total raised", dir: "desc" }}
          columns={[
            {
              header: "Competitor",
              sortValue: (p) => p.name.toLowerCase(),
              cell: (p) => (
                <button type="button" className="text-accent hover:underline" onClick={() => open(p.id)}>
                  {p.name}
                </button>
              ),
            },
            { header: "Founded", numeric: true, sortValue: (p) => p.x, cell: (p) => String(p.x) },
            { header: "Total raised", numeric: true, sortValue: (p) => p.y, cell: (p) => formatUsd(p.y) },
            {
              header: "Headcount (approx.)",
              numeric: true,
              sortValue: (p) => p.headcount,
              cell: (p) => (p.headcount === null ? UNKNOWN : `~${formatCount(p.headcount)}`),
            },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 12, right: 24, bottom: 16, left: 8 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[x0, x1]}
            ticks={xTicks}
            tick={TICK}
            axisLine={AXIS_LINE}
            tickLine={false}
            tickFormatter={(v: number) => String(v)}
            label={{ value: "Founded", position: "insideBottom", offset: -8, fill: "var(--ink-2)", fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            scale="log"
            domain={[y0, y1]}
            ticks={yTicks}
            width={84}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatUsd(v)}
            label={{
              value: "Total raised (log scale)",
              angle: -90,
              position: "insideLeft",
              offset: 4,
              fill: "var(--ink-2)",
              fontSize: 12,
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip
            cursor={{ stroke: "var(--rule)", strokeDasharray: "3 3" }}
            content={(p) => {
              const d = hovered<Pt>(p);
              if (!d) return null;
              return (
                <VizTooltip
                  title={d.name}
                  value={`${formatUsd(d.y)} raised`}
                  period={`Founded ${d.x}`}
                  confidence={d.confidence}
                  sourceDomain={d.sourceDomain}
                >
                  <p>{LAYER_LABELS[d.layer]}</p>
                  <p className="tabular-nums">
                    {d.headcount === null
                      ? "Headcount unknown (ring, not to scale)"
                      : `Headcount ~${formatCount(d.headcount)} (approx.)`}
                  </p>
                </VizTooltip>
              );
            }}
          />
          <Scatter
            data={points}
            shape={shape as never}
            isAnimationActive={false}
            onClick={(e: unknown) => {
              const id = (e as { id?: string; payload?: { id?: string } } | null)?.id ??
                (e as { payload?: { id?: string } } | null)?.payload?.id;
              if (id) open(id);
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ----------------------------------------------------------------- funding timeline */

type Dot = TimelineDot & { y: number; r: number };
const LANE_H = 24;

export function FundingTimelineChart({ data }: { data: FundingTimeline }) {
  const { open } = useInspector();
  const MAX_R = 11;
  const dots: Dot[] = useMemo(
    () =>
      data.dots
        .map((d) => ({
          ...d,
          y: d.lane,
          r:
            d.amountUsd === null || data.maxAmountUsd === null
              ? RING_R
              : areaRadius(d.amountUsd, data.maxAmountUsd, MAX_R, MIN_R),
        }))
        // Largest first so small rounds are drawn on top.
        .sort((a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0)),
    [data],
  );
  const minYear = data.xMin === null ? 2015 : new Date(data.xMin).getUTCFullYear();
  const maxYear = data.xMax === null ? 2026 : new Date(data.xMax).getUTCFullYear() + 1;
  const xDomain: [number, number] = [Date.UTC(minYear, 0, 1), Date.UTC(maxYear, 0, 1)];
  const xTicks: number[] = [];
  for (let y = minYear; y <= maxYear; y += 1) xTicks.push(Date.UTC(y, 0, 1));
  const height = data.lanes.length * LANE_H + 48;
  const m = markStyle(GREY);
  const approx = (d: Dot) => d.datePrecision === "year" || d.datePrecision === "quarter";
  const shape = (p: { cx?: number; cy?: number; payload?: Dot }) => {
    const d = p.payload;
    if (!d || p.cx === undefined || p.cy === undefined) return <g />;
    const unknown = d.amountUsd === null;
    return (
      <circle
        cx={p.cx}
        cy={p.cy}
        r={d.r}
        fill={unknown ? "none" : m.fill}
        stroke={unknown ? darken(GREY) : m.stroke}
        strokeWidth={unknown ? 1.5 : 1}
        strokeDasharray={approx(d) ? "2 2" : undefined}
        style={{ cursor: "pointer" }}
      />
    );
  };
  const sizeSamples = data.maxAmountUsd
    ? [data.maxAmountUsd / 100, data.maxAmountUsd / 10, data.maxAmountUsd].map((v) => ({
        value: v,
        label: formatUsd(v),
      }))
    : [];
  return (
    <ChartFrame
      title="Funding timeline"
      subtitle="One row per competitor, one dot per dated round; area shows the amount raised. Dates known only to a year or quarter sit at the start of that period (dashed outline)."
      legend={
        <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
          {sizeSamples.length > 0 && (
            <Legend kind="size" title="Round amount, area-proportional" samples={sizeSamples} maxRadius={MAX_R} />
          )}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted">Amount unknown</p>
            <span className="flex items-center gap-1.5 text-sm text-ink-2">
              <svg width="14" height="14" aria-hidden>
                <circle cx="7" cy="7" r={RING_R} fill="none" stroke={darken(GREY)} strokeWidth="1.5" />
              </svg>
              Fixed ring, not to scale ({formatCount(data.unknownAmount)} of {formatCount(data.dots.length)} rounds)
            </span>
          </div>
        </div>
      }
      sources={data.sources}
      notShown={[
        { count: data.undatedRounds, field: "round date", noun: "rounds" },
        { count: data.withoutDatedRound, field: "any dated round", noun: "competitors" },
      ]}
      height={Math.min(height, 400)}
      state={
        dots.length === 0
          ? { status: "empty", message: "No competitor round has a date. The table above lists each competitor's last round." }
          : { status: "ready" }
      }
      tableAlternative={
        <ChartTable
          caption="Competitor rounds with a date"
          rows={[...data.dots].reverse()}
          rowKey={(d) => d.roundId}
          columns={[
            { header: "Date", sortValue: (d) => d.x, cell: (d) => formatPartialDate(d.date) },
            {
              header: "Competitor",
              sortValue: (d) => d.name.toLowerCase(),
              cell: (d) => (
                <button type="button" className="text-accent hover:underline" onClick={() => open(d.companyId)}>
                  {d.name}
                </button>
              ),
            },
            { header: "Stage", cell: (d) => ROUND_STAGE_LABELS[d.stage] },
            { header: "Amount", numeric: true, sortValue: (d) => d.amountUsd, cell: (d) => formatUsd(d.amountUsd) },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="x"
            scale="time"
            domain={xDomain}
            ticks={xTicks}
            tick={TICK}
            axisLine={AXIS_LINE}
            tickLine={false}
            tickFormatter={(t: number) => String(new Date(t).getUTCFullYear())}
          />
          <YAxis
            type="number"
            dataKey="y"
            reversed
            domain={[-0.5, data.lanes.length - 0.5]}
            ticks={data.lanes.map((_, i) => i)}
            interval={0}
            width={130}
            tick={{ ...TICK, fill: "var(--ink-2)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(i: number) => data.lanes[i]?.name ?? ""}
          />
          <Tooltip
            cursor={{ stroke: "var(--rule)" }}
            content={(p) => {
              const d = hovered<Dot>(p);
              if (!d) return null;
              return (
                <VizTooltip
                  title={d.name}
                  value={d.amountUsd === null ? "Amount unknown" : formatUsd(d.amountUsd)}
                  period={`${ROUND_STAGE_LABELS[d.stage]}, ${formatPartialDate(d.date)}`}
                  confidence={d.confidence}
                  sourceDomain={d.sourceDomain}
                >
                  <p>{LAYER_LABELS[d.layer]}</p>
                  {d.contested && <p>Sources disagree on this round.</p>}
                </VizTooltip>
              );
            }}
          />
          <Scatter
            data={dots}
            shape={shape as never}
            isAnimationActive={false}
            onClick={(e: unknown) => {
              const x = e as { companyId?: string; payload?: { companyId?: string } } | null;
              const id = x?.companyId ?? x?.payload?.companyId;
              if (id) open(id);
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* --------------------------------------------------------------------- overlap heatmap */

const CELL = 17;
const NAME_W = 200;
const HEAD_H = 132;
const GROUP_H = 20;

type Tip = { x: number; y: number; row: OverlapMatrix["rows"][number]; col: OverlapMatrix["columns"][number] };

export function OverlapHeatmap({
  data,
  clusters,
}: {
  data: OverlapMatrix;
  clusters: readonly ClusterInfo[];
}) {
  const { open } = useInspector();
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const clusterBy = new Map(clusters.map((c) => [c.index, c]));

  // Layout: a header line before each cluster group, then its investors.
  const layout = useMemo(() => {
    const items: { kind: "group"; cluster: number | null; y: number }[] = [];
    const rows: { row: OverlapMatrix["rows"][number]; y: number; color: string }[] = [];
    let y = HEAD_H;
    let current: number | null | undefined;
    for (const row of data.rows) {
      if (row.cluster !== current) {
        items.push({ kind: "group", cluster: row.cluster, y });
        y += GROUP_H;
        current = row.cluster;
      }
      rows.push({ row, y, color: row.cluster === null ? "#4A5160" : clusterColor(row.cluster) });
      y += CELL;
    }
    return { items, rows, height: y + 8 };
  }, [data.rows]);

  const width = NAME_W + data.columns.length * CELL + 60;
  const colX = (i: number) => NAME_W + i * CELL;
  const clusterLabel = (c: number | null) =>
    c === null ? "No cluster" : (clusterBy.get(c)?.label ?? `Cluster ${c + 1}`);
  const present = [...new Set(data.rows.map((r) => r.cluster))];
  const columnNames = new Map(data.columns.map((c) => [c.id, c.name]));

  return (
    <ChartFrame
      title="Investor and competitor overlap"
      subtitle={`Investors backing ${data.minCompetitors} or more competitors (${formatCount(data.rows.length)} of ${formatCount(data.totalInvestors)} investors in the overlap file); the other ${formatCount(data.hiddenInvestors)} back one competitor each and are left out. Rows are grouped by thesis cluster, then by how many competitors they back. The investor filters do not apply here.`}
      legend={
        <div className="flex flex-col gap-2">
          <Legend
            kind="sequential"
            title="Rounds the investor took part in at that competitor"
            lowLabel="1 round"
            highLabel={`${data.maxRounds} ${data.maxRounds === 1 ? "round" : "rounds"}`}
          />
          <Legend
            kind="categorical"
            title="Thesis cluster (row group)"
            items={present.map((c) => ({
              label: clusterLabel(c),
              color: c === null ? "#4A5160" : clusterColor(c),
              shape: "square" as const,
            }))}
          />
        </div>
      }
      sources={data.sources}
      notShown={{ count: 0, field: "cluster (shown under No cluster)", noun: "investors" }}
      height={400}
      state={
        data.rows.length === 0
          ? { status: "empty", message: "No investor backs two or more competitors. Open a competitor in the table above to see who backs it." }
          : { status: "ready" }
      }
      tableAlternative={
        <ChartTable
          caption="Investors backing two or more competitors"
          rows={data.rows}
          rowKey={(r) => r.investorId}
          columns={[
            {
              header: "Investor",
              sortValue: (r) => r.name.toLowerCase(),
              cell: (r) => (
                <button type="button" className="text-accent hover:underline" onClick={() => open(r.investorId)}>
                  {r.name}
                </button>
              ),
            },
            { header: "Cluster", cell: (r) => clusterLabel(r.cluster) },
            { header: "Competitors backed", numeric: true, sortValue: (r) => r.overlap, cell: (r) => String(r.overlap) },
            {
              header: "Competitors",
              cell: (r) => (
                <span className="flex flex-wrap gap-x-2">
                  {Object.keys(r.cells).map((cid) => (
                    <button
                      key={cid}
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => open(cid)}
                    >
                      {columnNames.get(cid) ?? cid}
                    </button>
                  ))}
                </span>
              ),
            },
          ]}
        />
      }
    >
      <div ref={box} className="relative overflow-x-auto">
        <svg
          role="img"
          aria-label={`Heatmap of ${data.rows.length} investors by ${data.columns.length} competitors. Use View as table for the keyboard-accessible version.`}
          viewBox={`0 0 ${width} ${layout.height}`}
          width="100%"
          style={{ minWidth: 760, height: "auto" }}
          onMouseLeave={() => setTip(null)}
        >
          {data.columns.map((c, i) => (
            <text
              key={c.id}
              transform={`translate(${colX(i) + CELL / 2 + 3}, ${HEAD_H - 6}) rotate(-55)`}
              fontSize="11"
              fill="var(--ink-2)"
              style={{ cursor: "pointer" }}
              onClick={() => open(c.id)}
            >
              {c.name}
            </text>
          ))}
          {layout.items.map((g) => (
            <text key={`g${g.y}`} x={4} y={g.y + 14} fontSize="11" fontWeight="600" fill="var(--ink)">
              {clusterLabel(g.cluster)}
            </text>
          ))}
          {layout.rows.map(({ row, y, color }) => (
            <g key={row.investorId}>
              <rect x={0} y={y + 2} width={4} height={CELL - 4} fill={color} />
              <text
                x={10}
                y={y + CELL - 5}
                fontSize="12"
                fill="var(--ink)"
                style={{ cursor: "pointer" }}
                onClick={() => open(row.investorId)}
              >
                {row.name.length > 28 ? `${row.name.slice(0, 27)}…` : row.name}
              </text>
              {data.columns.map((c, i) => {
                const cell = row.cells[c.id];
                return (
                  <rect
                    key={c.id}
                    x={colX(i) + 1}
                    y={y + 1}
                    width={CELL - 2}
                    height={CELL - 2}
                    rx={2}
                    fill={cell ? sequentialColor(heatPosition(cell.rounds, data.maxRounds)) : "var(--panel-sunk)"}
                    style={cell ? { cursor: "pointer" } : undefined}
                    onClick={cell ? () => open(c.id) : undefined}
                    onMouseMove={
                      cell
                        ? (e) => {
                            const b = box.current?.getBoundingClientRect();
                            if (b) setTip({ x: e.clientX - b.left, y: e.clientY - b.top, row, col: c });
                          }
                        : undefined
                    }
                    onMouseLeave={cell ? () => setTip(null) : undefined}
                  />
                );
              })}
            </g>
          ))}
        </svg>
        {tip && (
          <div className="pointer-events-none absolute z-20" style={{ left: tip.x + 14, top: tip.y + 14 }}>
            <VizTooltip
              title={tip.row.name}
              value={`${tip.row.cells[tip.col.id]!.rounds} ${tip.row.cells[tip.col.id]!.rounds === 1 ? "round" : "rounds"} at ${tip.col.name}`}
              period={
                tip.row.cells[tip.col.id]!.latest
                  ? `Latest ${formatMonthYear(tip.row.cells[tip.col.id]!.latest)}`
                  : "Round dates unknown"
              }
              confidence={tip.row.cells[tip.col.id]!.confidence}
              sourceDomain={tip.row.cells[tip.col.id]!.sourceDomain}
            >
              <p>{LAYER_LABELS[tip.col.layer]}</p>
              <p>
                Backs {tip.row.overlap} competitors · {clusterLabel(tip.row.cluster)}
              </p>
              <p>Click to open {tip.col.name}</p>
            </VizTooltip>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
