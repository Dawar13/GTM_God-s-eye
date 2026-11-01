import type { LandscapeCompany } from "@/lib/schema";

/** One name on the landscape: plain text unless it links to an existing record. */
export type LandscapeName = {
  id: string;
  name: string;
  matchedId: string | null;
  note: string | null;
};

export type LandscapeSegment = {
  segment: string;
  india: LandscapeName[];
  global: LandscapeName[];
  count: number;
};

export type YcEntry = LandscapeName & { batch: string | null; description: string | null };

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

const toName = (c: LandscapeCompany): LandscapeName => ({
  id: c.id,
  name: c.name,
  matchedId: c.matched_id,
  note: c.note,
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
    seg[c.region].push(toName(c));
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
