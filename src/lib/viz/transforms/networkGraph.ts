/**
 * Network graph data and views (PHASE_2 S7). `toGraphData` decodes the /api/graph payload
 * once; `networkView` turns the URL filters, the round filters and the mode into per-node and
 * per-edge visibility arrays that Sigma's node and edge reducers read. The graph object itself
 * is built once and never rebuilt when a filter changes.
 *
 * Two kinds of edge: a participation edge joins an investor and a company and stands for every
 * round in which that investor backed that company (graph.json has one entry per round); a
 * co-investment edge joins two investors that share at least two rounds (the pipeline's
 * MIN_SHARED_ROUNDS), weighted by the rounds they share.
 */
import { applyFilters, type FilterableInvestor, type FilterState } from "@/lib/filters";
import type { Confidence } from "@/lib/schema";
import {
  CONFIDENCE_LEVELS,
  INVESTOR_TYPES,
  ROUND_STAGES,
  type CompetitorLayer,
  type InvestorType,
  type RoundStage,
} from "@/lib/schema/enums";
import { clusterColor, COMPANY_GREY, companyGrey } from "../palette";
import { markerShapeFor, type MarkerShape } from "../markers";
import { BASIS_CODES, KIND_CODES, ROLE_CODES, type GraphPayload } from "./graphPayload";

export type NodeKind = (typeof KIND_CODES)[number];
export type Role = (typeof ROLE_CODES)[number];

export type GraphNode = {
  i: number;
  id: string;
  label: string;
  x: number;
  y: number;
  kind: NodeKind;
  /** Pipeline weighted degree (rounds; a lead counts 1.5). Node area is proportional to it. */
  wd: number;
  cluster: number | null;
  type: InvestorType | null;
  marker: MarkerShape;
  raised: number | null;
  basis: "reported" | "rounds" | null;
  layer: CompetitorLayer | null;
  confidence: Confidence | null;
  sourceDomain: string | null;
  /** Earliest and latest dated round of this node in our data. */
  firstDate: string | null;
  lastDate: string | null;
};

export type GraphRound = { date: string | null; year: number | null; stage: RoundStage };
export type GraphLink = { inv: number; co: number; round: number; role: Role; edge: number };
/** One participation edge per investor–company pair; `links` are its rounds. */
export type GraphEdge = { i: number; inv: number; co: number; links: number[] };
export type CoEdge = { i: number; a: number; b: number; rounds: number[] };

export type GraphData = {
  generatedAt: string;
  nodes: GraphNode[];
  index: Map<string, number>;
  rounds: GraphRound[];
  links: GraphLink[];
  edges: GraphEdge[];
  coEdges: CoEdge[];
  /** Participation and co-investment edge indexes per node. */
  nodeEdges: number[][];
  nodeCoEdges: number[][];
  /** First and last round year in the data (dated rounds only). */
  yearExtent: [number, number] | null;
  /** Investor types that occur, in schema order (for the colour-by-type legend). */
  typesPresent: InvestorType[];
  investorCount: number;
  companiesWithoutRounds: number;
};

/** Earlier of two schema partial dates, compared as strings (YYYY sorts before YYYY-MM). */
const earlier = (a: string | null, b: string) => (a === null || b < a ? b : a);
const later = (a: string | null, b: string) => (a === null || b > a ? b : a);

