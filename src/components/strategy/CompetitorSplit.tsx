"use client";

import { useState } from "react";
import { ChartFrame } from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { formatCount, formatPartialDate, UNKNOWN } from "@/lib/format";
import { COMPETITOR_CATEGORY_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import type {
  BackedCompetitor,
  BackerSplit,
  ClassifiedBacker,
  SignalReason,
} from "@/lib/viz/transforms/competitorInvestors";

const PAGE = 12;

const REASON: Record<SignalReason, string> = {
  direct_older: "Direct competitor, but the round is more than 24 months old",
  direct_undated: "Direct competitor, but the round has no date",
  not_direct: "Adjacent or remote competitors only",
};

function backedLabel(b: BackedCompetitor): string {
  return `${b.name} (${COMPETITOR_CATEGORY_LABELS[b.category]}, ${b.latestDate ? formatPartialDate(b.latestDate) : UNKNOWN})`;
}

function Column({
  title,
  note,
  list,
  empty,
}: {
  title: string;
  note: string;
  list: readonly ClassifiedBacker[];
  empty: string;
}) {
  const { open } = useInspector();
  const [limit, setLimit] = useState(PAGE);
  const visible = list.slice(0, limit);
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <header>
        <h4 className="flex items-baseline justify-between gap-3 text-base font-semibold">
          <span>{title}</span>
          <span className="text-sm tabular-nums">{formatCount(list.length)}</span>
        </h4>
        <p className="text-sm text-ink-2">{note}</p>
      </header>
      {list.length === 0 && <p className="text-sm text-ink-2">{empty}</p>}
      <ul className="flex flex-col">
        {visible.map((b) => (
          <li key={b.investorId} className="flex flex-col gap-0.5 border-t border-rule py-2 first:border-t-0">
            <button
              type="button"
              onClick={() => open(b.investorId)}
              className="w-fit max-w-full truncate rounded-sm text-left text-sm font-medium text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
            >
              {b.name}
            </button>
            <p className="text-xs text-ink-2">
              {b.backed.map(backedLabel).join("; ")}
            </p>
            {b.reason && <p className="text-xs text-muted">{REASON[b.reason]}</p>}
          </li>
        ))}
      </ul>
      {visible.length < list.length && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setLimit((n) => n + PAGE)}
        >
          Show {formatCount(Math.min(PAGE, list.length - visible.length))} more
        </Button>
      )}
    </section>
  );
}

/** Investors who backed a tracked competitor: likely conflicts apart from thesis signals. */
export function CompetitorSplit({
  split,
  sources,
}: {
  split: BackerSplit;
  sources: readonly string[];
}) {
  const total = split.conflict.length + split.signal.length;
  return (
    <ChartFrame
      title="Investors who backed a competitor"
      subtitle="Likely conflicts first; thesis signals are investors who backed a tracked competitor without being flagged."
      legend={
        <p className="max-w-[90ch] text-xs text-muted">
          Likely conflict: the pipeline&apos;s flag, backed a direct competitor in a round dated in
          the last 24 months. Thesis signal: named in a round of any tracked competitor but not
          flagged, for example an older round or an adjacent competitor. Each competitor shows its
          category and the latest round the investor is in.
        </p>
      }
      sources={sources}
      filteredOut={split.hiddenByFilters}
      notShown={{ count: 0, field: "a competitor round", noun: "investors" }}
      height={120}
      state={
        total === 0
          ? { status: "empty", message: "No investor who backed a tracked competitor matches the filters." }
          : { status: "ready" }
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Column
          title="Likely conflict"
          note="Backed a direct competitor in the last 24 months"
          list={split.conflict}
          empty="None match the current filters."
        />
        <Column
          title="Thesis signal"
          note="Backed a tracked competitor, not flagged as a conflict"
          list={split.signal}
          empty="None match the current filters."
        />
      </div>
    </ChartFrame>
  );
}
