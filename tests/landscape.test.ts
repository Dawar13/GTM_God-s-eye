import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { LandscapeCompany } from "@/lib/schema";
import {
  marketMapSegments,
  ROBOTICS_MAP_PERIODS,
  ROBOTICS_MAP_SEGMENTS,
  roboticsMapSegments,
  SF_STAGE_ORDER,
  sfStageGroups,
  watchEntries,
  ycEntries,
} from "@/lib/viz/transforms/landscape";
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
const sfRows = parseCsv("sf_robotics_industrial_ai_2026-11-11.csv");
const roboticsRows = parseCsv("robotics_market_map_q4_2026_2026-11-12.csv");

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
  ...sfRows.map((r, i) =>
    landscapeCompany({
      id: `land_s${i}`,
      name: r.name ?? "",
      lists: ["sf_robotics_industrial_ai"],
      segment: null,
      region: null,
      stage_as_listed: r.stage_as_listed || null,
      note: r.note || null,
    }),
  ),
  ...roboticsRows.map((r, i) =>
    landscapeCompany({
      id: `land_r${i}`,
      name: r.name ?? "",
      lists: ["robotics_market_map"],
      segment: null,
      region: null,
      robotics_map_segment: r.segment || null,
      founded_as_listed: r.founded_as_listed || null,
      description_as_listed: r.description_as_listed || null,
      founders_as_listed: (r.founders_as_listed ?? "")
        .split("+")
        .map((f) => f.trim())
        .filter(Boolean),
      note: r.note || null,
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
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
    );
    expect(yc.filter((e) => e.batch).length).toBe(ycRows.filter((r) => r.yc_batch).length);
  });
});

describe("San Francisco post and the robotics market map", () => {
  it("keeps all 108 names in the post's five stage groups, Seed to Growth", () => {
    const groups = sfStageGroups(records);
    expect(sfRows).toHaveLength(108);
    expect(groups.map((g) => g.stage)).toEqual([...SF_STAGE_ORDER]);
    for (const g of groups) {
      expect(g.names).toHaveLength(sfRows.filter((r) => r.stage_as_listed === g.stage).length);
    }
    expect(groups.map((g) => g.names.length)).toEqual([37, 29, 22, 12, 8]);
  });

  it("marks only market-map names read from logos with *", () => {
    const sfOrigin = sfStageGroups(records)
      .flatMap((g) => g.names)
      .find((n) => n.name === "Origin");
    expect(sfOrigin?.note).toMatch(/^Not linked/);
    expect(sfOrigin?.fromLogo).toBe(false);
    const mapOrigin = marketMapSegments(records)
      .flatMap((s) => [...s.india, ...s.global])
      .find((n) => n.name === "Origin");
    expect(mapOrigin?.fromLogo).toBe(true);
  });

  it("keeps the map's 189 names in its nine segments and three founding periods", () => {
    const segs = roboticsMapSegments(records);
    expect(roboticsRows).toHaveLength(189);
    expect(segs.map((s) => s.segment)).toEqual([...ROBOTICS_MAP_SEGMENTS]);
    expect(segs.reduce((n, s) => n + s.count, 0)).toBe(189);
    const inPeriod = (p: string) =>
      segs
        .flatMap((s) => s.periods)
        .filter((g) => g.period === p)
        .flatMap((g) => g.names);
    // The map's own totals: 51 of the 189 were founded in 2023 or later.
    expect(inPeriod("2023+")).toHaveLength(51);
    expect(inPeriod("2015 to 2019")).toHaveLength(93);
    for (const s of segs) {
      expect(s.periods.map((p) => p.period)).toEqual(
        ROBOTICS_MAP_PERIODS.filter((p) => s.periods.some((g) => g.period === p)),
      );
      expect(s.count).toBe(roboticsRows.filter((r) => r.segment === s.segment).length);
    }
  });

  it("lists the ten teams with the post's one-liners and founders", () => {
    const watch = watchEntries(records);
    expect(watch).toHaveLength(10);
    const tacta = watch.find((e) => e.name === "Tacta Systems");
    expect(tacta?.description).toBe(
      "a robotic hand, a tactile sensor and gloves that capture skills",
    );
    expect(tacta?.founders).toEqual(["Vikram Pavate", "Andreas Bibl"]);
    expect(watch.every((e) => e.description && e.founders.length > 0)).toBe(true);
  });
});