export function toGraphData(p: GraphPayload): GraphData {
  const n = p.nodes;
  const nodes: GraphNode[] = n.id.map((id, i) => {
    const kind = KIND_CODES[n.kind[i]!] ?? "company";
    const typeCode = n.type[i]!;
    const type = typeCode >= 0 ? (INVESTOR_TYPES[typeCode] ?? null) : null;
    const src = n.src[i]!;
    const more = n.srcMore[i]!;
    const domain = src >= 0 ? (p.domains[src] ?? null) : null;
    const conf = n.conf[i]!;
    const basis = BASIS_CODES[n.basis[i]!] ?? "unknown";
    return {
      i,
      id,
      label: n.label[i]!,
      x: n.x[i]!,
      y: n.y[i]!,
      kind,
      wd: n.wd[i]!,
      cluster: n.cluster[i]! >= 0 ? n.cluster[i]! : null,
      type,
      marker: kind === "investor" ? markerShapeFor(type) : "circle",
      raised: n.raised[i] ?? null,
      basis: basis === "unknown" ? null : basis,
      layer: p.layers[i] ?? null,
      confidence: conf >= 0 ? (CONFIDENCE_LEVELS[conf] ?? null) : null,
      sourceDomain: domain === null ? null : more > 0 ? `${domain} +${more} more` : domain,
      firstDate: null,
      lastDate: null,
    };
  });
  const index = new Map(nodes.map((node) => [node.id, node.i]));

  const rounds: GraphRound[] = p.rounds.date.map((date, r) => ({
    date,
    year: date ? Number(date.slice(0, 4)) : null,
    stage: ROUND_STAGES[p.rounds.stage[r]!] ?? "undisclosed",
  }));

  const nodeEdges: number[][] = nodes.map(() => []);
  const nodeCoEdges: number[][] = nodes.map(() => []);
  const edges: GraphEdge[] = [];
  const pair = new Map<string, number>();
  const links: GraphLink[] = p.links.inv.map((inv, l) => {
    const co = p.links.co[l]!;
    const key = `${inv}:${co}`;
    let e = pair.get(key);
    if (e === undefined) {
      e = edges.length;
      pair.set(key, e);
      edges.push({ i: e, inv, co, links: [] });
      nodeEdges[inv]!.push(e);
      nodeEdges[co]!.push(e);
    }
    edges[e]!.links.push(l);
    const round = p.links.round[l]!;
    const date = rounds[round]?.date ?? null;
    if (date) {
      for (const k of [inv, co]) {
        const node = nodes[k]!;
        node.firstDate = earlier(node.firstDate, date);
        node.lastDate = later(node.lastDate, date);
      }
    }
    return { inv, co, round, role: ROLE_CODES[p.links.role[l]!] ?? "unspecified", edge: e };
  });

  const coEdges: CoEdge[] = p.coinvest.a.map((a, c) => {
    const b = p.coinvest.b[c]!;
    nodeCoEdges[a]!.push(c);
    nodeCoEdges[b]!.push(c);
    return { i: c, a, b, rounds: p.coinvest.rounds[c] ?? [] };
  });

  const years = rounds.map((r) => r.year).filter((y): y is number => y !== null);
  const types = new Set(nodes.map((node) => node.type).filter((t) => t !== null));
  return {
    generatedAt: p.generatedAt,
    nodes,
    index,
    rounds,
    links,
    edges,
    coEdges,
    nodeEdges,
    nodeCoEdges,
    yearExtent: years.length ? [Math.min(...years), Math.max(...years)] : null,
    typesPresent: INVESTOR_TYPES.filter((t) => types.has(t)),
    investorCount: nodes.filter((node) => node.kind === "investor").length,
    companiesWithoutRounds: p.companiesWithoutRounds,
  };
}

/* ------------------------------------------------------------------ filters */

/**
 * 1 for each investor node that passes the URL filters, through the same `applyFilters` the
 * Directory uses (an investor missing from `universe` has every field unknown); 1 for every
 * company, which the investor filters do not apply to. Null until the universe is known.
 */
export function investorPassMask(
  data: GraphData,
  filters: FilterState,
  universe: readonly FilterableInvestor[] | null,
): Uint8Array | null {
  if (!universe) return null;
  const byId = new Map(universe.map((u) => [u.id, u]));
  const rows: FilterableInvestor[] = [];
  for (const node of data.nodes) {
    if (node.kind !== "investor") continue;
    rows.push(
      byId.get(node.id) ?? {
        id: node.id,
        region: null,
        stages: [],
        type: null,
        freshness: null,
        maturity: null,
        sectors: [],
        tier: null,
      },
    );
  }
  const pass = new Set(applyFilters(rows, filters).map((r) => r.id));
  const mask = new Uint8Array(data.nodes.length);
  for (const node of data.nodes) {
    mask[node.i] = node.kind !== "investor" || pass.has(node.id) ? 1 : 0;
  }
  return mask;
}

/** Investors the Directory lists for these filters that have no round in our data. */
export function investorsWithoutRounds(
  data: GraphData,
  filters: FilterState,
  universe: readonly FilterableInvestor[],
): number {
  return applyFilters(universe, filters).filter((u) => !data.index.has(u.id)).length;
}

