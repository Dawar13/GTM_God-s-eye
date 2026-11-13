import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER_STATE, type FilterState } from "@/lib/filters";
import type { SeedHint } from "@/lib/schema";
import {
  checkDomain,
  checkPosition,
  checkTicks,
  checkView,
  rangeText,
  sortChecks,
  tickLabel,
  toCheckRows,
} from "@/lib/viz/transforms/checkSizes";
import { fund, investor } from "./fixtures";

const MOTM = "map_of_the_money_singapore_list_2026_11_13";
const hint = (over: Partial<SeedHint> = {}): SeedHint => ({
  source_id: "vc_investing_in_india_list_2026_11_12",
  listed_focus: null,
  listed_check_or_fund: "$100,000 to $500,000",
  notes: null,
  ...over,
});
const all: FilterState = { ...DEFAULT_FILTER_STATE, region: [] };

describe("toCheckRows", () => {
  const researched = investor({
    id: "inv_a",
    name: "A",
    check_min_usd: 250_000,
    check_max_usd: 1_000_000,
    sources: [
      {
        url: "https://a.vc/about",
        title: null,
        publisher: null,
        retrieved_at: "2026-11-01",
        kind: "primary",
      },
    ],
    field_sources: { check_min_usd: [0] },
    // A researched range wins over a listed one.
    seed_hints: [hint({ listed_check_usd: { min: 1, p25: null, p75: null, max: 2 } })],
  });
  const listed = investor({
    id: "inv_b",
    name: "B",
    funds: [],
    seed_hints: [
      hint({ listed_check_usd: { min: 100_000, p25: null, p75: null, max: 500_000 } }),
      hint({
        source_id: MOTM,
        listed_check_or_fund: "first cheque $25K to $290K",
        listed_check_usd: { min: 25_000, p25: 100_000, p75: 160_000, max: 290_000 },
        listed_fund_size_usd: 25_000_000,
      }),
    ],
  });
  const textOnly = investor({ id: "inv_c", name: "C", seed_hints: [hint()] });
  const data = toCheckRows([researched, listed, textOnly], [fund({ investor_id: "inv_a" })]);

  it("keeps investors with a researched or listed range, preferring researched", () => {
    expect(data.rows.map((r) => [r.id, r.basis])).toEqual([
      ["inv_a", "researched"],
      ["inv_b", "listed"],
    ]);
    const a = data.rows[0]!;
    expect([a.min, a.max, a.sourceDomain, a.confidence]).toEqual([
      250_000,
      1_000_000,
      "a.vc",
      "medium",
    ]);
    expect([a.fundUsd, a.fundListed]).toEqual([190_000_000, false]);
  });

  it("draws a list's range with percentiles first, as a low-confidence hint", () => {
    const b = data.rows[1]!;
    expect([b.min, b.p25, b.p75, b.max]).toEqual([25_000, 100_000, 160_000, 290_000]);
    expect([b.list, b.firstCheck, b.confidence]).toEqual([
      "Map of the Money (Singapore)",
      true,
      "low",
    ]);
    expect([b.fundUsd, b.fundListed]).toEqual([25_000_000, true]);
  });

  it("spans every figure in the extent", () => {
    expect(data.extent).toEqual([25_000, 1_000_000]);
  });

  it("counts filtered-out rows and investors with no range", () => {
    const view = checkView(data, all, "researched", "smallest", [
      ...data.rows,
      { ...data.rows[0]!, id: "inv_c" },
    ]);
    expect(view.rows.map((r) => r.id)).toEqual(["inv_a"]);
    expect(view.filteredOut).toBe(1);
    expect(view.notShown).toBe(1);
    expect(view.counts).toEqual({ researched: 1, listed: 1 });
    expect(view.sources).toEqual(["a.vc"]);
  });
});

describe("ordering and the axis", () => {
  const rows = toCheckRows(
    [
      investor({ id: "inv_x", name: "X", check_min_usd: 1_000_000, check_max_usd: 5_000_000 }),
      investor({ id: "inv_y", name: "Y", check_min_usd: 50_000, check_max_usd: null }),
      investor({ id: "inv_z", name: "Z", check_min_usd: null, check_max_usd: 10_000_000 }),
    ],
    [],
  ).rows;

  it("sorts by smallest check, largest check or name; a lone bound stands for both", () => {
    expect(sortChecks(rows, "smallest").map((r) => r.name)).toEqual(["Y", "X", "Z"]);
    expect(sortChecks(rows, "largest").map((r) => r.name)).toEqual(["Z", "X", "Y"]);
    expect(sortChecks(rows, "name").map((r) => r.name)).toEqual(["X", "Y", "Z"]);
  });

  it("rounds the domain out to 1 / 2.5 / 5 steps and keeps it within $1K to $1B", () => {
    expect(checkDomain([30_000, 4_000_000])).toEqual([25_000, 5_000_000]);
    expect(checkDomain([500, 5e9])).toEqual([1_000, 1_000_000_000]);
    expect(checkDomain(null)).toEqual([10_000, 10_000_000]);
  });

  it("ticks every 1, 2.5 and 5, with powers of ten as major ticks", () => {
    expect(checkTicks([25_000, 1_000_000])).toEqual([
      { value: 25_000, major: false },
      { value: 50_000, major: false },
      { value: 100_000, major: true },
      { value: 250_000, major: false },
      { value: 500_000, major: false },
      { value: 1_000_000, major: true },
    ]);
  });

  it("places values on a log axis and clamps them to it", () => {
    expect(checkPosition(100_000, [10_000, 1_000_000])).toBe(0.5);
    expect(checkPosition(1, [10_000, 1_000_000])).toBe(0);
    expect(checkPosition(1e12, [10_000, 1_000_000])).toBe(1);
  });

  it("labels ticks and ranges with units", () => {
    expect([tickLabel(2_500), tickLabel(250_000), tickLabel(2_500_000)]).toEqual([
      "$2.5K",
      "$250K",
      "$2.5M",
    ]);
    expect(rangeText(50_000, 300_000)).toBe("$50K to $300K");
    expect(rangeText(10_000_000, null)).toBe("from $10M");
    expect(rangeText(null, 1_000_000)).toBe("up to $1M");
    expect(rangeText(100_000, 100_000)).toBe("$100K");
  });
});
