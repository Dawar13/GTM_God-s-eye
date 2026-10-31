import { describe, expect, it } from "vitest";
import { groupNotesByTopic, INDIA_TOPICS } from "@/lib/finance";
import { formatPartialDate, UNKNOWN } from "@/lib/format";
import { JURISDICTION_LABELS, LEGAL_TOPIC_LABELS } from "@/lib/format/labels";

describe("groupNotesByTopic", () => {
  const notes = [
    { id: "a", topic: "angel_tax" as const, last_verified: "2026-01-01" },
    { id: "b", topic: "ccps" as const, last_verified: "2026-10-30" },
    { id: "c", topic: "angel_tax" as const, last_verified: "2026-10-30" },
  ];

  it("groups in topic order, newest verification first, leaving out empty topics", () => {
    const groups = groupNotesByTopic(notes);
    expect(groups.map((g) => g.topic)).toEqual(["ccps", "angel_tax"]);
    expect(groups[1]?.notes.map((n) => n.id)).toEqual(["c", "a"]);
  });

  it("keeps every note exactly once", () => {
    expect(groupNotesByTopic(notes).flatMap((g) => g.notes)).toHaveLength(notes.length);
  });
});

describe("India labels and dates", () => {
  it("labels every topic the page shows, and every jurisdiction", () => {
    for (const t of INDIA_TOPICS) expect(LEGAL_TOPIC_LABELS[t]).toBeTruthy();
    expect(Object.keys(JURISDICTION_LABELS).sort()).toEqual(["india", "us", "us_delaware"]);
  });

  it.each([
    ["2026", "2026"],
    ["2026-Q1", "Q1 2026"],
    ["2026-03", "Mar 2026"],
    ["2026-03-12", "12 Mar 2026"],
    ["2026-10-01", "1 Oct 2026"],
    [null, UNKNOWN],
    ["soon", UNKNOWN],
  ])("formats %s as %s", (input, expected) => {
    expect(formatPartialDate(input)).toBe(expected);
  });
});
