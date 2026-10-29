import type { Metadata } from "next";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageCanvas } from "@/components/shell/PageCanvas";

export const metadata: Metadata = { title: "Strategy" };

export default function StrategyPage() {
  return (
    <PageCanvas
      title="Raise strategy"
      description="Who to raise from first, and how our round compares."
    >
      <EmptyState phaseNote="Phase 1 computes fit scores and benchmarks; Phase 2 builds the ranking and sliders.">
        A fit-scored, tiered target list with adjustable weights, competitor-investor signals and
        conflicts, round benchmarks and the open entity questions will appear here.
      </EmptyState>
    </PageCanvas>
  );
}
