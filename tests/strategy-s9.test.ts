/** S9: weights, ranking, tiers, overrides storage format and the target-list table. */
import { beforeAll, describe, expect, it } from "vitest";
import { buildCsv } from "@/lib/directory/csv";
import { DEFAULT_FIT_WEIGHTS, fitScore } from "@/lib/fit/score";
import {
  decodeWeights,
  encodeWeights,
  isDefaultWeights,
  normalizeWeights,
  setWeight,
  WEIGHT_TOTAL,
} from "@/lib/fit/weights";
import { getFitFeatures, getInvestors } from "@/lib/data";
import { parseOverrides } from "@/lib/strategy/overrides";
import { clampRaise } from "@/lib/strategy/url";
import {
  autoTier,
  rankStrategy,
  rowFit,
  targetTable,
  toStrategyRows,
  toTierBoard,
  TIER_A_MIN,
  TIER_B_MIN,
  type StrategyRow,
} from "@/lib/viz/transforms/strategy";
import { FIT_FEATURE_ORDER } from "@/lib/viz/transforms/topByFit";

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe("weights", () => {
  it("defaults sum to 100 and round-trip through the URL", () => {
    expect(sum(DEFAULT_FIT_WEIGHTS)).toBe(WEIGHT_TOTAL);
    expect(encodeWeights(DEFAULT_FIT_WEIGHTS)).toBe("30,20,15,15,10,10");
    expect(decodeWeights("30,20,15,15,10,10")).toEqual(DEFAULT_FIT_WEIGHTS);
    expect(isDefaultWeights(decodeWeights("20,20,20,20,10,10"))).toBe(false);
  });

  it("bad URL values fall back to the defaults", () => {
    for (const bad of ["", "1,2,3", "30,20,15,15,10,11", "a,b,c,d,e,f", "-5,25,25,25,15,15", "200,0,0,0,0,0"]) {
      expect(decodeWeights(bad), bad).toEqual(DEFAULT_FIT_WEIGHTS);
    }
    expect(decodeWeights(null)).toEqual(DEFAULT_FIT_WEIGHTS);
  });

  it("moving one slider keeps the sum at 100 and the others in proportion", () => {
    const next = setWeight(DEFAULT_FIT_WEIGHTS, "thesis", 50);
    expect(next.thesis).toBe(50);
    expect(sum(next)).toBe(100);
    // The other five were 70 of 100 and now share 50: stage 20/70*50 = 14.3.
    expect(next.stage).toBeGreaterThan(next.adjacency);
    expect(next.adjacency).toBe(next.check);
    for (let v = 0; v <= 100; v += 7) {
      for (const n of FIT_FEATURE_ORDER) {
        const w = setWeight(DEFAULT_FIT_WEIGHTS, n, v);
        expect(sum(w), `${n}=${v}`).toBe(100);
        expect(w[n]).toBe(v);
        for (const m of FIT_FEATURE_ORDER) expect(w[m]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("handles 100 and the all-zero remainder", () => {
    const all = setWeight(DEFAULT_FIT_WEIGHTS, "stage", 100);
    expect(all.stage).toBe(100);
    expect(sum(all)).toBe(100);
    const back = setWeight(all, "stage", 40);
    expect(sum(back)).toBe(100);
    expect(back.thesis).toBeGreaterThan(0);
  });

  it("normalizeWeights scales to 100 and falls back for all zero", () => {
    expect(sum(normalizeWeights({ thesis: 1, stage: 1, check: 1 }))).toBe(100);
    expect(normalizeWeights({})).toEqual(DEFAULT_FIT_WEIGHTS);
  });
});

describe("raise input", () => {
  it("clamps to the field's range", () => {
    expect(clampRaise(1_000_000)).toBe(1_000_000);
    expect(clampRaise(5)).toBe(100_000);
    expect(clampRaise(5e9)).toBe(20_000_000);
    expect(clampRaise(Number.NaN)).toBe(1_000_000);
  });
});

describe("tier overrides storage", () => {
  it("keeps valid entries and drops the rest", () => {
    expect(parseOverrides('{"inv_a":"A","inv_b":"C","inv_c":"Z","x":"A"}')).toEqual({
      inv_a: "A",
      inv_b: "C",
    });
    expect(parseOverrides("not json")).toEqual({});
    expect(parseOverrides("[1]")).toEqual({});
    expect(parseOverrides(null)).toEqual({});
  });
});

describe("ranking, tiers and export on the real data", () => {
  let rows: StrategyRow[];
  beforeAll(async () => {
    const [inv, fits] = await Promise.all([getInvestors(), getFitFeatures()]);
    rows = toStrategyRows(inv, fits);
  });

  it("scores equal the stored-feature score at the pipeline's raise", async () => {
    const fits = await getFitFeatures();
    const byId = new Map(fits.map((f) => [f.investor_id, f]));
    for (const row of rows) {
      const stored = byId.get(row.id);
      const mine = rowFit(row, 1_000_000);
      if (!stored) {
        expect(mine).toBeNull();
        continue;
      }
      expect(fitScore(mine!).total).toBeCloseTo(fitScore(stored).total, 9);
    }
  });

  it("ranks reliable investors first, best to worst, then sparse ones", () => {
    const ranked = rankStrategy(rows, DEFAULT_FIT_WEIGHTS, 1_000_000);
    expect(ranked.length).toBe(rows.filter((r) => r.features).length);
    ranked.forEach((r, i) => expect(r.rank).toBe(i + 1));
    const firstSparse = ranked.findIndex((r) => !r.reliable);
    expect(firstSparse).toBeGreaterThan(0);
    expect(ranked.slice(firstSparse).every((r) => !r.reliable)).toBe(true);
    for (let i = 1; i < firstSparse; i++) {
      expect(ranked[i - 1]!.score.total).toBeGreaterThanOrEqual(ranked[i]!.score.total);
    }
  });

  it("a different raise changes only the check feature's contribution", () => {
    const a = rankStrategy(rows, DEFAULT_FIT_WEIGHTS, 1_000_000);
    const b = rankStrategy(rows, DEFAULT_FIT_WEIGHTS, 20_000_000);
    const bById = new Map(b.map((r) => [r.row.id, r]));
    let changed = 0;
    for (const r of a) {
      const o = bById.get(r.row.id)!;
      for (const n of FIT_FEATURE_ORDER) {
        if (n === "check") continue;
        const x = r.score.contributions[n];
        const y = o.score.contributions[n];
        // Weights are normalised over the known features, which a raise does not change.
        expect(y === null ? null : Math.round(y * 1e9)).toBe(x === null ? null : Math.round(x * 1e9));
      }
      if (r.score.contributions.check !== o.score.contributions.check) changed += 1;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it("starting tiers follow the score cut-offs; sparse always start in C", () => {
    expect(autoTier(TIER_A_MIN, [])).toBe("A");
    expect(autoTier(TIER_A_MIN - 0.01, [])).toBe("B");
    expect(autoTier(TIER_B_MIN, [])).toBe("B");
    expect(autoTier(TIER_B_MIN - 0.01, [])).toBe("C");
    expect(autoTier(99, ["sparse"])).toBe("C");
    expect(autoTier(99, ["conflict"])).toBe("A");
    const ranked = rankStrategy(rows, DEFAULT_FIT_WEIGHTS, 1_000_000);
    const board = toTierBoard(ranked, {});
    expect(board.A.length + board.B.length + board.C.length).toBe(ranked.length);
  });

  it("an override moves one investor and nothing else", () => {
    const ranked = rankStrategy(rows, DEFAULT_FIT_WEIGHTS, 1_000_000);
    const plain = toTierBoard(ranked, {});
    const target = plain.C[0]!;
    const board = toTierBoard(ranked, { [target.row.id]: "A" });
    expect(board.A.length).toBe(plain.A.length + 1);
    expect(board.C.length).toBe(plain.C.length - 1);
    expect(board.A.some((r) => r.row.id === target.row.id)).toBe(true);
    // Rank order is kept inside a tier.
    const ranks = board.A.map((r) => r.rank);
    expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
  });

  it("target table: one row per ranked investor, unknown features blank, manual tiers marked", () => {
    const ranked = rankStrategy(rows, DEFAULT_FIT_WEIGHTS, 1_000_000);
    const t = targetTable(ranked, DEFAULT_FIT_WEIGHTS, 1_000_000, { [ranked[0]!.row.id]: "C" });
    expect(t.rows.length).toBe(ranked.length);
    for (const r of t.rows) expect(r.length).toBe(t.header.length);
    const col = (name: string) => t.header.indexOf(name);
    expect(t.header[col("Thesis match points (weight 30)")]).toBeDefined();
    expect(t.rows[0]![col("Tier source")]).toBe("manual");
    expect(t.rows[1]![col("Tier source")]).toBe("auto");
    expect(t.rows[0]![col("Outreach tier")]).toBe("C");
    const total = col("Fit total (0-100)");
    ranked.forEach((r, i) => expect(t.rows[i]![total]).toBe(r.score.total));
    // A feature with no value is a blank cell, never 0.
    const withUnknown = ranked.findIndex((r) => Object.values(r.score.contributions).includes(null));
    expect(withUnknown).toBeGreaterThanOrEqual(0);
    const unknownName = FIT_FEATURE_ORDER.find((n) => ranked[withUnknown]!.score.contributions[n] === null)!;
    const idx = FIT_FEATURE_ORDER.indexOf(unknownName) + 2;
    expect(t.rows[withUnknown]![idx]).toBeNull();
    // Only stored URLs: application URL is blank unless the record has one.
    const app = col("Application URL");
    ranked.forEach((r, i) => expect(t.rows[i]![app]).toBe(r.row.applicationUrl));
  });

  it("the CSV guards formulas and starts with a byte-order mark", () => {
    const csv = buildCsv(["a", "b"], [["=SUM(1)", 2.5], ["x,y", null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'=SUM(1)");
    expect(csv).toContain('"x,y"');
    expect(csv.includes("\r\n")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
