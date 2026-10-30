import type { Metadata } from "next";
import { PageCanvas } from "@/components/shell/PageCanvas";
import {
  getClusters,
  getCompanies,
  getCompetitors,
  getGraph,
  getInvestors,
  getRounds,
} from "@/lib/data";
import { formatUsd, UNKNOWN } from "@/lib/format";

export const metadata: Metadata = { title: "Data debug" };

const cell = "border-b border-rule/60 py-1 pr-4 align-top";
const head = "border-b border-rule py-1 pr-4 text-left font-medium text-ink-2";

/**
 * Phase 1 sanity page (PHASE_1 §9.4): raw rounds, cluster sizes and graph
 * metrics, to eyeball the data. Unstyled on purpose; Phase 2 replaces it.
 */
export default async function DebugPage() {
  const [rounds, companies, competitors, investors, clusters, graph] = await Promise.all([
    getRounds(),
    getCompanies(),
    getCompetitors(),
    getInvestors(),
    getClusters(),
    getGraph(),
  ]);
  const companyName = new Map([...companies, ...competitors].map((c) => [c.id, c.name]));
  const investorName = new Map(investors.map((i) => [i.id, i.name]));
  const names = (ids: string[]) =>
    ids.map((id) => investorName.get(id) ?? id).join(", ") || UNKNOWN;
  const connectors = graph.nodes
    .filter((n) => n.kind === "investor")
    .sort((a, b) => b.betweenness - a.betweenness)
    .slice(0, 25);
  const sortedRounds = [...rounds].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <PageCanvas
      title="Data debug"
      description="Raw processed data for checking. Not a product view."
    >
      <h2 className="text-sm font-semibold">Clusters ({clusters.length})</h2>
      <table className="mt-2 mb-8 text-sm">
        <thead>
          <tr>
            <th className={head}>Cluster</th>
            <th className={head}>Size</th>
            <th className={head}>Top sectors</th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((c) => (
            <tr key={c.id}>
              <td className={cell}>{c.id}</td>
              <td className={`${cell} text-right num`}>{c.size}</td>
              <td className={cell}>{c.name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-sm font-semibold">
        Connector investors by betweenness ({graph.nodes.length} nodes, {graph.edges.length} edges,{" "}
        {graph.coinvest_edges.length} co-investment pairs)
      </h2>
      <table className="mt-2 mb-8 text-sm">
        <thead>
          <tr>
            <th className={head}>Investor</th>
            <th className={head}>Degree</th>
            <th className={head}>Weighted</th>
            <th className={head}>Betweenness</th>
          </tr>
        </thead>
        <tbody>
          {connectors.map((n) => (
            <tr key={n.id}>
              <td className={cell}>{n.label}</td>
              <td className={`${cell} text-right num`}>{n.degree}</td>
              <td className={`${cell} text-right num`}>{n.weighted_degree}</td>
              <td className={`${cell} text-right num`}>{n.betweenness.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-sm font-semibold">Rounds ({rounds.length})</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className={head}>Date</th>
              <th className={head}>Company</th>
              <th className={head}>Stage</th>
              <th className={head}>Amount</th>
              <th className={head}>Leads</th>
              <th className={head}>Participants</th>
              <th className={head}>Role not stated</th>
              <th className={head}>Confidence</th>
              <th className={head}>Sources</th>
            </tr>
          </thead>
          <tbody>
            {sortedRounds.map((r) => (
              <tr key={r.id}>
                <td className={`${cell} num whitespace-nowrap`}>{r.date ?? UNKNOWN}</td>
                <td className={cell}>{companyName.get(r.company_id) ?? r.company_id}</td>
                <td className={cell}>{r.stage}</td>
                <td className={`${cell} text-right num`}>
                  {formatUsd(r.amount_usd)}
                  {r.contested ? " (contested)" : ""}
                </td>
                <td className={cell}>{names(r.lead_investor_ids)}</td>
                <td className={cell}>{names(r.participant_investor_ids)}</td>
                <td className={cell}>{names(r.unspecified_investor_ids)}</td>
                <td className={cell}>{r.confidence}</td>
                <td className={cell}>
                  {r.sources.map((s, i) => (
                    <a
                      key={s.url}
                      href={s.url.startsWith("http") ? s.url : undefined}
                      className="mr-2 underline underline-offset-2"
                    >
                      {i + 1}
                    </a>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageCanvas>
  );
}
