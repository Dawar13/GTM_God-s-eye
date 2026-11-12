import type { LandscapeCompany } from "@/lib/schema";

/** One name on the landscape: plain text unless it links to an existing record. */
export type LandscapeName = {
  id: string;
  name: string;
  matchedId: string | null;
  note: string | null;
  /** Read off a logo on the market map; marked with * there only. */
  fromLogo: boolean;
};

export type LandscapeSegment = {
  segment: string;
  india: LandscapeName[];
  global: LandscapeName[];
  count: number;
};

export type YcEntry = LandscapeName & { batch: string | null; description: string | null };

/** One stage group of the San Francisco post, names sorted. */
export type StageGroup = { stage: string; names: LandscapeName[] };

export type WatchEntry = LandscapeName & { description: string | null; founders: string[] };

/** One segment of the robotics market map, split by founding period (empty periods left out). */
export type RoboticsSegment = {
  segment: string;
  periods: { period: string; names: LandscapeName[] }[];
  count: number;
};

/** The San Francisco post's stage groups, in funding order. */
export const SF_STAGE_ORDER = ["Seed", "Series A", "Series B", "Series C", "Growth"] as const;

/** The robotics market map's columns and rows, in the map's own order. */
export const ROBOTICS_MAP_SEGMENTS = [
  "Humanoids",
  "Robot AI & Software",
  "Warehouse & Logistics",
  "Factory Automation",
  "Hands & Touch",
  "Construction & Energy",
  "Agriculture",
  "Delivery, Food & Home",
  "Surgical & Lab",
] as const;
export const ROBOTICS_MAP_PERIODS = ["2015 to 2019", "2020 to 2022", "2023+"] as const;

/** Position of a label in a fixed order; unknown labels go last, in the order first seen. */
const rankIn = (order: readonly string[]) => (label: string) => {
  const i = order.indexOf(label);
  return i === -1 ? order.length : i;
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

const toName = (c: LandscapeCompany, onMap = false): LandscapeName => ({
  id: c.id,
  name: c.name,
  matchedId: c.matched_id,
  note: c.note,
  fromLogo: onMap && /logo/i.test(c.note ?? ""),
});

/**
 * The market map as segments (in the map's own order), each with an India and a
 * Global group. Names without a region are left out; the map always gives one.
 */
export function marketMapSegments(records: readonly LandscapeCompany[]): LandscapeSegment[] {
  const out = new Map<string, LandscapeSegment>();
  for (const c of records) {
    if (!c.lists.includes("market_map") || c.segment === null || c.region === null) continue;
    let seg = out.get(c.segment);
    if (!seg) {
      seg = { segment: c.segment, india: [], global: [], count: 0 };
      out.set(c.segment, seg);
    }
    seg[c.region].push(toName(c, true));
    seg.count += 1;
  }
  const segments = [...out.values()];
  for (const s of segments) {
    s.india.sort(byName);
    s.global.sort(byName);
  }
  return segments;
}

/** The YC list as a name-sorted list; the post's batch labels and one-liners as written. */
export function ycEntries(records: readonly LandscapeCompany[]): YcEntry[] {
  return records
    .filter((c) => c.lists.includes("yc_physical_ai"))
    .map((c) => ({ ...toName(c), batch: c.yc_batch, description: c.description_as_listed }))
    .sort(byName);
}

/**
 * The San Francisco post as its stage groups (Seed to Growth, then any other label in the
 * order first seen), names sorted. Stage labels are the post's own and unverified.
 */
export function sfStageGroups(records: readonly LandscapeCompany[]): StageGroup[] {
  const out = new Map<string, LandscapeName[]>();
  for (const c of records) {
    if (!c.lists.includes("sf_robotics_industrial_ai") || c.stage_as_listed === null) continue;
    const names = out.get(c.stage_as_listed) ?? [];
    names.push(toName(c));
    out.set(c.stage_as_listed, names);
  }
  const rank = rankIn(SF_STAGE_ORDER);
  return [...out.entries()]
    .map(([stage, names]) => ({ stage, names: names.sort(byName) }))
    .sort((a, b) => rank(a.stage) - rank(b.stage));
}

/**
 * The robotics market map as its segments (the map's column order), each split by founding
 * period (the map's row order), names sorted. Segments and periods are the map's own labels.
 */
export function roboticsMapSegments(records: readonly LandscapeCompany[]): RoboticsSegment[] {
  const out = new Map<string, Map<string, LandscapeName[]>>();
  for (const c of records) {
    if (!c.lists.includes("robotics_market_map") || c.robotics_map_segment === null) continue;
    const periods = out.get(c.robotics_map_segment) ?? new Map<string, LandscapeName[]>();
    const period = c.founded_as_listed ?? "Founding period not shown";
    periods.set(period, [...(periods.get(period) ?? []), toName(c)]);
    out.set(c.robotics_map_segment, periods);
  }
  const segRank = rankIn(ROBOTICS_MAP_SEGMENTS);
  const periodRank = rankIn(ROBOTICS_MAP_PERIODS);
  return [...out.entries()]
    .map(([segment, periods]) => {
      const groups = [...periods.entries()]
        .map(([period, names]) => ({ period, names: names.sort(byName) }))
        .sort((a, b) => periodRank(a.period) - periodRank(b.period));
      return { segment, periods: groups, count: groups.reduce((n, g) => n + g.names.length, 0) };
    })
    .sort((a, b) => segRank(a.segment) - segRank(b.segment));
}

/**
 * The robotics map's teams to watch (the ten its post names, with one-liners and founders),
 * name-sorted. Only those entries carry founders, so that is what marks them.
 */
export function watchEntries(records: readonly LandscapeCompany[]): WatchEntry[] {
  return records
    .filter((c) => c.lists.includes("robotics_market_map") && c.founders_as_listed.length > 0)
    .map((c) => ({
      ...toName(c),
      description: c.description_as_listed,
      founders: c.founders_as_listed,
    }))
    .sort(byName);
}
