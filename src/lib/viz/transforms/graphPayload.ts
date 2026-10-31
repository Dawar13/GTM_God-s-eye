/**
 * Network graph payload (PHASE_2 S7): the compact, column-oriented format that /api/graph
 * serves to the Network view, and nothing else. Built once on the server from graph.json
 * (nodes, participation edges, co-investment edges and the ForceAtlas2 positions that
 * scripts/layout-graph.ts precomputed) joined with the records the colours and tooltips need.
 * No layout runs in the browser.
 *
 * Columns are parallel arrays indexed by node, round or link, so the JSON carries each field
 * name once. Enums are stored as indexes into the schema's own value lists.
 */
import type {
  Company,
  Competitor,
  GraphDocument,
  Investor,
  Round,
  ThesisPoint,
} from "@/lib/schema";
import {
  CONFIDENCE_LEVELS,
  INVESTOR_TYPES,
  ROUND_STAGES,
  type CompetitorLayer,
} from "@/lib/schema/enums";
import { domainOf, topDomains } from "./common";

/** Node kinds as stored in `nodes.kind`. */
export const KIND_CODES = ["investor", "company", "competitor"] as const;
/** Investor roles in a round as stored in `links.role`. */
export const ROLE_CODES = ["lead", "participant", "unspecified"] as const;
/**
 * How a company's capital raised is known, as stored in `nodes.basis`: not at all, the
 * record's reported `total_raised_usd`, or the sum of its known round amounts (a lower bound).
 */
export const BASIS_CODES = ["unknown", "reported", "rounds"] as const;

