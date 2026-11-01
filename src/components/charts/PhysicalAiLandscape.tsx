"use client";

import { useState } from "react";
import { Chip, Panel, Segmented } from "@/components/ui-atlas";
import { formatCount } from "@/lib/format";
import { useInspector } from "@/lib/hooks/useInspector";
import type { LandscapeName, LandscapeSegment, YcEntry } from "@/lib/viz/transforms/landscape";

type View = "market_map" | "yc_physical_ai";

const VIEWS = [
  { value: "market_map", label: "Market map" },
  { value: "yc_physical_ai", label: "YC physical AI" },
] as const;

/** A name: a button into the Inspector when it links to a record, otherwise plain text. */
function NameChip({ item }: { item: LandscapeName }) {
  const { open } = useInspector();
  if (item.matchedId) {
    const id = item.matchedId;
    return (
      <Chip
        label={item.name}
        onClick={() => open(id)}
        title="Open in the Inspector"
        className="border-accent/50 text-accent hover:bg-accent-soft hover:text-accent"
      />
    );
  }
  return (
    <span
      className="inline-flex h-7 items-center rounded-md border border-rule px-2.5 text-sm text-ink-2"
      title={item.note ?? undefined}
    >
      {item.name}
      {item.note ? <span aria-label="read from a logo">*</span> : null}
    </span>
  );
}

function Group({ label, items }: { label: string; items: LandscapeName[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h5 className="text-xs font-medium text-ink-2">
        {label} <span className="tabular-nums">({formatCount(items.length)})</span>
      </h5>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <NameChip item={i} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MarketMap({ segments }: { segments: readonly LandscapeSegment[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {segments.map((s) => (
        <Panel key={s.segment} className="flex flex-col gap-3" aria-label={s.segment}>
          <h4 className="text-sm font-semibold">
            {s.segment}{" "}
            <span className="font-normal text-ink-2 tabular-nums">({formatCount(s.count)})</span>
          </h4>
          <Group label="India" items={s.india} />
          <Group label="Global" items={s.global} />
        </Panel>
      ))}
    </div>
  );
}

function YcList({ entries }: { entries: readonly YcEntry[] }) {
  return (
    <ul className="flex flex-col divide-y divide-rule rounded-xl border border-rule bg-panel">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="sm:w-52 sm:shrink-0">
            <NameChip item={e} />
          </span>
          <span className="sm:w-12 sm:shrink-0">
            {e.batch ? (
              <span className="inline-flex h-6 items-center rounded-md bg-panel-sunk px-2 text-xs text-ink-2 tabular-nums">
                {e.batch}
              </span>
            ) : null}
          </span>
          <span className="text-sm text-ink-2">{e.description}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Physical-AI landscape (Competitors page, after the competitor sections): context from two
 * user-supplied lists. It reads its own dataset and feeds none of the competitor views or totals.
 */
export function PhysicalAiLandscape({
  segments,
  yc,
}: {
  segments: readonly LandscapeSegment[];
  yc: readonly YcEntry[];
}) {
  const [view, setView] = useState<View>("market_map");
  const mapCount = segments.reduce((n, s) => n + s.count, 0);
  const ycBatched = yc.filter((e) => e.batch).length;
  return (
    <section aria-labelledby="landscape-title" className="flex flex-col gap-3">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="landscape-title" className="text-lg font-semibold">
              Physical AI landscape
            </h3>
            <p className="max-w-3xl text-sm text-ink-2">
              Robotics and physical-AI companies from two lists you shared. They are shown for
              context and are not counted as competitors. Both lists are representative, not
              exhaustive.
            </p>
          </div>
          <Segmented label="Physical AI list" options={VIEWS} value={view} onChange={setView} />
        </div>
        <p className="text-sm text-ink-2 tabular-nums">
          {view === "market_map"
            ? `${formatCount(mapCount)} companies in ${formatCount(segments.length)} segments`
            : `${formatCount(yc.length)} startups, ${formatCount(ycBatched)} with a batch label`}
        </p>
      </header>
      {view === "market_map" ? <MarketMap segments={segments} /> : <YcList entries={yc} />}
      <p className="max-w-3xl text-xs text-ink-2">
        Sources: the market map &ldquo;Physical AI (Indian Startups &amp; Global Leaders)&rdquo; by
        Kalaiarsi Periasamy (zpisignal.com/insights), and a LinkedIn post listing YC-backed
        physical-AI startups, both supplied on 2026-11-01. Names marked * were read from logos. The
        post&rsquo;s batch labels and one-liners are its own words and are unverified. Names in
        colour match an existing record exactly and open its profile.
      </p>
    </section>
  );
}
