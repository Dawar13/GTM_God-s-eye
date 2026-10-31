"use client";

import { useCallback, useMemo } from "react";
import { useQueryStates } from "nuqs";
import type { LegalTopic } from "@/lib/schema/enums";
import { buildCsv, targetsFilename } from "@/lib/directory/csv";
import { Panel, Skeleton } from "@/components/ui-atlas";
import { loadStrategyRows, useLoaded } from "@/lib/client-index";
import { applyFilters } from "@/lib/filters";
import { useFilters } from "@/lib/filters/use-filters";
import { setWeight } from "@/lib/fit/weights";
import { DEFAULT_FIT_WEIGHTS, type FitFeatureName } from "@/lib/fit/score";
import { INSTRUMENT_PHRASES } from "@/lib/round";
import { useRound } from "@/lib/round/use-round";
import { useTierOverrides } from "@/lib/strategy/overrides";
import { strategyParsers, strategyUrlOptions } from "@/lib/strategy/url";
import type { Benchmark } from "@/lib/schema";
import { splitBackers, type CompetitorBacker } from "@/lib/viz/transforms/competitorInvestors";
import { rankStrategy, targetTable, type StrategyRow } from "@/lib/viz/transforms/strategy";
import { CompetitorSplit } from "./CompetitorSplit";
import { RaiseBenchmarks } from "./RaiseBenchmarks";
import { RankedList } from "./RankedList";
import { StructuralQuestions } from "./StructuralQuestions";
import { TierBoard } from "./TierBoard";
import { WeightPanel } from "./WeightPanel";

/** Downloads text as a file; the browser does the saving, nothing is sent anywhere. */
function download(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const NO_ROWS: readonly StrategyRow[] = [];

/** Stands in for a section that needs the investor rows while they load (or failed to). */
function RowsPending({
  title,
  height,
  failed,
}: {
  title: string;
  height: number;
  failed: boolean;
}) {
  return (
    <Panel className="flex flex-col gap-3" aria-busy={!failed}>
      <h3 className="text-lg font-semibold">{title}</h3>
      {failed ? (
        <p role="alert" className="text-sm text-ink-2">
          The investor list could not load. Reload the page to try again.
        </p>
      ) : (
        <Skeleton className="w-full" style={{ height }} />
      )}
    </Panel>
  );
}

/**
 * The Strategy page: weights and raise from the URL, the filtered ranking, tiers and export.
 * The investor rows load from /api/strategy-rows, so they are not in the page HTML.
 */
export function StrategyView({
  sources,
  benchmarks,
  backers,
  competitorSources,
  noteCounts,
}: {
  sources: readonly string[];
  benchmarks: readonly Benchmark[];
  backers: readonly CompetitorBacker[];
  competitorSources: readonly string[];
  noteCounts: Partial<Record<LegalTopic, number>>;
}) {
  const { filters } = useFilters();
  const [{ w: weights }, setQs] = useQueryStates(strategyParsers, strategyUrlOptions);
  // Our round (raise and instrument) is app-wide: set in the top bar, read from the URL.
  const { raise: raiseUsd, inst } = useRound();
  const { overrides, move, reset } = useTierOverrides();
  const loaded = useLoaded("strategy-rows", loadStrategyRows);
  const rows = loaded.status === "ready" ? loaded.data : NO_ROWS;
  const failed = loaded.status === "error";

  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const ranked = useMemo(
    () => rankStrategy(filtered, weights, raiseUsd),
    [filtered, weights, raiseUsd],
  );
  const unscored = filtered.length - ranked.length;
  const split = useMemo(
    () =>
      splitBackers(
        backers,
        new Set(rows.filter((r) => r.flags.includes("conflict")).map((r) => r.id)),
        new Set(filtered.map((r) => r.id)),
      ),
    [backers, rows, filtered],
  );

  const onWeight = useCallback(
    (name: FitFeatureName, value: number) => {
      void setQs((prev) => ({ w: setWeight(prev.w, name, value) }));
    },
    [setQs],
  );
  const onReset = useCallback(() => {
    void setQs({ w: { ...DEFAULT_FIT_WEIGHTS } });
  }, [setQs]);

  const onExport = useCallback(() => {
    const t = targetTable(ranked, weights, raiseUsd, overrides);
    download(buildCsv(t.header, t.rows), targetsFilename());
  }, [ranked, weights, raiseUsd, overrides]);

  return (
    <div className="flex flex-col gap-6">
      <WeightPanel
        weights={weights}
        onWeight={onWeight}
        onReset={onReset}
        raiseUsd={raiseUsd}
        instrumentLabel={INSTRUMENT_PHRASES[inst]}
      />
      {failed ? (
        <RowsPending title="Ranked targets" height={0} failed />
      ) : (
        <RankedList
          ranked={ranked}
          weights={weights}
          raiseUsd={raiseUsd}
          overrides={overrides}
          sources={sources}
          unscored={unscored}
          filteredOut={rows.length - filtered.length}
          onExport={onExport}
          loading={loaded.status === "loading"}
        />
      )}
      {loaded.status === "ready" ? (
        <TierBoard ranked={ranked} overrides={overrides} onMove={move} onReset={reset} />
      ) : (
        <RowsPending title="Outreach tiers" height={360} failed={failed} />
      )}
      <RaiseBenchmarks benchmarks={benchmarks} raiseUsd={raiseUsd} instrument={inst} />
      {loaded.status === "ready" ? (
        <CompetitorSplit split={split} sources={competitorSources} />
      ) : (
        <RowsPending title="Investors who backed a competitor" height={240} failed={failed} />
      )}
      <StructuralQuestions noteCounts={noteCounts} raiseUsd={raiseUsd} instrument={inst} />
    </div>
  );
}
