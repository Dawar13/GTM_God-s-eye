import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER_STATE, type FilterState } from "@/lib/filters";
import { toFilterable } from "@/lib/data/directory";
import { parseYears, serializeYears } from "@/lib/network/url";
import type { GraphDocument, Investor, Round, ThesisPoint } from "@/lib/schema";
import { SCHEMA_VERSION } from "@/lib/schema/version";
import { COMPANY_GREY } from "@/lib/viz/palette";
import { toGraphPayload } from "@/lib/viz/transforms/graphPayload";
import {
  ALL_ROUNDS,
  capitalBin,
  capitalGrey,
  coInvestorProjection,
  competitorLens,
  egoNetwork,
  investorPassMask,
  investorsWithoutRounds,
  neighbourhood,
  networkRows,
  networkView,
  nodeColours,
  nodeRadius,
  NO_GROUP_COLOR,
  roundPassMask,
  searchNodes,
  squareHalfSide,
  stageCounts,
  toGraphData,
  viewBounds,
  type GraphData,
  type ViewOptions,
} from "@/lib/viz/transforms/networkGraph";
import { company, competitor, investor, round } from "./fixtures";

/*
 * A small graph:
 *   A (VC, Western, cluster 0)  B (accelerator, Western)  C (India)  D (Western, cluster 1)
 *   X (company, reported $50M)  Y (company, rounds $2M + $3M)  Z (competitor, no amounts)
 *   W (company with no round, so not in the graph); E (investor with no round)
 * Rounds: r1 X seed 2024-03 (A lead, B, C) · r2 X Series A 2025 (A lead, B)
 *         r3 Y seed 2023-Q2 (A, D) · r4 Z pre-seed undated (D, C) · r5 Y seed 2026 (no investor)
 */
const inv = (id: string, over: Partial<Investor> = {}) => investor({ id, name: id, ...over });
const investors = [
  inv("inv_a", { name: "Alpha Ventures", type: "vc" }),
  inv("inv_b", { name: "Beta Accelerator", type: "accelerator" }),
  inv("inv_c", { name: "Gamma Capital", type: null, region: "india" }),
  inv("inv_d", { name: "Delta Partners", type: null }),
  inv("inv_e", { name: "Epsilon", type: "vc" }),
];
const companies = [
  company({ id: "co_x", name: "Xylo", total_raised_usd: 50_000_000 }),
  company({ id: "co_y", name: "Yarrow", total_raised_usd: null }),
  company({ id: "co_w", name: "Wren", total_raised_usd: null }),
];
const competitors = [competitor({ id: "co_z", name: "Zeta Robotics", layer: "plant_ops" })];

const rnd = (id: string, over: Partial<Round>): Round =>
  round({
    id,
    lead_investor_ids: [],
    participant_investor_ids: [],
    unspecified_investor_ids: [],
    amount_usd: null,
    ...over,
  });
const rounds: Round[] = [
  rnd("rnd_1", {
    company_id: "co_x",
    date: "2024-03",
    date_precision: "month",
    stage: "seed",
    lead_investor_ids: ["inv_a"],
    participant_investor_ids: ["inv_b", "inv_c"],
  }),
  rnd("rnd_2", {
    company_id: "co_x",
    date: "2025",
    date_precision: "year",
    stage: "series_a",
    lead_investor_ids: ["inv_a"],
    participant_investor_ids: ["inv_b"],
  }),
  rnd("rnd_3", {
    company_id: "co_y",
    date: "2023-Q2",
    date_precision: "quarter",
    stage: "seed",
    participant_investor_ids: ["inv_a", "inv_d"],
    amount_usd: 2_000_000,
  }),
  rnd("rnd_4", {
    company_id: "co_z",
    date: null,
    date_precision: null,
    stage: "pre_seed",
    unspecified_investor_ids: ["inv_d", "inv_c"],
  }),
  rnd("rnd_5", {
    company_id: "co_y",
    date: "2026",
    date_precision: "year",
    stage: "seed",
    amount_usd: 3_000_000,
  }),
];