export type GraphPayload = {
  /** When the pipeline built graph.json (ISO date-time). */
  generatedAt: string;
  layout: GraphDocument["layout"];
  /** Interned source domains; nodes point into this list. */
  domains: string[];
  nodes: {
    id: string[];
    label: string[];
    /** ForceAtlas2 position (graph units, one decimal). */
    x: number[];
    y: number[];
    /** Index into KIND_CODES. */
    kind: number[];
    /** Pipeline weighted degree: rounds, a lead counting 1.5. */
    wd: number[];
    /** Investors: layout_thesis.cluster_id; -1 when none (and for companies). */
    cluster: number[];
    /** Investors: index into INVESTOR_TYPES; -1 when unknown (and for companies). */
    type: number[];
    /** Companies: capital raised in USD for the grey shade; null when unknown. */
    raised: (number | null)[];
    /** Index into BASIS_CODES. */
    basis: number[];
    /** Record confidence: index into CONFIDENCE_LEVELS; -1 when none. */
    conf: number[];
    /** Most-cited source domain of the record: index into `domains`; -1 when none. */
    src: number[];
    /** How many other domains the record cites. */
    srcMore: number[];
  };
  /** Competitor layer by node index (competitors only). */
  layers: Record<number, CompetitorLayer>;
  /** Rounds that have at least one investor link. */
  rounds: {
    /** Schema partial date (YYYY, YYYY-Qn, YYYY-MM or YYYY-MM-DD) or null. */
    date: (string | null)[];
    /** Index into ROUND_STAGES. */
    stage: number[];
  };
  /** One entry per investor per round (graph.json `edges`). */
  links: { inv: number[]; co: number[]; round: number[]; role: number[] };
  /** Investor pairs sharing at least two rounds (graph.json `coinvest_edges`). */
  coinvest: { a: number[]; b: number[]; rounds: number[][] };
  /** Companies and competitors with no round in our data, so not in the graph. */
  companiesWithoutRounds: number;
  /** Graph nodes dropped because the layout gave them no position. */
  unplaced: number;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

type Recorded = Pick<Investor, "sources" | "confidence">;

export function toGraphPayload({
  graph,
  investors,
  companies,
  competitors,
  rounds,
  thesis,
}: {
  graph: GraphDocument;
  investors: readonly Investor[];
  companies: readonly Company[];
  competitors: readonly Competitor[];
  rounds: readonly Round[];
  thesis: readonly ThesisPoint[];
}): GraphPayload {
  const investorById = new Map(investors.map((i) => [i.id, i]));
  const competitorById = new Map(competitors.map((c) => [c.id, c]));
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const clusterById = new Map(thesis.map((p) => [p.id, p.cluster_id]));

  // Capital raised: the reported total when the record has one, else the sum of the
  // company's known round amounts (every round in rounds.json, with or without investors).
  const roundSum = new Map<string, number>();
  for (const r of rounds) {
    if (r.amount_usd === null) continue;
    roundSum.set(r.company_id, (roundSum.get(r.company_id) ?? 0) + r.amount_usd);
  }

  const domains: string[] = [];
  const domainIndex = new Map<string, number>();
  const intern = (d: string) => {
    let k = domainIndex.get(d);
    if (k === undefined) {
      k = domains.length;
      domains.push(d);
      domainIndex.set(d, k);
    }
    return k;
  };

  const out: GraphPayload = {
    generatedAt: graph.generated_at,
    layout: graph.layout,
    domains,
    nodes: {
      id: [],
      label: [],
      x: [],
      y: [],
      kind: [],
      wd: [],
      cluster: [],
      type: [],
      raised: [],
      basis: [],
      conf: [],
      src: [],
      srcMore: [],
    },
    layers: {},
    rounds: { date: [], stage: [] },
    links: { inv: [], co: [], round: [], role: [] },
    coinvest: { a: [], b: [], rounds: [] },
    companiesWithoutRounds: 0,
    unplaced: 0,
  };

  const nodeIndex = new Map<string, number>();
  const n = out.nodes;
  for (const node of graph.nodes) {
    if (node.x === null || node.y === null) {
      out.unplaced += 1;
      continue;
    }
    const i = n.id.length;
    nodeIndex.set(node.id, i);
    n.id.push(node.id);
    n.label.push(node.label);
    n.x.push(round1(node.x));
    n.y.push(round1(node.y));
    n.wd.push(node.weighted_degree);

    let record: Recorded | undefined;
    if (node.kind === "investor") {
      const inv = investorById.get(node.id);
      record = inv;
      n.kind.push(0);
      n.cluster.push(clusterById.get(node.id) ?? -1);
      n.type.push(inv?.type ? INVESTOR_TYPES.indexOf(inv.type) : -1);
      n.raised.push(null);
      n.basis.push(0);
    } else {
      const comp = competitorById.get(node.id);
      const co: Company | Competitor | undefined = comp ?? companyById.get(node.id);
      record = co;
      n.kind.push(comp ? 2 : 1);
      if (comp) out.layers[i] = comp.layer;
      n.cluster.push(-1);
      n.type.push(-1);
      const reported = co?.total_raised_usd ?? null;
      const summed = roundSum.get(node.id) ?? null;
      if (reported !== null) {
        n.raised.push(reported);
        n.basis.push(1);
      } else if (summed !== null) {
        n.raised.push(summed);
        n.basis.push(2);
      } else {
        n.raised.push(null);
        n.basis.push(0);
      }
    }

    if (record) {
      const top = topDomains([record], 1)[0];
      const all = new Set(record.sources.map((s) => domainOf(s.url)));
      n.conf.push(CONFIDENCE_LEVELS.indexOf(record.confidence));
      n.src.push(top === undefined ? -1 : intern(top));
      n.srcMore.push(top === undefined ? 0 : all.size - 1);
    } else {
      n.conf.push(-1);
      n.src.push(-1);
      n.srcMore.push(0);
    }
  }

  const roundIndex = new Map<string, number>();
  for (const e of graph.edges) {
    const inv = nodeIndex.get(e.source);
    const co = nodeIndex.get(e.target);
    if (inv === undefined || co === undefined) continue;
    let r = roundIndex.get(e.round_id);
    if (r === undefined) {
      r = out.rounds.date.length;
      roundIndex.set(e.round_id, r);
      out.rounds.date.push(e.date);
      out.rounds.stage.push(ROUND_STAGES.indexOf(e.stage));
    }
    out.links.inv.push(inv);
    out.links.co.push(co);
    out.links.round.push(r);
    out.links.role.push(ROLE_CODES.indexOf(e.role));
  }

  for (const c of graph.coinvest_edges) {
    const a = nodeIndex.get(c.source);
    const b = nodeIndex.get(c.target);
    if (a === undefined || b === undefined) continue;
    out.coinvest.a.push(a);
    out.coinvest.b.push(b);
    out.coinvest.rounds.push(
      c.round_ids.map((id) => roundIndex.get(id)).filter((r): r is number => r !== undefined),
    );
  }

  const inGraph = new Set(graph.nodes.map((g) => g.id));
  const companyIds = new Set([...companies.map((c) => c.id), ...competitors.map((c) => c.id)]);
  for (const id of companyIds) if (!inGraph.has(id)) out.companiesWithoutRounds += 1;

  return out;
}
