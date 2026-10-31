"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTable } from "@/components/charts/ChartTable";
import { ChartFrame, Legend, VizTooltip } from "@/components/ui-atlas";
import { formatCount, formatUsd, UNKNOWN } from "@/lib/format";
import { GEOGRAPHY_LABELS, ROUND_STAGE_LABELS } from "@/lib/format/labels";
import { INSTRUMENT_PHRASES, type Instrument } from "@/lib/round";
import {
  countByInstrument,
  instrumentSummary,
  matchInstrument,
  type InstrumentMatch,
} from "@/lib/round/instrument";
import type { Benchmark } from "@/lib/schema";
import { CATEGORICAL, darken, logAxisTitle, markStyle, SEQUENTIAL } from "@/lib/viz";
import {
  BENCHMARK_ROWS,
  raiseBenchmarks,
  type BenchmarkPoint,
} from "@/lib/viz/transforms/raiseBenchmarks";

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const PRE_SEED = CATEGORICAL[0];
const SEED = CATEGORICAL[1];
const OURS = SEQUENTIAL.high;
const MUTED = "#B9BFC9";

type Marked = BenchmarkPoint & { match: InstrumentMatch };

type Mark = { x: number; y: number };

type TableRow = {
  id: string;
  rowLabel: string;
  stage: BenchmarkPoint["stage"] | null;
  x: number;
  publisher: string;
  period: string;
  geography: BenchmarkPoint["geography"] | null;
  sampleSize: number | null;
  instrument: string | null;
  /** Whether the benchmark is for our instrument; null for our own mark. */
  match: InstrumentMatch | null;
  sourceDomain: string | null;
};

function hovered<T>(p: { active?: boolean; payload?: readonly { payload?: unknown }[] }): T | null {
  return p.active && p.payload?.[0]?.payload ? (p.payload[0].payload as T) : null;
}

/**
 * Strip plot of the stored benchmark records (log dollars) with our planned raise on the
 * round-size row. The raise comes from the URL, so it is the same number the check size fit uses.
 */