function graphDoc(): GraphDocument {
  const edges: GraphDocument["edges"] = [];
  for (const r of rounds) {
    for (const role of ["lead", "participant", "unspecified"] as const) {
      for (const id of r[`${role}_investor_ids`]) {
        edges.push({
          source: id,
          target: r.company_id,
          round_id: r.id,
          role,
          stage: r.stage,
          amount_usd: r.amount_usd,
          date: r.date,
        });
      }
    }
  }
  const ids = [...new Set(edges.flatMap((e) => [e.source, e.target]))].sort();
  return {
    version: SCHEMA_VERSION,
    generated_at: "2026-10-30T12:00:00+00:00",
    layout: { algorithm: "forceatlas2", iterations: 400, seed: 42 },
    nodes: ids.map((id, k) => ({
      id,
      kind: id.startsWith("inv_") ? "investor" : "company",
      label: id,
      is_competitor: id === "co_z",
      x: k * 10.04,
      y: -k * 5.01,
      degree: 1,
      weighted_degree: id === "inv_a" ? 4 : 1,
      betweenness: 0,
    })),
    edges,
    coinvest_edges: [
      { source: "inv_a", target: "inv_b", weight: 2, round_ids: ["rnd_1", "rnd_2"] },
    ],
  } as GraphDocument;
}

const thesis: ThesisPoint[] = [
  { id: "inv_a", x: 0, y: 0, cluster_id: 0, is_generalist: false },
  { id: "inv_d", x: 1, y: 1, cluster_id: 1, is_generalist: true },
];

const payload = toGraphPayload({
  graph: graphDoc(),
  investors,
  companies,
  competitors,
  rounds,
  thesis,
});
const data: GraphData = toGraphData(payload);
const universe = investors.map(toFilterable);
const all: FilterState = { ...DEFAULT_FILTER_STATE, region: [] };
const at = (id: string) => data.index.get(id)!;
const ids = (mask: Uint8Array) =>
  data.nodes
    .filter((v) => mask[v.i])
    .map((v) => v.id)
    .sort();
const view = (over: Partial<ViewOptions> & { filters?: FilterState } = {}) =>
  networkView(data, {
    mode: "full",
    investorPass: investorPassMask(data, over.filters ?? all, universe),
    rounds: ALL_ROUNDS,
    centre: null,
    hops: 1,
    ...over,
  });

describe("graph payload", () => {
  it("keeps every graph node with its kind, cluster, type and position", () => {
    expect(payload.nodes.id).toEqual(["co_x", "co_y", "co_z", "inv_a", "inv_b", "inv_c", "inv_d"]);
    expect(payload.nodes.kind).toEqual([1, 1, 2, 0, 0, 0, 0]);
    expect(payload.nodes.cluster).toEqual([-1, -1, -1, 0, -1, -1, 1]);
    expect(payload.nodes.x[1]).toBe(10); // one decimal
    expect(payload.layers[2]).toBe("plant_ops");
    expect(payload.companiesWithoutRounds).toBe(1);
    expect(payload.links.inv.length).toBe(9);
    expect(payload.rounds.date.length).toBe(4); // rnd_5 has no investor
    expect(payload.coinvest.rounds).toEqual([[0, 1]]);
  });

  it("capital raised: reported total, else the sum of known rounds, else unknown", () => {
    expect(payload.nodes.raised.slice(0, 3)).toEqual([50_000_000, 5_000_000, null]);
    expect(payload.nodes.basis.slice(0, 3)).toEqual([1, 2, 0]);
  });

  it("interns source domains and keeps confidence", () => {
    expect(payload.domains).toEqual(["Your list"]);
    expect(new Set(payload.nodes.src)).toEqual(new Set([0]));
    expect(data.nodes[0]!.sourceDomain).toBe("Your list");
    expect(data.nodes[0]!.confidence).toBe("low");
  });
});

