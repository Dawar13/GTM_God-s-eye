import { NetworkGraph } from "@/components/charts/NetworkGraph";
import { getClusters } from "@/lib/data";
import { toClusterInfo } from "@/lib/viz/transforms/thesisMap";

/** The graph itself is fetched by the client from /api/graph; the page only ships cluster names. */
export async function NetworkView() {
  const clusters = await getClusters();
  return <NetworkGraph clusters={toClusterInfo(clusters)} />;
}
