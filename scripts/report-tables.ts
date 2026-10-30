/**
 * Tables for the Phase 1 hand-off report (PHASE_1 §11): top investors by the
 * default fit score with the feature breakdown, clusters with example
 * members, and data surprises (investors in several competitors, connector
 * investors by betweenness). Prints Markdown; docs/PHASE_1_REPORT.md embeds it.
 *
 *   pnpm report:tables > path/to/tables.md
 */
import {
  getClusters,
  getCompetitors,
  getFitFeatures,
  getGraph,
  getInvestors,
  getRounds,
} from "../src/lib/data/index";
import { DEFAULT_FIT_WEIGHTS, type FitFeatureName, fitScore } from "../src/lib/fit/score";

const TOP = 25;
const FEATURES = Object.keys(DEFAULT_FIT_WEIGHTS) as FitFeatureName[];
const cell = (s: string) => s.replaceAll("|", "\\|");
const num = (v: number | null | undefined, digits = 2) => (v == null ? "—" : v.toFixed(digits));

async function main() {
  const [investors, fits, clusters, graph, rounds, competitors] = await Promise.all([
    getInvestors(),
    getFitFeatures(),
    getClusters(),
    getGraph(),
    getRounds(),
    getCompetitors(),
  ]);
  const byId = new Map(investors.map((i) => [i.id, i]));
  const out: string[] = [];

  // Top investors by default fit, excluding sparse records (≥ 3 of 6 features unknown).
  const ranked = fits
    .filter((f) => !f.flags.includes("sparse"))
    .map((f) => ({ fit: f, score: fitScore(f), inv: byId.get(f.investor_id)! }))
    .sort((a, b) => b.score.total - a.score.total || a.inv.name.localeCompare(b.inv.name))
    .slice(0, TOP);
  out.push(
    `### Top ${TOP} investors by default fit score`,
    "",
    `Default weights (${FEATURES.map((n) => `${n} ${DEFAULT_FIT_WEIGHTS[n]}`).join(", ")}); ` +
      "investors flagged `sparse` are left out. Feature values are 0–1; — is unknown.",
    "",
    `| # | Investor | Tier | Region | Fit | Known | ${FEATURES.join(" | ")} | Flags |`,
    `|---:|---|---|---|---:|---:|${FEATURES.map(() => "---:").join("|")}|---|`,
    ...ranked.map(
      ({ fit, score, inv }, i) =>
        `| ${i + 1} | ${cell(inv.name)} | ${inv.tier ?? "—"} | ${inv.region ?? "—"} | ${score.total.toFixed(1)} | ${Math.round(100 * score.coverage)}% | ` +
        FEATURES.map((n) => num(fit.features[n]?.value)).join(" | ") +
        ` | ${fit.flags.join(", ") || "—"} |`,
    ),
    "",
  );

  // Clusters with their best-fitting members as examples.
  const scoreOf = new Map(fits.map((f) => [f.investor_id, fitScore(f).total]));
  out.push(
    "### Clusters",
    "",
    "| Cluster | Top sectors | Size | Example members (highest fit) |",
    "|---|---|---:|---|",
    ...clusters.map((c) => {
      const members = investors
        .filter((i) => i.category.cluster_id === c.index)
        .sort((a, b) => (scoreOf.get(b.id) ?? -1) - (scoreOf.get(a.id) ?? -1));
      return `| ${c.id} | ${cell(c.name)} | ${c.size} | ${cell(
        members
          .slice(0, 5)
          .map((m) => m.name)
          .join(", "),
      )} |`;
    }),
    "",
  );

  // Investors in more than one competitor.
  const competitorIds = new Set(competitors.map((c) => c.id));
  const competitorName = new Map(competitors.map((c) => [c.id, c.name]));
  const backed = new Map<string, Set<string>>();
  for (const r of rounds) {
    if (!competitorIds.has(r.company_id)) continue;
    for (const id of [
      ...r.lead_investor_ids,
      ...r.participant_investor_ids,
      ...r.unspecified_investor_ids,
    ])
      backed.set(id, (backed.get(id) ?? new Set()).add(r.company_id));
  }
  const multi = [...backed.entries()]
    .filter(([, cos]) => cos.size > 1)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
  out.push(
    "### Investors in more than one competitor",
    "",
    "| Investor | Competitors |",
    "|---|---|",
    ...multi.map(
      ([id, cos]) =>
        `| ${cell(byId.get(id)?.name ?? id)} | ${cell(
          [...cos]
            .map((c) => competitorName.get(c) ?? c)
            .sort()
            .join(", "),
        )} |`,
    ),
    "",
  );

  // Connector investors by betweenness.
  const connectors = graph.nodes
    .filter((n) => n.kind === "investor")
    .sort((a, b) => b.betweenness - a.betweenness)
    .slice(0, 10);
  out.push(
    "### Connector investors (betweenness)",
    "",
    "| Investor | Betweenness | Companies (degree) |",
    "|---|---:|---:|",
    ...connectors.map((n) => `| ${cell(n.label)} | ${n.betweenness.toFixed(4)} | ${n.degree} |`),
    "",
  );

  console.log(out.join("\n"));
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