describe("graph data", () => {
  it("one participation edge per investor–company pair, carrying each round", () => {
    expect(data.edges.length).toBe(7);
    const ax = data.edges.find((e) => e.inv === at("inv_a") && e.co === at("co_x"))!;
    expect(ax.links.map((l) => data.links[l]!.role)).toEqual(["lead", "lead"]);
    expect(data.nodeEdges[at("inv_a")]!.length).toBe(2);
  });

  it("dates, year extent, types and markers", () => {
    const a = data.nodes[at("inv_a")]!;
    expect([a.firstDate, a.lastDate]).toEqual(["2023-Q2", "2025"]);
    expect(data.yearExtent).toEqual([2023, 2025]);
    expect(data.typesPresent).toEqual(["vc", "accelerator"]);
    expect(data.nodes[at("inv_b")]!.marker).toBe("square");
    expect(data.nodes[at("co_z")]!.kind).toBe("competitor");
  });
});

describe("filters as masks", () => {
  it("investor nodes follow applyFilters; companies are not filtered", () => {
    const mask = investorPassMask(data, DEFAULT_FILTER_STATE, universe)!;
    expect(ids(mask)).toEqual(["co_x", "co_y", "co_z", "inv_a", "inv_b", "inv_d"]);
    expect(investorPassMask(data, all, null)).toBeNull();
  });

  it("counts Directory investors with no round", () => {
    expect(investorsWithoutRounds(data, all, universe)).toBe(1);
  });

  it("round masks by year (coarse dates by their year; undated out once a range is set) and stage", () => {
    expect([...roundPassMask(data, { years: [2024, 2025], stages: [] })]).toEqual([1, 1, 0, 0]);
    expect([...roundPassMask(data, { years: null, stages: ["seed"] })]).toEqual([1, 0, 1, 0]);
    expect([...roundPassMask(data, ALL_ROUNDS)]).toEqual([1, 1, 1, 1]);
  });
});

describe("network view", () => {
  it("full graph: everything with all filters off", () => {
    const v = view();
    expect(v.counts).toMatchObject({ investors: 4, companies: 3, competitors: 1, edges: 7 });
    expect(v.counts.hiddenByFilters).toBe(0);
    expect(v.counts.unknownCapital).toBe(1);
    expect(v.counts.noCluster).toBe(2);
    expect(v.counts.noType).toBe(2);
  });

  it("the URL filters hide investors through the mask and drop their links", () => {
    const v = view({ filters: DEFAULT_FILTER_STATE });
    expect(ids(v.node)).toEqual(["co_x", "co_y", "co_z", "inv_a", "inv_b", "inv_d"]);
    expect(v.counts.hiddenByFilters).toBe(1);
    expect(v.degree[at("co_x")]).toBe(2);
  });

  it("the date range hides undated rounds and counts them; nodes with no round left go too", () => {
    const v = view({ rounds: { years: [2024, 2025], stages: [] } });
    expect(ids(v.node)).toEqual(["co_x", "inv_a", "inv_b", "inv_c"]);
    expect(v.counts.undatedHidden).toBe(1);
    expect(v.roundsInView[at("inv_a")]).toBe(2);
  });

  it("lead edges are lead through a round in view", () => {
    const ax = data.edges.find((e) => e.inv === at("inv_a") && e.co === at("co_x"))!.i;
    expect(view().lead[ax]).toBe(1);
    expect(view({ rounds: { years: null, stages: ["series_a"] } }).lead[ax]).toBe(1);
    const ay = data.edges.find((e) => e.inv === at("inv_a") && e.co === at("co_y"))!.i;
    expect(view().lead[ay]).toBe(0);
  });

  it("neighbourhood follows edges in view", () => {
    expect([...neighbourhood(data, view(), at("co_x"))].sort()).toEqual(
      [at("co_x"), at("inv_a"), at("inv_b"), at("inv_c")].sort(),
    );
    const western = view({ filters: DEFAULT_FILTER_STATE });
    expect(neighbourhood(data, western, at("co_x")).has(at("inv_c"))).toBe(false);
  });
});