export type RoundFilter = {
  /** Inclusive year range; null keeps every round, dated or not. */
  years: readonly [number, number] | null;
  /** Round stages to keep; empty keeps every stage. */
  stages: readonly RoundStage[];
};

export const ALL_ROUNDS: RoundFilter = { years: null, stages: [] };

/**
 * 1 for each round inside the date range and stage filter. Dates are compared by year, so a
 * round dated only to the year or quarter is placed exactly. With a range set, an undated
 * round cannot be placed and is left out (and counted).
 */
export function roundPassMask(data: GraphData, filter: RoundFilter): Uint8Array {
  const mask = new Uint8Array(data.rounds.length);
  const stages = filter.stages.length ? new Set(filter.stages) : null;
  data.rounds.forEach((r, k) => {
    if (stages && !stages.has(r.stage)) return;
    if (filter.years) {
      if (r.year === null || r.year < filter.years[0] || r.year > filter.years[1]) return;
    }
    mask[k] = 1;
  });
  return mask;
}

/* -------------------------------------------------------------------- views */

export const NETWORK_MODES = ["full", "ego", "coinvest", "competitors"] as const;
export type NetworkMode = (typeof NETWORK_MODES)[number];

/** Co-investment edges need this many shared rounds in view (the pipeline's MIN_SHARED_ROUNDS). */
export const MIN_SHARED_ROUNDS = 2;

export type NetworkView = {
  mode: NetworkMode;
  /** 1 = node shown. */
  node: Uint8Array;
  /** 1 = participation edge shown. */
  edge: Uint8Array;
  /** 1 = a shown participation edge includes a lead round in view. */
  lead: Uint8Array;
  /** Shared rounds in view for each co-investment edge; 0 = hidden. */
  coWeight: Uint16Array;
  /** Shown edges per node (participation edges, or co-investment edges in that mode). */
  degree: Uint32Array;
  /** Rounds in view per node (distinct rounds through shown edges). */
  roundsInView: Uint32Array;
  /** Ego centre actually used (null outside ego mode or with no usable selection). */
  centre: number | null;
  counts: {
    investors: number;
    companies: number;
    competitors: number;
    edges: number;
    /** Nodes with rounds that the URL filters or the round filters hide (before the mode). */
    hiddenByFilters: number;
    /** Undated rounds left out because a date range is set. */
    undatedHidden: number;
    /** Shown companies whose capital raised is unknown. */
    unknownCapital: number;
    /** Shown investors with no thesis cluster, and with no type. */
    noCluster: number;
    noType: number;
  };
};

export type ViewOptions = {
  mode: NetworkMode;
  /** From `investorPassMask`; null passes every investor. */
  investorPass: Uint8Array | null;
  rounds: RoundFilter;
  /** Ego centre (node index). */
  centre: number | null;
  hops: 1 | 2;
};

/**
 * The full graph under the filters: a link (one investor in one round) is in view when its
 * investor passes the URL filters and its round passes the round filters; an edge when any of
 * its links is; a node when any of its edges is.
 */
function baseVisibility(data: GraphData, investorPass: Uint8Array | null, roundPass: Uint8Array) {
  const link = new Uint8Array(data.links.length);
  const edge = new Uint8Array(data.edges.length);
  const lead = new Uint8Array(data.edges.length);
  const node = new Uint8Array(data.nodes.length);
  data.links.forEach((l, k) => {
    if (!roundPass[l.round]) return;
    if (investorPass && !investorPass[l.inv]) return;
    link[k] = 1;
    edge[l.edge] = 1;
    if (l.role === "lead") lead[l.edge] = 1;
    node[l.inv] = 1;
    node[l.co] = 1;
  });
  return { link, edge, lead, node };
}

/**
 * Ego network: nodes within `hops` steps of the centre along edges in view. The graph is
 * bipartite, so one hop from an investor reaches its companies and two hops reach their other
 * investors. The centre is always kept, and its own edges are followed even when the URL
 * filters hide it, so a selected investor outside the filters still shows its deals.
 */
