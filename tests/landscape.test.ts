import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { LandscapeCompany } from "@/lib/schema";
import { marketMapSegments, ycEntries } from "@/lib/viz/transforms/landscape";
import { landscapeCompany } from "./fixtures";

/** Minimal CSV reader: quoted fields with commas and doubled quotes; no embedded newlines. */
function parseCsv(file: string): Record<string, string>[] {
  const text = readFileSync(path.join(process.cwd(), "data", "seed", file), "utf8");
  const [head, ...lines] = text.split(/\r?\n/).filter((l) => l.length > 0);
  const cols = (head ?? "").split(",");
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
}

const mapRows = parseCsv("physical_ai_market_map_2026-11-01.csv");
const ycRows = parseCsv("yc_physical_ai_2026-11-01.csv");

const records: LandscapeCompany[] = [
  ...mapRows.map((r, i) =>
    landscapeCompany({
      id: `land_m${i}`,
      name: r.name ?? "",
      segment: r.segment ?? null,
      region: r.region === "india" ? "india" : "global",
      note: r.note || null,
    }),
  ),
  ...ycRows.map((r, i) =>
    landscapeCompany({
      id: `land_y${i}`,
      name: r.name ?? "",
      lists: ["yc_physical_ai"],
      segment: null,
      region: null,
      yc_batch: r.yc_batch || null,
      description_as_listed: r.description_as_listed || null,
    }),
  ),
];

describe("landscape grouping", () => {
  it("market-map counts per segment and region equal the CSV", () => {
    const segments = marketMapSegments(records);
    expect(segments.reduce((n, s) => n + s.count, 0)).toBe(mapRows.length);
    for (const s of segments) {
      for (const region of ["india", "global"] as const) {
        const expected = mapRows.filter((r) => r.segment === s.segment && r.region === region);
        expect(s[region]).toHaveLength(expected.length);
      }
    }
    expect(new Set(mapRows.map((r) => r.segment)).size).toBe(segments.length);
  });

  it("YC list keeps every startup, sorted by name", () => {
    const yc = ycEntries(records);
    expect(yc).toHaveLength(ycRows.length);
    const names = yc.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
    expect(yc.filter((e) => e.batch).length).toBe(ycRows.filter((r) => r.yc_batch).length);
  });
});
