import type { Metadata } from "next";
import {
  FoundedVsRaisedChart,
  FundingTimelineChart,
  OverlapHeatmap,
} from "@/components/charts/CompetitorCharts";
import { CompetitorSankey } from "@/components/charts/CompetitorSankey";
import { CompetitorsTable } from "@/components/charts/CompetitorsTable";
import { LayerMap } from "@/components/charts/LayerMap";
import { PhysicalAiLandscape } from "@/components/charts/PhysicalAiLandscape";
import { PageCanvas } from "@/components/shell/PageCanvas";
import {
  getClusters,
  getCompetitorOverlap,
  getCompetitors,
  getInvestors,
  getLandscapeCompanies,
  getRounds,
  getThesisLayout,
} from "@/lib/data";
import {
  foundedVsRaised,
  fundingTimeline,
  overlapMatrix,
} from "@/lib/viz/transforms/competitorCharts";
import { competitorOverview } from "@/lib/viz/transforms/competitorOverview";
import { competitorFlows } from "@/lib/viz/transforms/competitorSankey";
import {
  marketMapSegments,
  roboticsMapSegments,
  sfStageGroups,
  watchEntries,
  ycEntries,
} from "@/lib/viz/transforms/landscape";
import { toClusterInfo } from "@/lib/viz/transforms/thesisMap";
import { competitorSources, layerMap, toCompetitorRows } from "@/lib/viz/transforms/competitors";

export const metadata: Metadata = { title: "Competitors" };

export default async function CompetitorsPage() {
  const [competitors, rounds, investors, overlap, thesis, clusters, landscape] = await Promise.all([
    getCompetitors(),
    getRounds(),
    getInvestors(),
    getCompetitorOverlap(),
    getThesisLayout(),
    getClusters(),
    getLandscapeCompanies(),
  ]);
  const rows = toCompetitorRows(competitors, rounds, investors);
  const sources = competitorSources(competitors, rounds);
  const flows = competitorFlows(competitors, rounds, investors);
  return (
    <PageCanvas
      title="Competitors"
      description={`All ${rows.length} competitors: where each sits, what it has raised and who backs it. Investor filters don't apply on this page, so every competitor is always shown.`}
    >
      <div className="flex flex-col gap-6">
        <CompetitorSankey data={flows} overview={competitorOverview(flows, rounds)} />
        <CompetitorsTable rows={rows} sources={sources} />
        <FoundedVsRaisedChart data={foundedVsRaised(rows)} sources={sources} />
        <div id="funding-timeline" className="scroll-mt-4">
          <FundingTimelineChart data={fundingTimeline(rows, rounds)} />
        </div>
        <OverlapHeatmap
          data={overlapMatrix(overlap, rows, investors, thesis, rounds)}
          clusters={toClusterInfo(clusters)}
        />
        <LayerMap data={layerMap(rows)} sources={sources} />
        <PhysicalAiLandscape
          segments={marketMapSegments(landscape)}
          yc={ycEntries(landscape)}
          sf={sfStageGroups(landscape)}
          robotics={roboticsMapSegments(landscape)}
          watch={watchEntries(landscape)}
        />
      </div>
    </PageCanvas>
  );
}
