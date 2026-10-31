import { describe, expect, it } from "vitest";
import type { DirectoryRow } from "@/lib/data/directory";
import { DEFAULT_VISIBLE } from "@/lib/directory/columns";
import { csvCell, csvFilename, toCsv } from "@/lib/directory/csv";
import { SORT_KEYS, parseSortKey, sortRows } from "@/lib/directory/sort";
import { markerShapeFor } from "@/lib/viz";

function row(overrides: Partial<DirectoryRow> & { id: string; name: string }): DirectoryRow {
  return {
    region: "western",
    stages: [],
    type: "vc",
    freshness: null,
    maturity: null,
    sectors: [],
    tier: null,
    checkMinUsd: null,
    checkMaxUsd: null,
    latestFundSizeUsd: null,
    latestFundYear: null,
    seedListCount: 0,
    leads: null,
    features: null,
    fit: null,
    fitCoverage: null,
    fitFlags: [],
    sourceCount: 1,
    confidence: "medium",
    ...overrides,
  };
}

const ids = (rows: DirectoryRow[]) => rows.map((r) => r.id);

describe("sort keys", () => {
  it("round-trips column and direction", () => {
    expect(SORT_KEYS).toContain("fit-desc");
    expect(parseSortKey("seedLists-asc")).toEqual({ column: "seedLists", dir: "asc" });
  });
});

describe("sortRows", () => {
  const rows = [
    row({ id: "a", name: "Alpha", fit: 60, fitCoverage: 1, latestFundSizeUsd: 50 }),
    row({ id: "b", name: "Beta", fit: 90, fitCoverage: 0.3, fitFlags: ["sparse"] }),
    row({ id: "c", name: "Gamma", fit: 75, fitCoverage: 1, latestFundSizeUsd: 10 }),
    row({ id: "d", name: "Delta", fit: null }),
  ];

  it("sorts by name, ties by id", () => {
    expect(ids(sortRows(rows, "name-asc"))).toEqual(["a", "b", "d", "c"]);
    expect(ids(sortRows(rows, "name-desc"))).toEqual(["c", "d", "b", "a"]);
  });

  it("puts sparse fits below reliable ones in both directions, and no score last", () => {
    expect(ids(sortRows(rows, "fit-desc"))).toEqual(["c", "a", "b", "d"]);
    expect(ids(sortRows(rows, "fit-asc"))).toEqual(["a", "c", "b", "d"]);
  });

  it("keeps unknown values last whichever way the column sorts", () => {
    expect(ids(sortRows(rows, "fund-asc"))).toEqual(["c", "a", "b", "d"]);
    expect(ids(sortRows(rows, "fund-desc"))).toEqual(["a", "c", "b", "d"]);
  });

  it("does not mutate its input", () => {
    const copy = [...rows];
    sortRows(rows, "fit-desc");
    expect(rows).toEqual(copy);
  });
});

describe("csv", () => {
  it("quotes commas, quotes and line breaks, and doubles quotes", () => {
    expect(csvCell('Acme, "Inc"')).toBe('"Acme, ""Inc"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("plain")).toBe("plain");
  });

  it("writes unknown as an empty cell and never as zero", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("neutralises formula starts in text only", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("@home")).toBe("'@home");
    expect(csvCell(-5)).toBe("-5");
  });

  it("exports visible columns in table order, in the given row order", () => {
    const rows = [
      row({ id: "a", name: "A, B", fit: 61.234, fitCoverage: 0.5, fitFlags: ["conflict"] }),
      row({ id: "b", name: "Zed", checkMinUsd: 1e6, checkMaxUsd: 5e6 }),
    ];
    const text = toCsv(rows, ["fit", "name", "check"]);
    const lines = text.replace("﻿", "").split("\r\n");
    expect(text.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe(
      "Name,Check min (USD),Check max (USD),Fit score (0-100),Fit coverage (%),Fit flags",
    );
    expect(lines[1]).toBe('"A, B",,,61.2,50,conflict');
    expect(lines[2]).toBe("Zed,1000000,5000000,,,");
    expect(lines).toHaveLength(4);
  });

  it("covers every default column", () => {
    const header = toCsv([], DEFAULT_VISIBLE).replace("﻿", "").split("\r\n")[0];
    expect(header).toContain("Latest fund size (USD)");
    expect(header).toContain("Fit flags");
  });

  it("names the file by date", () => {
    expect(csvFilename(new Date("2026-10-31T12:00:00Z"))).toBe(
      "utopian-autonomy-investors-2026-10-31.csv",
    );
  });
});

describe("markerShapeFor", () => {
  it("draws accelerators and incubators as squares and everything else as circles", () => {
    expect(markerShapeFor("accelerator")).toBe("square");
    expect(markerShapeFor("incubator")).toBe("square");
    expect(markerShapeFor("vc")).toBe("circle");
    expect(markerShapeFor(null)).toBe("circle");
    expect(markerShapeFor(undefined)).toBe("circle");
  });
});
