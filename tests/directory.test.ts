import { describe, expect, it } from "vitest";
import { latestFund, toDirectoryRows } from "@/lib/data/directory";
import { fund, investor } from "./fixtures";

describe("latestFund", () => {
  it("picks the newest vintage, then the later close date", () => {
    const funds = [
      fund({ id: "fund_root-ventures_ii", vintage_year: 2018, close_date: "2018" }),
      fund({
        id: "fund_root-ventures_iv",
        vintage_year: 2025,
        close_date: "2025-10-10",
        close_date_precision: "day",
      }),
      fund({
        id: "fund_root-ventures_iii",
        vintage_year: 2025,
        close_date: "2025-01",
        close_date_precision: "month",
      }),
    ];
    expect(latestFund(funds)?.id).toBe("fund_root-ventures_iv");
  });

  it("ignores funds without a vintage and returns null when none have one", () => {
    expect(latestFund([fund({ vintage_year: null })])).toBeNull();
    expect(latestFund([])).toBeNull();
  });
});

describe("toDirectoryRows", () => {
  it("joins each investor with its latest fund", () => {
    const rows = toDirectoryRows(
      [investor({ seed_list_count: 2 }), investor({ id: "inv_new", name: "New", funds: [] })],
      [fund()],
    );
    expect(rows).toEqual([
      {
        id: "inv_root-ventures",
        name: "Root Ventures",
        region: "western",
        latestFundSizeUsd: 190_000_000,
        latestFundYear: 2025,
        seedListCount: 2,
      },
      {
        id: "inv_new",
        name: "New",
        region: "western",
        latestFundSizeUsd: null,
        latestFundYear: null,
        seedListCount: 0,
      },
    ]);
  });
});
