import { ThesisMap } from "@/components/charts/ThesisMap";
import {
  getBubbleLayout,
  getClusters,
  getDatasetGeneratedAt,
  getFitFeatures,
  getInvestors,
  getThesisLayout,
} from "@/lib/data";
import { toClusterInfo, toThesisRows } from "@/lib/viz/transforms/thesisMap";

export async function ThesisMapView() {
  const [investors, layout, bubbles, fits, clusters, computedAt] = await Promise.all([
    getInvestors(),
    getThesisLayout(),
    getBubbleLayout(),
    getFitFeatures(),
    getClusters(),
    getDatasetGeneratedAt("layout_thesis"),
  ]);
  return (
    <ThesisMap
      rows={toThesisRows(investors, layout, bubbles, fits)}
      clusters={toClusterInfo(clusters)}
      computedAt={computedAt}
    />
  );
}
