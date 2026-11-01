/** S10a: column-wise row payloads for the filter index, the Directory and Strategy. */
import { describe, expect, it } from "vitest";
import { GET as directoryGet } from "@/app/api/directory-rows/route";
import { GET as filterGet } from "@/app/api/filter-index/route";
import { GET as strategyGet } from "@/app/api/strategy-rows/route";
import { getFitFeatures, getFunds, getInvestors } from "@/lib/data";
import {
  FILTERABLE_KEYS,
  fromColumns,
  joinFilterable,
  toColumns,
  type Columns,
  type Detail,
} from "@/lib/data/columns";
import {
  DIRECTORY_DETAIL_KEYS,
  toDirectoryRows,
  withRoundFit,
  type DirectoryRow,
} from "@/lib/data/directory";
import { DEFAULT_RAISE_USD } from "@/lib/round";
import type { FilterableInvestor } from "@/lib/filters";
import {
  STRATEGY_DETAIL_KEYS,
  toStrategyRows,
  type StrategyRow,
} from "@/lib/viz/transforms/strategy";

describe("toColumns and fromColumns", () => {
  const rows = [
    { id: "a", n: 1, tags: ["x"], v: null },
    { id: "b", n: 2, tags: [], v: 3 },
  ];

  it("round-trip the chosen fields in row order", () => {
    const cols = toColumns(rows, ["id", "n", "tags", "v"]);
    expect(cols).toEqual({ id: ["a", "b"], n: [1, 2], tags: [["x"], []], v: [null, 3] });
    expect(fromColumns(cols)).toEqual(rows);
  });

  it("drops fields that are not named and keeps nulls as nulls", () => {
    expect(fromColumns(toColumns(rows, ["id", "v"]))).toEqual([
      { id: "a", v: null },
      { id: "b", v: 3 },
    ]);
  });

  it("rejects columns of different lengths and handles no rows", () => {
    expect(() => fromColumns({ id: ["a"], n: [] })).toThrow(/column n/);
    expect(fromColumns({})).toEqual([]);
    expect(fromColumns(toColumns([] as typeof rows, ["id"]))).toEqual([]);
  });
});

describe("joinFilterable", () => {
  it("joins by id and gives a missing id unknown filter fields", () => {
    const index: FilterableInvestor[] = [
      {
        id: "inv_b",
        region: "western",
        stages: ["seed"],
        type: "vc",
        freshness: "fresh",
        maturity: null,
        sectors: [],
        tier: null,
        tags: [],
      },
    ];
    const joined = joinFilterable<FilterableInvestor & { name: string }>(index, [
      { id: "inv_a", name: "A" },
      { id: "inv_b", name: "B" },
    ]);
    expect(joined.map((r) => [r.id, r.name, r.region, r.stages])).toEqual([
      ["inv_a", "A", null, []],
      ["inv_b", "B", "western", ["seed"]],
    ]);
  });
});

/** What the browser rebuilds from the two route responses, exactly as client-index does. */
async function viaRoutes<T extends FilterableInvestor>(
  detailGet: () => Promise<Response>,
): Promise<T[]> {
  const index = fromColumns((await (await filterGet()).json()) as Columns<FilterableInvestor>);
  const detail = fromColumns((await (await detailGet()).json()) as Columns<Detail<T>>);
  return joinFilterable<T>(index, detail);
}

// Builds every investor row from the real data; slow when the full suite runs in parallel.
describe("route payloads on the real data", { timeout: 30_000 }, () => {
  it("rebuild the Directory rows exactly", async () => {
    const [investors, funds, fits] = await Promise.all([
      getInvestors(),
      getFunds(),
      getFitFeatures(),
    ]);
    const expected = toDirectoryRows(investors, funds, fits);
    const rows = await viaRoutes<DirectoryRow>(directoryGet);
    // The route sends the stored features, not the score; the client scores them for our raise.
    expect(rows.map((r) => withRoundFit(r, DEFAULT_RAISE_USD))).toEqual(expected);
    // Every field a Directory row has travels in one of the two payloads, except the two the
    // client computes from the features (fit and its coverage).
    expect(new Set([...FILTERABLE_KEYS, ...DIRECTORY_DETAIL_KEYS, "fit", "fitCoverage"])).toEqual(
      new Set(Object.keys(expected[0]!)),
    );
  });

  it("rebuild the Strategy rows exactly", async () => {
    const [investors, fits] = await Promise.all([getInvestors(), getFitFeatures()]);
    const expected = toStrategyRows(investors, fits);
    const rows = await viaRoutes<StrategyRow>(strategyGet);
    expect(rows).toEqual(expected);
    expect(new Set([...FILTERABLE_KEYS, ...STRATEGY_DETAIL_KEYS])).toEqual(
      new Set(Object.keys(expected[0]!)),
    );
  });

  it("are smaller than the row-object form", async () => {
    const [investors, funds, fits] = await Promise.all([
      getInvestors(),
      getFunds(),
      getFitFeatures(),
    ]);
    const objects = JSON.stringify(toDirectoryRows(investors, funds, fits)).length;
    const columns =
      (await (await filterGet()).text()).length + (await (await directoryGet()).text()).length;
    expect(columns).toBeLessThan(objects * 0.7);
  });
});
