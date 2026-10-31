import { CapitalBubbles } from "@/components/charts/CapitalBubbles";
import {
  getBubbleLayout,
  getClusters,
  getDatasetGeneratedAt,
  getFunds,
  getInvestors,
} from "@/lib/data";
import { toBubbleData } from "@/lib/viz/transforms/capitalBubbles";
import { toClusterInfo } from "@/lib/viz/transforms/thesisMap";

export async function CapitalView() {
  const [investors, bubbles, funds, clusters, computedAt] = await Promise.all([
    getInvestors(),
    getBubbleLayout(),
    getFunds(),
    getClusters(),
    getDatasetGeneratedAt("layout_bubbles"),
  ]);
  return (
    <CapitalBubbles
      data={toBubbleData(investors, bubbles, funds)}
      clusters={toClusterInfo(clusters)}
      computedAt={computedAt}
    />
  );
}
