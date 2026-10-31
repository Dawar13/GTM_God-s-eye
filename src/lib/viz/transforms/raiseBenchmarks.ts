/**
 * "Our raise vs benchmarks" strip plot (PHASE_2 S9). One row per measure, one mark per stored
 * benchmark record, on a log dollar axis. Only records for pre-seed or seed, in dollars, for the
 * four measures below are drawn; everything else is counted in `notShown`, never plotted as
 * zero. Our raise is a marker on the round-size row only: the app holds no planned valuation,
 * so none is drawn on the valuation rows. Nothing is estimated or averaged.
 */
import type { Confidence } from "@/lib/schema";
import type { BenchmarkMetric, Geography, RoundStage } from "@/lib/schema/enums";
import type { Benchmark } from "@/lib/schema";
import { provenanceOf } from "./common";

export const BENCHMARK_ROWS = [
  { metric: "median_round_size", label: "Median round size" },
  { metric: "median_pre_money", label: "Median pre-money valuation" },
  { metric: "median_post_money", label: "Median post-money valuation" },
  { metric: "safe_cap_median", label: "Median SAFE cap" },
] as const satisfies readonly { metric: BenchmarkMetric; label: string }[];

export type BenchmarkRowKey = (typeof BENCHMARK_ROWS)[number]["metric"];
export const BENCHMARK_STAGES = ["pre_seed", "seed"] as const satisfies readonly RoundStage[];
export type BenchmarkStage = (typeof BENCHMARK_STAGES)[number];

export type BenchmarkPoint = {
  id: string;
  metric: BenchmarkRowKey;
  rowLabel: string;
  stage: BenchmarkStage;
  /** Dollars as stored. */
  x: number;
  /** Row index plus a small offset so marks in one row do not sit on top of each other. */
  y: number;
  publisher: string;
  period: string;
  geography: Geography;
  sampleSize: number | null;
  instrument: string | null;
  notes: string | null;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type RaiseBenchmarks = {
  rows: { metric: BenchmarkRowKey; label: string; index: number }[];
  points: BenchmarkPoint[];
  /** Our raise on the round-size row. */
  raise: { x: number; y: number };
  /** Log x-axis domain covering every mark, in whole 1-2-5 steps. */
  xDomain: [number, number];
  xTicks: number[];
  /** Records left out: other measures, other stages or non-dollar units. */
  notShown: number;
  total: number;
  sources: string[];
};

const STAGE_OFFSET: Record<BenchmarkStage, number> = { pre_seed: -0.16, seed: 0.16 };

/** 1, 2, 5 times powers of ten between `lo` and `hi` (inclusive of the bounding steps). */
export function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  const start = Math.floor(Math.log10(lo));
  const end = Math.ceil(Math.log10(hi));
  for (let p = start; p <= end; p++) for (const m of [1, 2, 5]) out.push(m * 10 ** p);
  const below = out.filter((v) => v <= lo);
  const above = out.filter((v) => v >= hi);
  const first = below.length ? below[below.length - 1]! : out[0]!;
  const last = above.length ? above[0]! : out[out.length - 1]!;
  return out.filter((v) => v >= first && v <= last);
}

export function raiseBenchmarks(
  benchmarks: readonly Benchmark[],
  raiseUsd: number,
): RaiseBenchmarks {
  const rowIndex = new Map<string, number>(BENCHMARK_ROWS.map((r, i) => [r.metric, i]));
  const kept = benchmarks.filter(
    (b) =>
      rowIndex.has(b.metric) &&
      (BENCHMARK_STAGES as readonly string[]).includes(b.stage) &&
      b.unit === "usd" &&
      Number.isFinite(b.value) &&
      b.value > 0,
  );
  // Stable order inside a group, so offsets do not shuffle between renders.
  const groups = new Map<string, Benchmark[]>();
  for (const b of [...kept].sort((a, c) => a.value - c.value || a.id.localeCompare(c.id))) {
    const key = `${b.metric}|${b.stage}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const points: BenchmarkPoint[] = [];
  for (const list of groups.values()) {
    list.forEach((b, k) => {
      const metric = b.metric as BenchmarkRowKey;
      const stage = b.stage as BenchmarkStage;
      const jitter = list.length > 1 ? ((k % 3) - 1) * 0.07 : 0;
      points.push({
        id: b.id,
        metric,
        rowLabel: BENCHMARK_ROWS[rowIndex.get(metric)!]!.label,
        stage,
        x: b.value,
        y: rowIndex.get(metric)! + STAGE_OFFSET[stage] + jitter,
        publisher: b.publisher,
        period: b.period,
        geography: b.geography,
        sampleSize: b.sample_size,
        instrument: b.instrument,
        notes: b.notes,
        ...provenanceOf([b]),
      });
    });
  }
  points.sort((a, b) => a.id.localeCompare(b.id));
  const xs = [...points.map((p) => p.x), raiseUsd];
  const xTicks = logTicks(Math.min(...xs), Math.max(...xs));
  const domainSources = new Set(points.map((p) => p.sourceDomain?.split(" +")[0]).filter(Boolean));
  return {
    rows: BENCHMARK_ROWS.map((r, index) => ({ ...r, index })),
    points,
    raise: { x: raiseUsd, y: 0 },
    xDomain: [xTicks[0]!, xTicks[xTicks.length - 1]!],
    xTicks,
    notShown: benchmarks.length - kept.length,
    total: benchmarks.length,
    sources: [...domainSources] as string[],
  };
}
