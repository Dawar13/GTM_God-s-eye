import type { Metadata } from "next";
import { StrategyView } from "@/components/strategy/StrategyView";
import { PageCanvas } from "@/components/shell/PageCanvas";
import {
  getBenchmarks,
  getCompetitors,
  getFitFeatures,
  getInvestors,
  getLegalNotes,
  getRounds,
} from "@/lib/data";
import { groupNotesByTopic } from "@/lib/finance";
import type { LegalTopic } from "@/lib/schema/enums";
import { toCompetitorBackers } from "@/lib/viz/transforms/competitorInvestors";
import { competitorSources } from "@/lib/viz/transforms/competitors";
import { topDomains } from "@/lib/viz/transforms/common";
import { toStrategyRows } from "@/lib/viz/transforms/strategy";

export const metadata: Metadata = { title: "Strategy" };

export default async function StrategyPage() {
  const [investors, fits, benchmarks, competitors, rounds, notes] = await Promise.all([
    getInvestors(),
    getFitFeatures(),
    getBenchmarks(),
    getCompetitors(),
    getRounds(),
    getLegalNotes(),
  ]);
  const noteCounts = Object.fromEntries(
    groupNotesByTopic(notes).map((g) => [g.topic, g.notes.length]),
  ) as Partial<Record<LegalTopic, number>>;
  return (
    <PageCanvas
      title="Raise strategy"
      description="Who to raise from first, and how our round compares. The investor filters apply to everything here."
    >
      <StrategyView
        rows={toStrategyRows(investors, fits)}
        sources={topDomains(investors, 4)}
        benchmarks={benchmarks}
        backers={toCompetitorBackers(competitors, rounds, investors)}
        competitorSources={competitorSources(competitors, rounds)}
        noteCounts={noteCounts}
      />
    </PageCanvas>
  );
}
