/**
 * "Our round": URL contract, validation, storage, fitForRound, instrument matching, calculator
 * seeds, and consistency between the Directory, Strategy and Command at non-default raises.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { getFitFeatures, getFunds, getInvestors } from "@/lib/data";
import { toDirectoryRows, withRoundFit, type DirectoryRow } from "@/lib/data/directory";
import { sortRows } from "@/lib/directory/sort";
import { checkFeature } from "@/lib/fit/check";
import { DEFAULT_FIT_WEIGHTS, fitScore } from "@/lib/fit/score";
import {
  clampRaise,
  DEFAULT_ROUND,
  formatRound,
  isDefaultRound,
  parseStoredRound,
  safeTabFor,
  serializeStoredRound,
  validateRaise,
} from "@/lib/round";
import { compactFit, fitForRound, fitsForRound } from "@/lib/round/fit";
import {
  countByInstrument,
  instrumentsNamed,
  instrumentSummary,
  matchInstrument,
} from "@/lib/round/instrument";
import { startingAmount, startingSafeTab } from "@/lib/round/seed";
import { parseRound, serializeRound } from "@/lib/round/url";
import { rankStrategy, toStrategyRows } from "@/lib/viz/transforms/strategy";
import { topByFit } from "@/lib/viz/transforms/topByFit";

describe("round URL contract", () => {
  it("leaves the defaults out and keeps the raise param name", () => {
    expect(serializeRound(DEFAULT_ROUND)).toBe("");
    expect(serializeRound({ raise: 3_000_000, inst: "post_money_safe" })).toBe("raise=3000000");
    expect(serializeRound({ raise: 3_000_000, inst: "convertible_note" })).toBe(
      "raise=3000000&inst=convertible_note",
    );
  });

  it("parses what it serialises", () => {
    for (const r of [
      DEFAULT_ROUND,
      { raise: 250_000, inst: "pre_money_safe" as const },
      { raise: 12_500_000, inst: "priced_round" as const },
    ]) {
      expect(parseRound(serializeRound(r))).toEqual(r);
    }
  });

  it("clamps an out-of-range raise and ignores unknown text", () => {
    expect(parseRound("raise=5").raise).toBe(100_000);
    expect(parseRound("raise=9e12").raise).toBe(20_000_000);
    expect(parseRound("raise=abc&inst=nope")).toEqual(DEFAULT_ROUND);
    expect(parseRound("region=india").raise).toBe(1_000_000);
    expect(clampRaise(Number.NaN)).toBe(1_000_000);
  });
});

describe("validation", () => {
  it("accepts a positive, finite raise inside the range", () => {
    expect(validateRaise(1_000_000)).toEqual({ ok: true, value: 1_000_000 });
    expect(validateRaise(100_000).ok).toBe(true);
    expect(validateRaise(20_000_000).ok).toBe(true);
  });

  it("rejects zero, negative, non-finite and out-of-range values with a message", () => {
    for (const bad of [0, -5, Number.NaN, Infinity, 99_999, 20_000_001, "1000000", null]) {
      const r = validateRaise(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message.length).toBeGreaterThan(10);
    }
  });
});

describe("remembered round", () => {
  it("round-trips and drops anything invalid", () => {
    const r = { raise: 3_000_000, inst: "convertible_note" as const };
    expect(parseStoredRound(serializeStoredRound(r))).toEqual(r);
    expect(parseStoredRound(null)).toBeNull();
    expect(parseStoredRound("not json")).toBeNull();
    expect(parseStoredRound('{"raise":0,"inst":"post_money_safe"}')).toBeNull();
    expect(parseStoredRound('{"raise":1000000,"inst":"warrant"}')).toBeNull();
  });

  it("labels and defaults", () => {
    expect(formatRound(DEFAULT_ROUND)).toBe("$1M · Post-money SAFE");
    expect(isDefaultRound(DEFAULT_ROUND)).toBe(true);
    expect(isDefaultRound({ raise: 2_000_000, inst: "post_money_safe" })).toBe(false);
    expect(safeTabFor("pre_money_safe")).toBe("pre");
    expect(safeTabFor("priced_round")).toBeNull();
  });
});

describe("instrument matching", () => {
  it("reads the instruments a free-text value names, never inventing one", () => {
    expect(instrumentsNamed("post-money SAFE, priced equity").sort()).toEqual([
      "post_money_safe",
      "priced_round",
    ]);
    expect(instrumentsNamed("Pre-money SAFE")).toEqual(["pre_money_safe"]);
    expect(instrumentsNamed("SAFE").sort()).toEqual(["post_money_safe", "pre_money_safe"]);
    expect(instrumentsNamed("convertible note")).toEqual(["convertible_note"]);
    expect(instrumentsNamed("warrant")).toEqual([]);
  });

  it("separates match, other and not stated", () => {
    expect(matchInstrument("post-money SAFE", "post_money_safe")).toBe("match");
    expect(matchInstrument("post-money SAFE", "pre_money_safe")).toBe("other");
    expect(matchInstrument("warrant", "post_money_safe")).toBe("other");
    expect(matchInstrument(null, "post_money_safe")).toBe("not_stated");
    expect(matchInstrument("  ", "post_money_safe")).toBe("not_stated");
  });

  it("counts and describes them", () => {
    const items = [
      { instrument: "post-money SAFE" },
      { instrument: "priced equity" },
      { instrument: null },
      { instrument: null },
    ];
    const c = countByInstrument(items, "post_money_safe");
    expect(c).toEqual({ match: 1, other: 1, notStated: 2 });
    expect(instrumentSummary(c, "post_money_safe")).toContain("1 name post-money SAFE");
    expect(instrumentSummary(c, "post_money_safe")).toContain("2 do not state one");
  });
});

describe("calculator seeds", () => {
  it("start from our round when the link has no value; the link wins", () => {
    expect(startingAmount(null, 3_000_000)).toBe(3_000_000);
    expect(startingAmount(1_000_000, 3_000_000)).toBe(1_000_000);
    expect(startingSafeTab(null, "pre_money_safe")).toBe("pre");
    expect(startingSafeTab(null, "post_money_safe")).toBe("post");
    expect(startingSafeTab(null, "convertible_note")).toBe("post");
    expect(startingSafeTab("both", "pre_money_safe")).toBe("both");
  });
});

describe("fitForRound", () => {
  let d: {
    investors: Awaited<ReturnType<typeof getInvestors>>;
    fits: Awaited<ReturnType<typeof getFitFeatures>>;
    rows: DirectoryRow[];
  };
  beforeAll(async () => {
    const [investors, funds, fits] = await Promise.all([
      getInvestors(),
      getFunds(),
      getFitFeatures(),
    ]);
    d = { investors, fits, rows: toDirectoryRows(investors, funds, fits) };
  });

  it("changes only the check feature and keeps the stored values at $1M", () => {
    const byId = new Map(d.investors.map((i) => [i.id, i]));
    for (const f of d.fits) {
      const inv = byId.get(f.investor_id)!;
      const input = {
        checkMinUsd: inv.check_min_usd,
        checkMaxUsd: inv.check_max_usd,
        leads: inv.leads,
      };
      const at1m = fitForRound(f, input, 1_000_000);
      expect(at1m.features.check?.value ?? null).toBe(f.features.check?.value ?? null);
      const at3m = fitForRound(f, input, 3_000_000);
      expect(at3m.features.check?.value ?? null).toBe(checkFeature(input, 3_000_000));
      for (const n of ["thesis", "stage", "adjacency", "geography", "dry_powder"] as const) {
        expect(at3m.features[n]).toEqual(f.features[n]);
      }
      expect(at3m.flags).toEqual(f.flags);
    }
  });

  it("is the identity on scores at $1M for compact rows", () => {
    for (const row of d.rows) {
      const fit = compactFit({ ...row, flags: row.fitFlags as never }, 1_000_000);
      const stored = d.fits.find((f) => f.investor_id === row.id);
      expect(fit === null).toBe(!stored);
      if (fit && stored) {
        expect(fitScore(fit).total).toBeCloseTo(fitScore(stored).total, 9);
      }
    }
  });

  it.each([3_000_000, 250_000])(
    "Directory order, Strategy ranking and Command top 10 agree at a %d raise",
    (raise) => {
      const rows = d.rows.map((r) => withRoundFit(r, raise));
      const directory = sortRows(rows, "fit-desc").filter((r) => r.fit !== null);

      const strategy = rankStrategy(
        toStrategyRows(d.investors, d.fits),
        DEFAULT_FIT_WEIGHTS,
        raise,
      );
      expect(strategy.map((r) => r.row.id)).toEqual(directory.map((r) => r.id));
      const dirFit = new Map(rows.map((r) => [r.id, r.fit]));
      for (const r of strategy) expect(r.score.total).toBeCloseTo(dirFit.get(r.row.id) ?? NaN, 9);

      // Command: the best non-sparse investors, in the Directory's order (ties by score).
      const top = topByFit(d.investors, fitsForRound(d.investors, d.fits, raise), 10);
      const reliable = directory.filter((r) => !r.fitFlags.includes("sparse")).slice(0, 10);
      expect(top.bars.map((b) => b.total)).toEqual(reliable.map((r) => r.fit));
      for (const b of top.bars) expect(b.total).toBeCloseTo(dirFit.get(b.investorId) ?? NaN, 9);
    },
  );

  it("a different raise changes some scores", () => {
    const at1m = new Map(d.rows.map((r) => [r.id, withRoundFit(r, 1_000_000).fit]));
    const changed = d.rows.filter((r) => withRoundFit(r, 250_000).fit !== at1m.get(r.id));
    expect(changed.length).toBeGreaterThan(0);
  });
});
