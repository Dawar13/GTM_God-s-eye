"use client";

import { useMemo, useState } from "react";
import { Chip, FindBox, FindMark, Panel, Segmented } from "@/components/ui-atlas";
import { formatCount } from "@/lib/format";
import { useInspector } from "@/lib/hooks/useInspector";
import { useFindQuery } from "@/lib/search/find-state";
import { matchRecord } from "@/lib/search/match";
import { cn } from "@/lib/utils";
import type {
  LandscapeName,
  LandscapeSegment,
  RoboticsSegment,
  StageGroup,
  WatchEntry,
  YcEntry,
} from "@/lib/viz/transforms/landscape";

type View = "market_map" | "yc_physical_ai" | "sf_robotics_industrial_ai" | "robotics_market_map";

const VIEWS = [
  { value: "market_map", label: "Market map" },
  { value: "yc_physical_ai", label: "YC physical AI" },
  { value: "sf_robotics_industrial_ai", label: "San Francisco by stage" },
  { value: "robotics_market_map", label: "Robotics map Q4 2026" },
] as const;

/** Where each list came from, shown under it. */
const SOURCE_NOTE: Record<View, string> = {
  market_map:
    "Source: the market map “Physical AI (Indian Startups & Global Leaders)” by Kalaiarsi Periasamy (zpisignal.com/insights), supplied on 2026-11-01. Names marked * were read from logos.",
  yc_physical_ai:
    "Source: a LinkedIn post listing YC-backed physical-AI startups, supplied on 2026-11-01. Batch labels and one-liners are the post’s own words and are unverified.",
  sf_robotics_industrial_ai:
    "Source: the LinkedIn post “San Francisco’s Robotics & Industrial AI” by Camilla Mazzoleni (108 companies grouped by stage), supplied on 2026-11-11. Stage labels are the post’s own and are unverified. Config and Origin share a name with existing records but are not linked: the post alone does not show they are the same companies.",
  robotics_market_map:
    "Source: “The Robotics Market Map Q4 2026” (data from Crustdata): 189 robotics and humanoid startups founded since 2015, and its post naming ten teams worth watching, both supplied on 2026-11-12. Names are the map’s captions; for the ten, the post’s fuller names. Segments, founding periods, one-liners and founders are the map’s and post’s own words and are unverified. Short captions are not merged with fuller names on other lists (“Dusty” here, “Dusty Robotics” on the San Francisco post).",
};

/** "yes" or "no" while a find query is applied; undefined without one. */
type Hit = "yes" | "no" | undefined;
const hitOf = (q: string, name: string): Hit =>
  q ? (matchRecord(q, name) !== null ? "yes" : "no") : undefined;

/**
 * A name: a button into the Inspector when it links to a record, otherwise plain text. While a
 * find query is applied, non-matching names grey out (they stay in place, so the layout holds).
 */
function NameChip({ item, q }: { item: LandscapeName; q: string }) {
  const { open } = useInspector();
  const hit = hitOf(q, item.name);
  const fade = cn(
    "transition-opacity duration-(--dur-open)",
    hit === "no" && "opacity-30",
    hit === "yes" && "border-accent bg-accent-soft",
  );
  if (item.matchedId) {
    const id = item.matchedId;
    return (
      <Chip
        label={item.name}
        onClick={() => open(id)}
        title="Open in the Inspector"
        data-find-match={hit}
        className={cn("border-accent/50 text-accent hover:bg-accent-soft hover:text-accent", fade)}
      />
    );
  }
  return (
    <span
      data-find-match={hit}
      className={cn(
        "inline-flex h-7 items-center rounded-md border border-rule px-2.5 text-sm text-ink-2",
        fade,
      )}
      title={item.note ?? undefined}
    >
      <FindMark text={item.name} query={q} />
      {item.fromLogo ? <span aria-label="read from a logo">*</span> : null}
    </span>
  );
}