describe("first view framing (S10a)", () => {
  it("bounds only the nodes in view", () => {
    const narrow = view({ rounds: { years: [2024, 2025], stages: [] } });
    const shown = data.nodes.filter((v) => narrow.node[v.i]);
    const b = viewBounds(data, narrow)!;
    expect(b.x).toEqual([Math.min(...shown.map((v) => v.x)), Math.max(...shown.map((v) => v.x))]);
    expect(b.y).toEqual([Math.min(...shown.map((v) => v.y)), Math.max(...shown.map((v) => v.y))]);
    const whole = viewBounds(data, view())!;
    expect(whole.x[0]).toBeLessThanOrEqual(b.x[0]);
    expect(whole.x[1]).toBeGreaterThanOrEqual(b.x[1]);
  });

  it("is null when nothing is shown", () => {
    const none = view();
    expect(viewBounds(data, { ...none, node: new Uint8Array(none.node.length) })).toBeNull();
  });
});

describe("modes", () => {
  it("ego network: one hop reaches the companies, two hops their other investors", () => {
    expect(ids(view({ mode: "ego", centre: at("inv_a"), hops: 1 }).node)).toEqual([
      "co_x",
      "co_y",
      "inv_a",
    ]);
    expect(ids(view({ mode: "ego", centre: at("inv_a"), hops: 2 }).node)).toEqual([
      "co_x",
      "co_y",
      "inv_a",
      "inv_b",
      "inv_c",
      "inv_d",
    ]);
  });

  it("ego network keeps a filtered-out centre and its deals, but filters its neighbours", () => {
    const v = view({ mode: "ego", centre: at("inv_c"), hops: 2, filters: DEFAULT_FILTER_STATE });
    expect(v.centre).toBe(at("inv_c"));
    expect(ids(v.node)).toEqual(["co_x", "co_z", "inv_a", "inv_b", "inv_c", "inv_d"]);
    const direct = egoNetwork(
      data,
      new Uint8Array(data.edges.length),
      new Uint8Array(data.edges.length),
      at("inv_c"),
      2,
    );
    expect(ids(direct)).toEqual(["inv_c"]);
  });

  it("ego network without a centre shows the full graph", () => {
    const v = view({ mode: "ego", centre: null });
    expect(v.centre).toBeNull();
    expect(v.counts.investors).toBe(4);
  });

  it("co-investors: pairs with two or more shared rounds in view; weight = shared rounds", () => {
    const pass = new Uint8Array(data.nodes.length).fill(1);
    expect([...coInvestorProjection(data, pass, roundPassMask(data, ALL_ROUNDS))]).toEqual([2]);
    const seedOnly = roundPassMask(data, { years: null, stages: ["seed"] });
    expect([...coInvestorProjection(data, pass, seedOnly)]).toEqual([0]);
    const v = view({ mode: "coinvest" });
    expect(ids(v.node)).toEqual(["inv_a", "inv_b"]);
    expect(v.counts.edges).toBe(1);
    expect(v.degree[at("inv_a")]).toBe(1);
    expect(v.roundsInView[at("inv_a")]).toBe(2);
    expect([...neighbourhood(data, v, at("inv_a"))].sort()).toEqual(
      [at("inv_a"), at("inv_b")].sort(),
    );
  });

  it("competitor lens: competitors, their investors and those investors' other deals", () => {
    expect(ids(view({ mode: "competitors" }).node)).toEqual([
      "co_x",
      "co_y",
      "co_z",
      "inv_c",
      "inv_d",
    ]);
    const western = view({ mode: "competitors", filters: DEFAULT_FILTER_STATE });
    expect(ids(western.node)).toEqual(["co_y", "co_z", "inv_d"]);
    // A competitor with no backer in view is still shown.
    const lens = competitorLens(data, new Uint8Array(data.edges.length));
    expect(ids(lens.node)).toEqual(["co_z"]);
  });
});

