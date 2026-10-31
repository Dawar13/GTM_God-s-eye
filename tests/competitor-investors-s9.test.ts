/** S9: competitor-investor split, the conflict-recency port, and the benchmark strip plot data. */
import { beforeAll, describe, expect, it } from "vitest";
import {
  getBenchmarks,
  getCompetitorOverlap,
  getCompetitors,
  getFitFeatures,
  getInvestors,
  getRounds,
} from "@/lib/data";
import { isRecentRound } from "@/lib/fit/conflict";
import {
  signalReason,
  splitBackers,
  toCompetitorBackers,
  type CompetitorBacker,
} from "@/lib/viz/transforms/competitorInvestors";
import {
  BENCHMARK_ROWS,
  logTicks,
  raiseBenchmarks,
} from "@/lib/viz/transforms/raiseBenchmarks";
import type { Competitor, FitFeatures, Round } from "@/lib/schema";
import type { Benchmark } from "@/lib/schema";

let backers: CompetitorBacker[];
let fits: FitFeatures[];
let competitors: Competitor[];
let rounds: Round[];
let benchmarks: Benchmark[];
let overlap: Awaited<ReturnType<typeof getCompetitorOverlap>>;

beforeAll(async () => {
  const [inv, f, comp, r, bm, ov] = await Promise.all([
    getInvestors(),
    getFitFeatures(),
    getCompetitors(),
    getRounds(),
    getBenchmarks(),
    getCompetitorOverlap(),
  ]);
  fits = f;
  competitors = comp;
  rounds = r;
  benchmarks = bm;
  backers = toCompetitorBackers(comp, r, inv);
  overlap = ov;
});

describe("recency port", () => {
  it("matches the pipeline's rule at the edges", () => {
    // Reference date 2026-10-30, 730 days: first of the month on or after 2024-10-31 is Nov 2024.
    expect(isRecentRound("2024-11")).toBe(true);
    expect(isRecentRound("2024-10")).toBe(false);
    expect(isRecentRound("2024-10-30")).toBe(false); // day is ignored: Oct 1, 2024 is 759 days back
    expect(isRecentRound("2025")).toBe(true); // June 2025
    expect(isRecentRound("2024")).toBe(false); // June 2024
    expect(isRecentRound("2024-Q4")).toBe(false); // June 2024, as in the pipeline
    expect(isRecentRound(null)).toBe(false);
  });
});

describe("competitor backers", () => {
  it("the conflict flag is exactly 'backed a direct competitor in a recent round'", () => {
    const flagged = new Set(fits.filter((f) => f.flags.includes("conflict")).map((f) => f.investor_id));
    const derived = new Set(
      backers
        .filter((b) => b.backed.some((c) => c.category === "direct" && isRecentRound(c.latestDate)))
        .map((b) => b.investorId),
    );
    // latestDate is the latest round per competitor, so a recent round is never missed.
    expect([...derived].sort()).toEqual([...flagged].sort());
    // Every flagged investor is among the backers.
    const ids = new Set(backers.map((b) => b.investorId));
    for (const id of flagged) expect(ids.has(id)).toBe(true);
  });

  it("the backers and their competitors are the competitor_overlap file's investors and pairs", () => {
    expect(backers.length).toBeGreaterThan(300);
    expect(backers.length).toBe(overlap.rows.length);
    const pairs = overlap.rows.reduce((a, r) => a + r.competitor_ids.length, 0);
    expect(backers.reduce((a, b) => a + b.backed.length, 0)).toBe(pairs);
    const byInv = new Map(backers.map((b) => [b.investorId, b]));
    for (const row of overlap.rows) {
      const b = byInv.get(row.investor_id)!;
      expect(b.backed.map((c) => c.competitorId).sort()).toEqual([...row.competitor_ids].sort());
    }
  });

  it("the split partitions the backers that pass the filters", () => {
    const conflictIds = new Set(
      fits.filter((f) => f.flags.includes("conflict")).map((f) => f.investor_id),
    );
    const all = new Set(backers.map((b) => b.investorId));
    const split = splitBackers(backers, conflictIds, all);
    expect(split.conflict.length + split.signal.length).toBe(backers.length);
    expect(split.hiddenByFilters).toBe(0);
    expect(split.conflict.length).toBe(conflictIds.size);
    expect(split.conflict.every((b) => b.reason === null)).toBe(true);
    expect(split.signal.every((b) => b.reason !== null)).toBe(true);
    // A thesis signal never has a recent direct round.
    for (const b of split.signal) {
      expect(b.backed.some((c) => c.category === "direct" && isRecentRound(c.latestDate))).toBe(false);
    }
    const some = new Set([...all].slice(0, 100));
    const part = splitBackers(backers, conflictIds, some);
    expect(part.conflict.length + part.signal.length).toBe(100);
    expect(part.hiddenByFilters).toBe(backers.length - 100);
  });
});

describe("signal reasons", () => {
  const b = (category: "direct" | "adjacent" | "remote", latestDate: string | null) => ({
    competitorId: "c",
    name: "C",
    category,
    latestDate,
    rounds: 1,
  });
  it("names why an unflagged backer is not a conflict", () => {
    expect(signalReason([b("adjacent", "2026-01")])).toBe("not_direct");
    expect(signalReason([b("direct", "2022-05")])).toBe("direct_older");
    expect(signalReason([b("direct", null)])).toBe("direct_undated");
    expect(signalReason([b("direct", null), b("direct", "2020")])).toBe("direct_older");
  });
});

describe("benchmark strip plot", () => {
  it("draws only pre-seed and seed dollar figures for the four measures; counts the rest", () => {
    const data = raiseBenchmarks(benchmarks, 1_000_000);
    const rows = new Set<string>(BENCHMARK_ROWS.map((r) => r.metric));
    expect(data.points.length + data.notShown).toBe(benchmarks.length);
    expect(data.total).toBe(benchmarks.length);
    expect(data.points.length).toBeGreaterThan(5);
    for (const p of data.points) {
      expect(rows.has(p.metric)).toBe(true);
      expect(["pre_seed", "seed"]).toContain(p.stage);
      const src = benchmarks.find((x) => x.id === p.id)!;
      expect(p.x).toBe(src.value);
      expect(src.unit).toBe("usd");
      expect(p.publisher).toBe(src.publisher);
      expect(p.period).toBe(src.period);
    }
    expect(data.raise).toEqual({ x: 1_000_000, y: 0 });
    // The axis covers every mark and the raise.
    for (const p of data.points) {
      expect(p.x).toBeGreaterThanOrEqual(data.xDomain[0]);
      expect(p.x).toBeLessThanOrEqual(data.xDomain[1]);
    }
    expect(1_000_000).toBeGreaterThanOrEqual(data.xDomain[0]);
  });

  it("widens the axis when the raise is outside the benchmarks", () => {
    const small = raiseBenchmarks(benchmarks, 100_000);
    const big = raiseBenchmarks(benchmarks, 20_000_000);
    expect(small.xDomain[0]).toBeLessThanOrEqual(100_000);
    expect(big.xDomain[1]).toBeGreaterThanOrEqual(20_000_000);
  });

  it("log ticks are 1-2-5 steps that bound the range", () => {
    expect(logTicks(1_200_000, 14_000_000)).toEqual([1e6, 2e6, 5e6, 1e7, 2e7]);
    expect(logTicks(1e6, 1e6)).toEqual([1e6]);
  });

  it("uses every competitor in the data (sanity)", () => {
    expect(competitors.length).toBe(44);
    expect(rounds.length).toBeGreaterThan(0);
  });
});