function Group({ label, items, q }: { label: string; items: LandscapeName[]; q: string }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h5 className="text-xs font-medium text-ink-2">
        {label} <span className="tabular-nums">({formatCount(items.length)})</span>
      </h5>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <NameChip item={i} q={q} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MarketMap({ segments, q }: { segments: readonly LandscapeSegment[]; q: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {segments.map((s) => (
        <Panel key={s.segment} className="flex flex-col gap-3" aria-label={s.segment}>
          <h4 className="text-sm font-semibold">
            {s.segment}{" "}
            <span className="font-normal text-ink-2 tabular-nums">({formatCount(s.count)})</span>
          </h4>
          <Group label="India" items={s.india} q={q} />
          <Group label="Global" items={s.global} q={q} />
        </Panel>
      ))}
    </div>
  );
}

function YcList({ entries, q }: { entries: readonly YcEntry[]; q: string }) {
  return (
    <ul className="flex flex-col divide-y divide-rule rounded-xl border border-rule bg-panel">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="sm:w-52 sm:shrink-0">
            <NameChip item={e} q={q} />
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

/** The San Francisco post: one panel per stage, names as chips. */
function StageGrid({ groups, q }: { groups: readonly StageGroup[]; q: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <Panel key={g.stage} className="flex flex-col gap-3" aria-label={g.stage}>
          <h4 className="text-sm font-semibold">
            {g.stage}{" "}
            <span className="font-normal text-ink-2 tabular-nums">
              ({formatCount(g.names.length)})
            </span>
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {g.names.map((n) => (
              <li key={n.id}>
                <NameChip item={n} q={q} />
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

/** The robotics market map: one panel per segment, names grouped by founding period. */
function RoboticsMap({ segments, q }: { segments: readonly RoboticsSegment[]; q: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {segments.map((s) => (
        <Panel key={s.segment} className="flex flex-col gap-3" aria-label={s.segment}>
          <h4 className="text-sm font-semibold">
            {s.segment}{" "}
            <span className="font-normal text-ink-2 tabular-nums">({formatCount(s.count)})</span>
          </h4>
          {s.periods.map((p) => (
            <Group key={p.period} label={`Founded ${p.period}`} items={p.names} q={q} />
          ))}
        </Panel>
      ))}
    </div>
  );
}

/** The robotics map's teams to watch: name, the post's one-liner and its founders. */
function WatchList({ entries, q }: { entries: readonly WatchEntry[]; q: string }) {
  return (
    <ul className="flex flex-col divide-y divide-rule rounded-xl border border-rule bg-panel">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-start sm:gap-4"
        >
          <span className="sm:w-60 sm:shrink-0">
            <NameChip item={e} q={q} />
          </span>
          <span className="flex flex-col gap-0.5 text-sm">
            <span className="text-ink-2">{e.description}</span>
            {e.founders.length ? (
              <span className="text-xs text-muted">Founders: {e.founders.join(", ")}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Physical-AI landscape (Competitors page, after the competitor sections): context from four
 * user-supplied lists. It reads its own dataset and feeds none of the competitor views or totals.
 */
export function PhysicalAiLandscape({
  segments,
  yc,
  sf,
  robotics,
  watch,
}: {
  segments: readonly LandscapeSegment[];
  yc: readonly YcEntry[];
  sf: readonly StageGroup[];
  robotics: readonly RoboticsSegment[];
  watch: readonly WatchEntry[];
}) {
  const [view, setView] = useState<View>("market_map");
  const mapCount = segments.reduce((n, s) => n + s.count, 0);
  const ycBatched = yc.filter((e) => e.batch).length;
  const sfCount = sf.reduce((n, g) => n + g.names.length, 0);
  const roboticsCount = robotics.reduce((n, s) => n + s.count, 0);
  const find = useFindQuery();
  const q = find.query.trim();
  // Names in the current view, and how many match the find query. The teams to watch are
  // also on the robotics map, so the map's names cover them.
  const names = useMemo(() => {
    if (view === "market_map")
      return segments.flatMap((s) => [...s.india, ...s.global]).map((n) => n.name);
    if (view === "yc_physical_ai") return yc.map((e) => e.name);
    if (view === "sf_robotics_industrial_ai") return sf.flatMap((g) => g.names).map((n) => n.name);
    return robotics.flatMap((s) => s.periods.flatMap((p) => p.names)).map((n) => n.name);
  }, [view, segments, yc, sf, robotics]);
  const matches = useMemo(
    () => (q ? names.filter((n) => matchRecord(q, n) !== null).length : names.length),
    [names, q],
  );
  return (
    <section aria-labelledby="landscape-title" className="flex flex-col gap-3">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="landscape-title" className="text-lg font-semibold">
              Physical AI landscape
            </h3>
            <p className="max-w-3xl text-sm text-ink-2">
              Robotics and physical-AI companies from four lists you shared. They are shown for
              context and are not counted as competitors. Every list is representative, not
              exhaustive; the same name on several lists is one entry.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FindBox
              label="Find in the landscape"
              value={find.input}
              onValueChange={find.setInput}
              matches={matches}
              total={names.length}
            />
            <Segmented
              label="Physical AI list"
              options={VIEWS}
              value={view}
              onChange={setView}
              className="flex-wrap"
            />
          </div>
        </div>
        <p className="text-sm text-ink-2 tabular-nums">
          {view === "market_map"
            ? `${formatCount(mapCount)} companies in ${formatCount(segments.length)} segments`
            : view === "yc_physical_ai"
              ? `${formatCount(yc.length)} startups, ${formatCount(ycBatched)} with a batch label`
              : view === "sf_robotics_industrial_ai"
                ? `${formatCount(sfCount)} companies in ${formatCount(sf.length)} stage groups`
                : `${formatCount(roboticsCount)} startups in ${formatCount(robotics.length)} segments, by founding period`}
        </p>
      </header>
      {view === "market_map" ? (
        <MarketMap segments={segments} q={q} />
      ) : view === "yc_physical_ai" ? (
        <YcList entries={yc} q={q} />
      ) : view === "sf_robotics_industrial_ai" ? (
        <StageGrid groups={sf} q={q} />
      ) : (
        <div className="flex flex-col gap-3">
          {watch.length ? (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-sm font-semibold">
                Teams the post calls worth watching{" "}
                <span className="font-normal text-ink-2 tabular-nums">
                  ({formatCount(watch.length)})
                </span>
              </h4>
              <WatchList entries={watch} q={q} />
            </div>
          ) : null}
          <RoboticsMap segments={robotics} q={q} />
        </div>
      )}
      <p className="max-w-3xl text-xs text-ink-2">
        {SOURCE_NOTE[view]} Names in colour match an existing record exactly and open its profile.
      </p>
    </section>
  );
}
