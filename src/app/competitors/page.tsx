import type { Metadata } from "next";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageCanvas } from "@/components/shell/PageCanvas";

export const metadata: Metadata = { title: "Competitors" };

export default function CompetitorsPage() {
  return (
    <PageCanvas
      title="Competitors"
      description="Where each competitor sits, what it has raised and who backs it."
    >
      <EmptyState phaseNote="Phase 1 profiles every company from sources; Phase 2 draws the charts.">
        Founded against total raised, funding timelines, an investor overlap matrix and a layer map
        from design intent to full-stack factory will appear here.
      </EmptyState>
    </PageCanvas>
  );
}
