/**
 * The Network view's graph payload: graph.json joined with the records its colours and
 * tooltips need, in the compact client format of `toGraphPayload`. Served by the cached
 * route handler /api/graph, which only the Network view fetches, so the graph never sits in
 * page HTML or in another view's requests.
 */
import { toGraphPayload, type GraphPayload } from "@/lib/viz/transforms/graphPayload";
import {
  getCompanies,
  getCompetitors,
  getGraph,
  getInvestors,
  getRounds,
  getThesisLayout,
} from "./index";

export async function getGraphPayload(): Promise<GraphPayload> {
  "use cache";
  const [graph, investors, companies, competitors, rounds, thesis] = await Promise.all([
    getGraph(),
    getInvestors(),
    getCompanies(),
    getCompetitors(),
    getRounds(),
    getThesisLayout(),
  ]);
  return toGraphPayload({ graph, investors, companies, competitors, rounds, thesis });
}