describe("encoding", () => {
  it("node area is proportional to weighted degree; squares match the circle's area", () => {
    expect(nodeRadius(4) / nodeRadius(1)).toBeCloseTo(2);
    const r = nodeRadius(9);
    expect((2 * squareHalfSide(r)) ** 2).toBeCloseTo(Math.PI * r * r);
  });

  it("company greys: darker = more raised; unknown is the lightest", () => {
    expect([
      capitalBin(null),
      capitalBin(9e6),
      capitalBin(1e7),
      capitalBin(5e8),
      capitalBin(2e9),
    ]).toEqual([null, 0, 1, 2, 3]);
    expect(capitalGrey(null)).toBe(COMPANY_GREY.low);
    expect(capitalGrey(3)).toBe(COMPANY_GREY.high);
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16);
    expect(lum(capitalGrey(0))).toBeLessThan(lum(capitalGrey(null)));
    expect(lum(capitalGrey(2))).toBeLessThan(lum(capitalGrey(1)));
  });

  it("investors without a cluster or type get the neutral colour", () => {
    const byCluster = nodeColours(
      data,
      "cluster",
      new Map([
        [0, "#D9731A"],
        [1, "#2A78D6"],
        [2, "#9AA1AB"],
      ]),
    );
    expect(byCluster[at("inv_b")]).toBe(NO_GROUP_COLOR);
    expect(byCluster[at("inv_a")]).not.toBe(byCluster[at("inv_d")]);
    const byType = nodeColours(data, "type", new Map());
    expect(byType[at("inv_d")]).toBe(NO_GROUP_COLOR);
    expect(byType[at("co_y")]).toBe(capitalGrey(0));
  });
});

describe("table and search", () => {
  it("rows are the shown nodes, heaviest first", () => {
    const rows = networkRows(data, view({ mode: "coinvest" }));
    expect(rows.map((r) => r.id)).toEqual(["inv_a", "inv_b"]);
    expect(rows[0]!.degree).toBe(1);
  });

  it("search: prefix matches first, then contains; only shown nodes", () => {
    const v = view();
    expect(searchNodes(data, v, "ta").map((n) => n.id)).toEqual([]); // labels are ids here
    const named = {
      ...data,
      nodes: data.nodes.map((n) => ({
        ...n,
        label: investors.find((i) => i.id === n.id)?.name ?? n.label,
      })),
    };
    expect(searchNodes(named, v, "ta").map((n) => n.id)).toEqual(["inv_b", "inv_d", "inv_c"]);
    expect(searchNodes(named, v, "del").map((n) => n.id)).toEqual(["inv_d"]);
    expect(searchNodes(named, view({ filters: DEFAULT_FILTER_STATE }), "gam")).toEqual([]);
  });
});

describe("round stage counts", () => {
  it("count rounds with an investor in view, inside the date range, per stage", () => {
    const all = stageCounts(data, null, null);
    expect([all.seed, all.series_a, all.pre_seed, all.growth]).toEqual([2, 1, 1, 0]);
    const western = investorPassMask(data, DEFAULT_FILTER_STATE, universe);
    expect(stageCounts(data, western, [2024, 2025]).seed).toBe(1);
  });
});

describe("URL", () => {
  it("years round-trip and order", () => {
    expect(parseYears("2019-2026")).toEqual([2019, 2026]);
    expect(parseYears("2026-2019")).toEqual([2019, 2026]);
    expect(parseYears("2019")).toBeNull();
    expect(serializeYears([2026, 2019])).toBe("2019-2026");
  });
});