export function egoNetwork(
  data: GraphData,
  edgeInView: Uint8Array,
  centreEdges: Uint8Array,
  centre: number,
  hops: 1 | 2,
): Uint8Array {
  const inSet = new Uint8Array(data.nodes.length);
  inSet[centre] = 1;
  let frontier = [centre];
  for (let h = 0; h < hops; h++) {
    const next: number[] = [];
    for (const v of frontier) {
      for (const e of data.nodeEdges[v]!) {
        const ok = v === centre ? centreEdges[e] : edgeInView[e];
        if (!ok) continue;
        const { inv, co } = data.edges[e]!;
        const other = inv === v ? co : inv;
        if (!inSet[other]) {
          inSet[other] = 1;
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  return inSet;
}

/**
 * Co-investor projection (VC↔VC): for each co-investment edge, the shared rounds that pass the
 * round filters, kept when both investors pass the URL filters and at least
 * MIN_SHARED_ROUNDS remain. Returns the weight per edge (0 = hidden).
 */
export function coInvestorProjection(
  data: GraphData,
  investorPass: Uint8Array | null,
  roundPass: Uint8Array,
  minShared = MIN_SHARED_ROUNDS,
): Uint16Array {
  const weight = new Uint16Array(data.coEdges.length);
  for (const c of data.coEdges) {
    if (investorPass && (!investorPass[c.a] || !investorPass[c.b])) continue;
    let w = 0;
    for (const r of c.rounds) if (roundPass[r]) w += 1;
    if (w >= minShared) weight[c.i] = w;
  }
  return weight;
}

/**
 * Competitor lens: every competitor in the graph, the investors with a deal in view in one of
 * them, and those investors' other deals in view. Edges are the shown investors' edges in view.
 */
export function competitorLens(
  data: GraphData,
  edgeInView: Uint8Array,
): { node: Uint8Array; edge: Uint8Array } {
  const node = new Uint8Array(data.nodes.length);
  const edge = new Uint8Array(data.edges.length);
  const backers = new Set<number>();
  for (const v of data.nodes) {
    if (v.kind !== "competitor") continue;
    node[v.i] = 1;
    for (const e of data.nodeEdges[v.i]!) if (edgeInView[e]) backers.add(data.edges[e]!.inv);
  }
  for (const inv of backers) {
    node[inv] = 1;
    for (const e of data.nodeEdges[inv]!) {
      if (!edgeInView[e]) continue;
      edge[e] = 1;
      node[data.edges[e]!.co] = 1;
    }
  }
  return { node, edge };
}

export function networkView(data: GraphData, opts: ViewOptions): NetworkView {
  const roundPass = roundPassMask(data, opts.rounds);
  const base = baseVisibility(data, opts.investorPass, roundPass);
  let node: Uint8Array = base.node;
  let edge: Uint8Array = base.edge;
  let coWeight: Uint16Array = new Uint16Array(data.coEdges.length);
  let centre: number | null = null;

  if (opts.mode === "ego" && opts.centre !== null && data.nodes[opts.centre]) {
    centre = opts.centre;
    // The centre's own rounds count even when the URL filters hide it.
    const centreEdges = new Uint8Array(data.edges.length);
    for (const e of data.nodeEdges[centre]!) {
      const { links } = data.edges[e]!;
      if (links.some((l) => roundPass[data.links[l]!.round])) centreEdges[e] = 1;
    }
    node = egoNetwork(data, base.edge, centreEdges, centre, opts.hops);
    edge = new Uint8Array(data.edges.length);
    data.edges.forEach((ed, e) => {
      const ok = ed.inv === centre || ed.co === centre ? centreEdges[e] : base.edge[e];
      if (ok && node[ed.inv] && node[ed.co]) edge[e] = 1;
    });
  } else if (opts.mode === "coinvest") {
    coWeight = coInvestorProjection(data, opts.investorPass, roundPass);
    node = new Uint8Array(data.nodes.length);
    edge = new Uint8Array(data.edges.length);
    for (const c of data.coEdges) {
      if (!coWeight[c.i]) continue;
      node[c.a] = 1;
      node[c.b] = 1;
    }
  } else if (opts.mode === "competitors") {
    ({ node, edge } = competitorLens(data, base.edge));
  }

  // A lead flag only for edges that are shown.
  const lead = new Uint8Array(data.edges.length);
  const degree = new Uint32Array(data.nodes.length);
  let edgeCount = 0;
  if (opts.mode === "coinvest") {
    for (const c of data.coEdges) {
      if (!coWeight[c.i]) continue;
      degree[c.a]! += 1;
      degree[c.b]! += 1;
      edgeCount += 1;
    }
  } else {
    data.edges.forEach((ed, e) => {
      if (!edge[e]) return;
      if (base.lead[e]) lead[e] = 1;
      degree[ed.inv]! += 1;
      degree[ed.co]! += 1;
      edgeCount += 1;
    });
  }

  // Rounds in view per node: distinct rounds through links in view on shown edges (in the
  // co-investor projection, the rounds behind the investor's shown co-investment edges).
  const roundsInView = new Uint32Array(data.nodes.length);
  const seen = new Map<number, Set<number>>();
  const addRound = (v: number, r: number) => {
    let s = seen.get(v);
    if (!s) seen.set(v, (s = new Set()));
    s.add(r);
  };
  if (opts.mode === "coinvest") {
    for (const c of data.coEdges) {
      if (!coWeight[c.i]) continue;
      for (const r of c.rounds) {
        if (!roundPass[r]) continue;
        addRound(c.a, r);
        addRound(c.b, r);
      }
    }
  } else {
    data.links.forEach((l, k) => {
      if (!edge[l.edge] || !roundPass[l.round]) return;
      if (!(base.link[k] || l.inv === centre)) return;
      addRound(l.inv, l.round);
      addRound(l.co, l.round);
    });
  }
  for (const [v, s] of seen) roundsInView[v] = s.size;

  let investors = 0;
  let companies = 0;
  let competitors = 0;
  let unknownCapital = 0;
  let noCluster = 0;
  let noType = 0;
  let baseShown = 0;
  for (const v of data.nodes) {
    if (base.node[v.i]) baseShown += 1;
    if (!node[v.i]) continue;
    if (v.kind === "investor") {
      investors += 1;
      if (v.cluster === null) noCluster += 1;
      if (v.type === null) noType += 1;
    } else {
      companies += 1;
      if (v.kind === "competitor") competitors += 1;
      if (v.raised === null) unknownCapital += 1;
    }
  }
  const undatedHidden = opts.rounds.years ? data.rounds.filter((r) => r.year === null).length : 0;

  return {
    mode: opts.mode,
    node,
    edge,
    lead,
    coWeight,
    degree,
    roundsInView,
    centre,
    counts: {
      investors,
      companies,
      competitors,
      edges: edgeCount,
      hiddenByFilters: data.nodes.length - baseShown,
      undatedHidden,
      unknownCapital,
      noCluster,
      noType,
    },
  };
}

/**
 * Layout extent of the nodes shown in this view, so the first camera view can frame them
 * rather than the whole graph. Null when no node is shown.
 */
export function viewBounds(
  data: GraphData,
  view: NetworkView,
): { x: [number, number]; y: [number, number] } | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const v of data.nodes) {
    if (!view.node[v.i]) continue;
    x0 = Math.min(x0, v.x);
    x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y);
    y1 = Math.max(y1, v.y);
  }
  return x0 === Infinity ? null : { x: [x0, x1], y: [y0, y1] };
}

/** The node and its neighbours through edges shown in this view. */
export function neighbourhood(data: GraphData, view: NetworkView, v: number): Set<number> {
  const out = new Set([v]);
  if (view.mode === "coinvest") {
    for (const c of data.nodeCoEdges[v]!) {
      if (!view.coWeight[c]) continue;
      const { a, b } = data.coEdges[c]!;
      out.add(a === v ? b : a);
    }
  } else {
    for (const e of data.nodeEdges[v]!) {
      if (!view.edge[e]) continue;
      const { inv, co } = data.edges[e]!;
      out.add(inv === v ? co : inv);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- encoding */

/** Node radius in CSS pixels at the default zoom: k·√(weighted degree), so area ∝ weighted degree. */
export const NODE_RADIUS_K = 2;
export function nodeRadius(wd: number): number {
  return NODE_RADIUS_K * Math.sqrt(Math.max(wd, 0));
}
/** Half-side of a square with the same area as a circle of radius r (side = r·√π). */
export function squareHalfSide(r: number): number {
  return (r * Math.sqrt(Math.PI)) / 2;
}

/** Investors with no thesis cluster (or no type, in type colouring). */
export const NO_GROUP_COLOR = "#4A5160";

/** Capital raised bins (USD) for the company greys: under $10M, to $100M, to $1B, $1B or more. */
export const CAPITAL_BINS = [1e7, 1e8, 1e9] as const;
const CAPITAL_STEPS = CAPITAL_BINS.length + 1;

export function capitalBin(raised: number | null): number | null {
  if (raised === null || !Number.isFinite(raised)) return null;
  const k = CAPITAL_BINS.findIndex((t) => raised < t);
  return k === -1 ? CAPITAL_BINS.length : k;
}

/**
 * Company grey by capital raised, darker = more. Known amounts take the four darker steps of
 * the #C4C9D1 → #8A919C ramp; unknown takes the lightest, #C4C9D1, and is counted.
 */
export function capitalGrey(bin: number | null): string {
  if (bin === null) return COMPANY_GREY.low;
  return companyGrey((bin + 1) / CAPITAL_STEPS, 1) ?? COMPANY_GREY.low;
}

export type ColourBy = "cluster" | "type";

/** Colour per investor type that occurs, in schema order. */
export function typeColours(types: readonly InvestorType[]): Map<InvestorType, string> {
  return new Map(types.map((t, k) => [t, clusterColor(k)]));
}

/** Base fill per node for a colouring. */
export function nodeColours(data: GraphData, by: ColourBy): string[] {
  const byType = typeColours(data.typesPresent);
  return data.nodes.map((v) => {
    if (v.kind !== "investor") return capitalGrey(capitalBin(v.raised));
    if (by === "cluster") return v.cluster === null ? NO_GROUP_COLOR : clusterColor(v.cluster);
    return v.type === null ? NO_GROUP_COLOR : (byType.get(v.type) ?? NO_GROUP_COLOR);
  });
}

/* ------------------------------------------------------------- table, search */

export type NetworkRow = GraphNode & { degree: number; roundsInView: number };

/** Shown nodes with their degree and rounds in view, heaviest first. */
export function networkRows(data: GraphData, view: NetworkView): NetworkRow[] {
  return data.nodes
    .filter((v) => view.node[v.i])
    .map((v) => ({ ...v, degree: view.degree[v.i]!, roundsInView: view.roundsInView[v.i]! }))
    .sort((a, b) => b.wd - a.wd || a.label.localeCompare(b.label));
}

/** Shown nodes whose name starts with the query, then those that contain it; heaviest first. */
export function searchNodes(
  data: GraphData,
  view: NetworkView,
  query: string,
  limit = 8,
): GraphNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: GraphNode[] = [];
  const contains: GraphNode[] = [];
  for (const v of data.nodes) {
    if (!view.node[v.i]) continue;
    const name = v.label.toLowerCase();
    if (name.startsWith(q)) starts.push(v);
    else if (name.includes(q)) contains.push(v);
  }
  const byWeight = (a: GraphNode, b: GraphNode) => b.wd - a.wd || a.label.localeCompare(b.label);
  return [...starts.sort(byWeight), ...contains.sort(byWeight)].slice(0, limit);
}

/** Most common source domains among shown nodes (each node's top domain), for the footnote. */
export function viewSources(data: GraphData, view: NetworkView, n = 4): string[] {
  const counts = new Map<string, number>();
  for (const v of data.nodes) {
    if (!view.node[v.i] || !v.sourceDomain) continue;
    const d = v.sourceDomain.split(" +")[0]!;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const out = ranked.slice(0, n).map(([d]) => d);
  if (ranked.length > n) out.push(`${ranked.length - n} more domains`);
  return out;
}

/**
 * Rounds per stage that have an investor passing the URL filters and fall in the date range
 * (the stage filter itself ignored), for the counts on the round stage chips.
 */
export function stageCounts(
  data: GraphData,
  investorPass: Uint8Array | null,
  years: RoundFilter["years"],
): Record<RoundStage, number> {
  const inRange = roundPassMask(data, { years, stages: [] });
  const live = new Uint8Array(data.rounds.length);
  for (const l of data.links) {
    if (inRange[l.round] && (!investorPass || investorPass[l.inv])) live[l.round] = 1;
  }
  const out = Object.fromEntries(ROUND_STAGES.map((s) => [s, 0])) as Record<RoundStage, number>;
  data.rounds.forEach((r, k) => {
    if (live[k]) out[r.stage] += 1;
  });
  return out;
}