export function RaiseBenchmarks({
  benchmarks,
  raiseUsd,
  instrument,
}: {
  benchmarks: readonly Benchmark[];
  raiseUsd: number;
  /** Our instrument: benchmarks for it are highlighted, the rest muted. */
  instrument: Instrument;
}) {
  const data = useMemo(() => raiseBenchmarks(benchmarks, raiseUsd), [benchmarks, raiseUsd]);
  const marked = useMemo<Marked[]>(
    () => data.points.map((p) => ({ ...p, match: matchInstrument(p.instrument, instrument) })),
    [data.points, instrument],
  );
  const counts = useMemo(() => countByInstrument(data.points, instrument), [data.points, instrument]);
  const tableRows: TableRow[] = [
    ...marked,
    {
      id: "ours",
      rowLabel: "Our planned raise",
      stage: null,
      x: raiseUsd,
      publisher: "Input on this page",
      period: UNKNOWN,
      geography: null,
      sampleSize: null,
      instrument: INSTRUMENT_PHRASES[instrument],
      match: null,
      sourceDomain: null,
    },
  ];
  const byStage = (stage: BenchmarkPoint["stage"]) => marked.filter((p) => p.stage === stage);
  const dot = (color: string) =>
    function Dot(p: { cx?: number; cy?: number; payload?: Marked }) {
      if (p.cx === undefined || p.cy === undefined) return <g />;
      if (p.payload?.match !== "match") {
        // Not our instrument (or none stated): a small, pale mark so ours stand out.
        return <circle cx={p.cx} cy={p.cy} r={4.5} fill={MUTED} fillOpacity={0.55} stroke="none" />;
      }
      const m = markStyle(color);
      return <circle cx={p.cx} cy={p.cy} r={7} fill={m.fill} stroke={m.stroke} strokeWidth={1.5} />;
    };
  const ring = (p: { cx?: number; cy?: number }) =>
    p.cx === undefined || p.cy === undefined ? (
      <g />
    ) : (
      <circle
        cx={p.cx}
        cy={p.cy}
        r={9}
        fill="none"
        stroke={darken(OURS)}
        strokeWidth={2.5}
      />
    );

  return (
    <ChartFrame
      title="Our raise against published benchmarks"
      subtitle={`One mark per published figure; the ring is our planned raise, on the round-size row only. ${instrumentSummary(counts, instrument)}`}
      legend={
        <Legend
          kind="categorical"
          items={[
            { label: "Pre-seed benchmark", color: PRE_SEED },
            { label: "Seed benchmark", color: SEED },
            { label: `Our planned raise (${formatUsd(raiseUsd)}, from the top bar)`, color: OURS, hollow: true },
            { label: "Other instrument or none stated (muted)", color: MUTED },
          ]}
        />
      }
      sources={data.sources}
      notShown={{
        count: data.notShown,
        field: "a pre-seed or seed size, valuation or SAFE cap in dollars",
        noun: "benchmark records",
      }}
      height={300}
      state={
        data.points.length === 0
          ? { status: "empty", message: "No stored benchmark has a pre-seed or seed size, valuation or SAFE cap in dollars. Add benchmark records and rerun the pipeline." }
          : { status: "ready" }
      }
      tableAlternative={
        <ChartTable
          caption="Benchmarks shown against our raise"
          rows={tableRows}
          rowKey={(p) => p.id}
          initialSort={{ column: "Measure", dir: "asc" }}
          columns={[
            { header: "Measure", sortValue: (p) => p.rowLabel, cell: (p) => p.rowLabel },
            {
              header: "Stage",
              cell: (p) => (p.stage ? ROUND_STAGE_LABELS[p.stage] : UNKNOWN),
            },
            { header: "Value", numeric: true, sortValue: (p) => p.x, cell: (p) => formatUsd(p.x) },
            { header: "Publisher", cell: (p) => p.publisher },
            { header: "Period", cell: (p) => p.period },
            { header: "Geography", cell: (p) => (p.geography ? GEOGRAPHY_LABELS[p.geography] : UNKNOWN) },
            {
              header: "Instrument",
              cell: (p) => p.instrument ?? "Instrument not stated",
            },
            {
              header: "Our instrument",
              cell: (p) =>
                p.match === null ? "Ours" : p.match === "match" ? "Matches" : p.match === "other" ? "Other" : "Not stated",
            },
            {
              header: "Sample size",
              numeric: true,
              cell: (p) => (p.sampleSize === null ? UNKNOWN : formatCount(p.sampleSize)),
            },
            { header: "Source", cell: (p) => p.sourceDomain ?? UNKNOWN },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 12, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid stroke="var(--rule)" />
          <XAxis
            type="number"
            dataKey="x"
            scale="log"
            domain={data.xDomain}
            ticks={data.xTicks}
            allowDataOverflow
            tick={TICK}
            axisLine={{ stroke: "var(--rule)" }}
            tickLine={false}
            tickFormatter={(v: number) => formatUsd(v)}
            label={{
              value: logAxisTitle("US dollars"),
              position: "insideBottom",
              offset: -16,
              fill: "var(--ink-2)",
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            reversed
            domain={[-0.55, BENCHMARK_ROWS.length - 0.45]}
            ticks={BENCHMARK_ROWS.map((_, i) => i)}
            width={190}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => BENCHMARK_ROWS[v]?.label ?? ""}
          />
          <Tooltip
            cursor={{ stroke: "var(--rule)", strokeDasharray: "3 3" }}
            content={(p) => {
              const d = hovered<BenchmarkPoint & { ours?: boolean }>(p);
              if (!d) return null;
              if (d.ours || d.id === undefined) {
                return (
                  <VizTooltip
                    title="Our planned raise"
                    value={formatUsd(raiseUsd)}
                    confidence={null}
                    sourceDomain={null}
                    computed
                  />
                );
              }
              return (
                <VizTooltip
                  title={`${d.rowLabel}, ${ROUND_STAGE_LABELS[d.stage].toLowerCase()}`}
                  value={formatUsd(d.x)}
                  period={d.period}
                  confidence={d.confidence}
                  sourceDomain={d.sourceDomain}
                >
                  <p>{d.publisher}</p>
                  <p>{GEOGRAPHY_LABELS[d.geography]}</p>
                  <p className="tabular-nums">
                    {d.sampleSize === null
                      ? "Sample size not stated"
                      : `Sample size ${formatCount(d.sampleSize)}`}
                  </p>
                  <p>{d.instrument ?? "Instrument not stated"}</p>
                </VizTooltip>
              );
            }}
          />
          <Scatter name="Pre-seed" data={byStage("pre_seed")} shape={dot(PRE_SEED) as never} isAnimationActive={false} />
          <Scatter name="Seed" data={byStage("seed")} shape={dot(SEED) as never} isAnimationActive={false} />
          <Scatter
            name="Our planned raise"
            data={[{ ...data.raise, ours: true } as Mark]}
            shape={ring as never}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
