"use client";

import { useCallback, useMemo } from "react";
import { useQueryStates } from "nuqs";
import type { LegalTopic } from "@/lib/schema/enums";
import { buildCsv, targetsFilename } from "@/lib/directory/csv";
import { applyFilters } from "@/lib/filters";
import { useFilters } from "@/lib/filters/use-filters";
import { setWeight } from "@/lib/fit/weights";
import { DEFAULT_FIT_WEIGHTS, type FitFeatureName } from "@/lib/fit/score";
import { EXAMPLE_RAISE_USD } from "@/lib/calculators/examples";
import { useTierOverrides } from "@/lib/strategy/overrides";
import { clampRaise, strategyParsers, strategyUrlOptions } from "@/lib/strategy/url";
import type { Benchmark } from "@/lib/schema";
import {
  splitBackers,
  type CompetitorBacker,
} from "@/lib/viz/transforms/competitorInvestors";
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

/** The Strategy page: weights and raise from the URL, the filtered ranking, tiers and export. */
export function StrategyView({
  rows,
  sources,
  benchmarks,
  backers,
  competitorSources,
  noteCounts,
}: {
  rows: readonly StrategyRow[];
  sources: readonly string[];
  benchmarks: readonly Benchmark[];
  backers: readonly CompetitorBacker[];
  competitorSources: readonly string[];
  noteCounts: Partial<Record<LegalTopic, number>>;
}) {
  const { filters } = useFilters();
  const [{ w: weights, raise }, setQs] = useQueryStates(strategyParsers, strategyUrlOptions);
  const raiseUsd = clampRaise(raise);
  const { overrides, move, reset } = useTierOverrides();

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
    void setQs({ w: { ...DEFAULT_FIT_WEIGHTS }, raise: EXAMPLE_RAISE_USD });
  }, [setQs]);
  const onRaise = useCallback((v: number) => void setQs({ raise: v }), [setQs]);

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
        onRaise={onRaise}
      />
      <RankedList
        ranked={ranked}
        weights={weights}
        raiseUsd={raiseUsd}
        overrides={overrides}
        sources={sources}
        unscored={unscored}
        filteredOut={rows.length - filtered.length}
        onExport={onExport}
      />
      <TierBoard ranked={ranked} overrides={overrides} onMove={move} onReset={reset} />
      <RaiseBenchmarks benchmarks={benchmarks} raiseUsd={raiseUsd} />
      <CompetitorSplit split={split} sources={competitorSources} />
      <StructuralQuestions noteCounts={noteCounts} />
    </div>
  );
}
