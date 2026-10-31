/**
 * "Who funds our competitors": a two-column Sankey, investors on the left, competitors on the
 * right (Competitors page, first view).
 *
 * Money is an estimate, and every label says so. Per-investor amounts in a round are rarely
 * published, so each round's disclosed amount is split equally among the round's named
 * investors (any role: lead, participant or role not stated). A round with an amount and no
 * named investor flows whole from "Investors not named", so a competitor's node is exactly the
 * sum of its disclosed round amounts. In the rounds view each round counts once, split the same
 * way, so a competitor's node is its number of rounds; rounds with no amount carry width only
 * there. A band or node with no value in a view is left out, never drawn at zero.
 *
 * The layout is a small N-column version of the d3-sankey idea, kept here so it is pure and
 * tested (`layoutSankeyColumns`; the overview in `competitorOverview.ts` uses three columns,
 * this view two): node height = scale × value with one scale for every column (so every node's
 * height is the sum of its band widths), nodes ordered by the barycentre of their partners to
 * cut crossings, and bands stacked at each node in the order of the node at their other end.
 */
import type { Competitor, Confidence, Investor, Round } from "@/lib/schema";
import type { CompetitorCategory, CompetitorLayer, RoundStage } from "@/lib/schema/enums";
import { COMPETITOR_CATEGORIES } from "@/lib/schema/enums";
import { CATEGORICAL_WIDE, OTHER_GREY } from "../palette";
import { provenanceOf, topDomains } from "./common";
import { roundInvestorIds } from "./competitors";
import { periodOf } from "./recentDeals";

export type SankeyMode = "money" | "rounds";

export const OTHER_ID = "sankey:other";
export const UNNAMED_ID = "sankey:unnamed";
/** Investors named for their estimated money before the multi-competitor backers join them. */
export const TOP_BY_MONEY = 12;
/** Named investors at most, one palette colour each; with Other and Not named, 20 nodes. */
export const MAX_NAMED = CATEGORICAL_WIDE.length;

type Provenance = { sourceDomain: string | null; confidence: Confidence | null };

export type FlowRound = {
  id: string;
  companyId: string;
  /** The date as recorded (YYYY, YYYY-Qn, YYYY-MM or YYYY-MM-DD); null when unknown. */
  date: string | null;
  stage: RoundStage;
  amountUsd: number | null;
  /** Named investors in the round, any role. 0: the round flows from "Investors not named". */
  named: number;
};

export type FlowMember = {
  id: string;
  name: string;
  /** Estimated money (equal split); 0 when none of its rounds has an amount. */
  money: number;
};

export type FlowSource = Provenance & {
  /** Investor id, OTHER_ID or UNNAMED_ID. */
  id: string;
  kind: "investor" | "other" | "unnamed";
  name: string;
  color: string;
  /** Estimated money (equal split); 0 when none of its rounds has an amount. */
  money: number;
  /** Rounds, each split equally among its named investors (the rounds view's value). */
  roundShare: number;
  /** Distinct rounds behind the node. */
  roundCount: number;
  /** Distinct competitors it reaches. */
  competitors: number;
  /** For "other": the investors grouped in it, by estimated money, then rounds, then name. */
  members: FlowMember[];
};

export type FlowTarget = Provenance & {
  id: string;
  name: string;
  category: CompetitorCategory;
  layer: CompetitorLayer;
  /** The stored total raised the table shows. */
  totalRaisedUsd: number | null;
  /** Sum of disclosed round amounts: the node's money value. Null when no round has an amount. */
  disclosedUsd: number | null;
  rounds: number;
  roundsWithAmount: number;
};

export type FlowLink = Provenance & {
  /** A FlowSource id. */
  source: string;
  /** A competitor id. */
  target: string;
  /** Estimated money; null when no round behind the band has an amount. */
  money: number | null;
  /** Rounds, each split equally among its named investors. */
  roundShare: number;
  /** Rounds behind the band, oldest first, undated last. */
  roundIds: string[];
  /** Investors in the band: one for a named investor, several for Other, none for Not named. */
  investorIds: string[];
};

/**
 * One investor (or "not named") and one competitor: a row of the table alternative. Names come
 * from the sources, Other's members and the targets, so they travel once.
 */
export type FlowPair = {
  /** Null: the round names no investor. */
  investorId: string | null;
  competitorId: string;
  /** Rounds the investor took part in at that competitor (whole rounds). */
  rounds: number;
  /** Estimated money; null when none of those rounds has an amount. */
  money: number | null;
};

export type CompetitorFlows = {
  /** Named investors by rank (their colour order), then Other, then Not named. */
  sources: FlowSource[];
  /** Every competitor, including those with no rounds (the layout leaves them out). */
  targets: FlowTarget[];
  links: FlowLink[];
  pairs: FlowPair[];
  rounds: Record<string, FlowRound>;
  totals: {
    /** Sum of disclosed amounts of the competitors' rounds. */
    money: number;
    /** All the competitors' rounds. */
    rounds: number;
    roundsWithAmount: number;
  };
  /** Rounds with no amount: width in the rounds view only. */
  roundsWithoutAmount: number;
  /** Rounds that name no investor: drawn from "Investors not named". */
  roundsWithoutInvestors: number;
  /** Competitors with no disclosed round amount: not in the money view. */
  competitorsWithoutAmount: number;
  /** Competitors with no rounds: in neither view. */
  competitorsWithoutRounds: number;
  /** Distinct investors named in the competitors' rounds. */
  investors: number;
  /** Named for their estimated money (the rest of the named back two or more competitors). */
  namedByMoney: number;
  /** Investors backing two or more competitors, and how many of them are named nodes. */
  multiBackers: number;
  namedMultiBackers: number;
  sourceDomains: string[];
};

const roundStart = (r: Pick<Round, "date">) =>
  r.date === null ? null : (periodOf(r.date)?.start ?? null);

function byDate(a: Round, b: Round): number {
  const x = roundStart(a);
  const y = roundStart(b);
  if (x === null || y === null) return x === y ? a.id.localeCompare(b.id) : x === null ? 1 : -1;
  return x - y || a.id.localeCompare(b.id);
}

type InvestorAcc = {
  id: string;
  name: string;
  money: number;
  roundShare: number;
  rounds: Set<string>;
  competitors: Set<string>;
};

type PairAcc = {
  investorId: string | null;
  competitorId: string;
  money: number | null;
  roundShare: number;
  roundIds: string[];
};

const rankInvestors = (a: InvestorAcc, b: InvestorAcc) =>
  b.money - a.money ||
  b.rounds.size - a.rounds.size ||
  a.name.localeCompare(b.name) ||
  a.id.localeCompare(b.id);

/**
 * Investor-to-competitor flows. Named nodes: the TOP_BY_MONEY investors by estimated money,
 * then investors backing two or more competitors (most competitors first, then money) while
 * the named count stays at MAX_NAMED or fewer. Every other investor is in "Other investors".
 */
export function competitorFlows(
  competitors: readonly Competitor[],
  rounds: readonly Round[],
  investors: readonly Investor[],
): CompetitorFlows {
  const names = new Map(investors.map((i) => [i.id, i.name]));
  const comps = new Map(competitors.map((c) => [c.id, c]));
  const own = rounds.filter((r) => comps.has(r.company_id));
  const roundById = new Map(own.map((r) => [r.id, r]));
  const flowRounds: Record<string, FlowRound> = {};
  const pairs = new Map<string, PairAcc>();

  for (const r of own) {
    // Ids without an investor record cannot be named; with none left the round is "not named".
    const named = [...new Set(roundInvestorIds(r).filter((id) => names.has(id)))];
    flowRounds[r.id] = {
      id: r.id,
      companyId: r.company_id,
      date: r.date,
      stage: r.stage,
      amountUsd: r.amount_usd,
      named: named.length,
    };
    const holders: (string | null)[] = named.length ? named : [null];
    for (const h of holders) {
      const key = `${h ?? ""}|${r.company_id}`;
      const acc = pairs.get(key) ?? {
        investorId: h,
        competitorId: r.company_id,
        money: null,
        roundShare: 0,
        roundIds: [],
      };
      if (r.amount_usd !== null) acc.money = (acc.money ?? 0) + r.amount_usd / holders.length;
      acc.roundShare += 1 / holders.length;
      acc.roundIds.push(r.id);
      pairs.set(key, acc);
    }
  }

  const accs = new Map<string, InvestorAcc>();
  for (const p of pairs.values()) {
    if (p.investorId === null) continue;
    const a = accs.get(p.investorId) ?? {
      id: p.investorId,
      name: names.get(p.investorId)!,
      money: 0,
      roundShare: 0,
      rounds: new Set<string>(),
      competitors: new Set<string>(),
    };
    a.money += p.money ?? 0;
    a.roundShare += p.roundShare;
    for (const id of p.roundIds) a.rounds.add(id);
    a.competitors.add(p.competitorId);
    accs.set(p.investorId, a);
  }

  const ranked = [...accs.values()].sort(rankInvestors);
  const named = ranked.filter((i) => i.money > 0).slice(0, TOP_BY_MONEY);
  const namedByMoney = named.length;
  const namedIds = new Set(named.map((i) => i.id));
  const multi = ranked.filter((i) => i.competitors.size >= 2);
  const extras = multi
    .filter((i) => !namedIds.has(i.id))
    .sort((a, b) => b.competitors.size - a.competitors.size || rankInvestors(a, b));
  for (const e of extras) {
    if (named.length >= MAX_NAMED) break;
    named.push(e);
    namedIds.add(e.id);
  }

  const sourceOf = (investorId: string | null) =>
    investorId === null ? UNNAMED_ID : namedIds.has(investorId) ? investorId : OTHER_ID;
  const roundsOf = (ids: Iterable<string>) =>
    [...new Set(ids)].map((id) => roundById.get(id)!).sort(byDate);

  // Bands: named pairs as they are; Other and Not named summed per competitor.
  type LinkAcc = Omit<PairAcc, "investorId"> & { source: string; investorIds: string[] };
  const linkAccs = new Map<string, LinkAcc>();
  for (const p of pairs.values()) {
    const source = sourceOf(p.investorId);
    const key = `${source}|${p.competitorId}`;
    const l = linkAccs.get(key) ?? {
      source,
      competitorId: p.competitorId,
      money: null,
      roundShare: 0,
      roundIds: [],
      investorIds: [],
    };
    if (p.money !== null) l.money = (l.money ?? 0) + p.money;
    l.roundShare += p.roundShare;
    l.roundIds.push(...p.roundIds);
    if (p.investorId !== null) l.investorIds.push(p.investorId);
    linkAccs.set(key, l);
  }
  const links: FlowLink[] = [...linkAccs.values()].map((l) => {
    const behind = roundsOf(l.roundIds);
    return {
      source: l.source,
      target: l.competitorId,
      money: l.money,
      roundShare: l.roundShare,
      roundIds: behind.map((r) => r.id),
      investorIds: [...l.investorIds].sort((a, b) =>
        (names.get(a) ?? a).localeCompare(names.get(b) ?? b),
      ),
      ...provenanceOf(behind),
    };
  });

  const member = (i: InvestorAcc): FlowMember => ({ id: i.id, name: i.name, money: i.money });
  const sources: FlowSource[] = named.map((i, n) => ({
    id: i.id,
    kind: "investor",
    name: i.name,
    color: CATEGORICAL_WIDE[n] ?? OTHER_GREY,
    money: i.money,
    roundShare: i.roundShare,
    roundCount: i.rounds.size,
    competitors: i.competitors.size,
    members: [],
    ...provenanceOf(roundsOf(i.rounds)),
  }));
  const rest = ranked.filter((i) => !namedIds.has(i.id));
  const group = (
    id: string,
    kind: "other" | "unnamed",
    name: string,
    color: string,
    members: InvestorAcc[],
  ): FlowSource | null => {
    const mine = links.filter((l) => l.source === id);
    if (mine.length === 0) return null;
    const ids = mine.flatMap((l) => l.roundIds);
    return {
      id,
      kind,
      name,
      color,
      money: mine.reduce((a, l) => a + (l.money ?? 0), 0),
      roundShare: mine.reduce((a, l) => a + l.roundShare, 0),
      roundCount: new Set(ids).size,
      competitors: mine.length,
      members: members.map(member),
      ...provenanceOf(roundsOf(ids)),
    };
  };
  const other = group(OTHER_ID, "other", "Other investors", OTHER_GREY, rest);
  const unnamed = group(UNNAMED_ID, "unnamed", "Investors not named", OTHER_GREY, []);
  if (other) sources.push(other);
  if (unnamed) sources.push(unnamed);

  const targets: FlowTarget[] = competitors.map((c) => {
    const cr = own.filter((r) => r.company_id === c.id);
    const amounts = cr.map((r) => r.amount_usd).filter((a): a is number => a !== null);
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      layer: c.layer,
      totalRaisedUsd: c.total_raised_usd,
      disclosedUsd: amounts.length ? amounts.reduce((a, b) => a + b, 0) : null,
      rounds: cr.length,
      roundsWithAmount: amounts.length,
      ...provenanceOf(cr.length ? cr : [c]),
    };
  });

  const pairRows: FlowPair[] = [...pairs.values()].map((p) => ({
    investorId: p.investorId,
    competitorId: p.competitorId,
    rounds: p.roundIds.length,
    money: p.money,
  }));

  const withAmount = own.filter((r) => r.amount_usd !== null);
  return {
    sources,
    targets,
    links,
    pairs: pairRows,
    rounds: flowRounds,
    totals: {
      money: withAmount.reduce((a, r) => a + r.amount_usd!, 0),
      rounds: own.length,
      roundsWithAmount: withAmount.length,
    },
    roundsWithoutAmount: own.length - withAmount.length,
    roundsWithoutInvestors: Object.values(flowRounds).filter((r) => r.named === 0).length,
    competitorsWithoutAmount: targets.filter((t) => t.disclosedUsd === null).length,
    competitorsWithoutRounds: targets.filter((t) => t.rounds === 0).length,
    investors: accs.size,
    namedByMoney,
    multiBackers: multi.length,
    namedMultiBackers: named.filter((i) => i.competitors.size >= 2).length,
    sourceDomains: topDomains(own, 4),
  };
}

/* --------------------------------------------------------------------------- layout */

export type SankeyNodeIn = { id: string; group?: string };
export type SankeyLinkIn = { source: string; target: string; value: number };

/** One column of an N-column Sankey, left to right. */
export type SankeyColumn = {
  /** x of the column's left edge. */
  x: number;
  /** Nodes in their starting order; the sweeps reorder free nodes inside their group. */
  nodes: readonly SankeyNodeIn[];
  /** Smallest gap between two nodes, px. */
  pad: number;
  /** Extra gap between groups, px. */
  groupGap?: number;
  /** Groups top to bottom; groups not listed follow in order of appearance. */
  groupOrder?: readonly string[];
  /** Nodes kept at the bottom, in this order (Other investors, Investors not named). */
  pinned?: readonly string[];
  /** Keep the given order (no crossing sweeps), for columns whose order means something. */
  fixed?: boolean;
  /** Room kept free above the column, px (for labels drawn above its nodes). */
  reserveTop?: number;
  /**
   * Height of the labels beside the column's nodes, px. When the column has room to spare, the
   * spare goes first to the gaps whose two nodes are too close for both labels, so fewer labels
   * have to move off their node; without it the spare is spread evenly.
   */
  labelHeight?: number;
};

export type SankeyColumnsOptions = {
  /** Height of the node area, px. */
  height: number;
  nodeWidth: number;
  /**
   * A column with room to spare spreads its gaps up to this (never below a column's own pad);
   * the rest goes above and below.
   */
  maxPad?: number;
  /** Ordering sweeps (each one right to left, then left to right); 0 keeps the input order. */
  iterations?: number;
};

export type SankeyColumnNode = {
  id: string;
  column: number;
  /** The node's group; "" when it has none. */
  group: string;
  /** Height in value units: the larger of what enters and what leaves. */
  value: number;
  valueIn: number;
  valueOut: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

export type SankeyLink = {
  /** Index into the input links. */
  index: number;
  source: string;
  target: string;
  /** The source's column: the band runs from it to the next one. */
  column: number;
  value: number;
  /** Band width, px. */
  width: number;
  /** Top of the band at the source node and at the target node. */
  sy: number;
  ty: number;
};

export type SankeyGroup = { group: string; y0: number; y1: number; count: number };

export type SankeyColumnsLayout = {
  /** Column by column, each top to bottom. */
  nodes: SankeyColumnNode[];
  /** The drawn links, in input order. */
  links: SankeyLink[];
  groups: (SankeyGroup & { column: number })[];
  /** px per unit of value, one scale for every column. */
  scale: number;
  /** The largest column total. */
  total: number;
};

type Pos = { y0: number; y1: number };

/**
 * N-column Sankey layout, a small pure version of the d3-sankey idea. Links run from one column
 * to the next; links with no positive value, or between columns that are not neighbours, are
 * dropped, and so are nodes left with no value. A node's height is scale × its value (the larger
 * of its in- and outflow, so a conserving node is exactly as tall as the bands on each side),
 * with one scale for every column: the column that needs the most room for its gaps sets it and
 * fills the height, the others spread their gaps (up to `maxPad`) and are centred.
 *
 * Order: each sweep sorts every column right to left by the barycentre of its outflows, then
 * left to right by the barycentre of its inflows, inside groups, which keep their order; pinned
 * nodes stay at the bottom and fixed columns keep the input order. Bands leave a node in the
 * order of their targets and enter it in the order of their sources, so no two bands cross at a
 * node.
 */
export function layoutSankeyColumns(
  columns: readonly SankeyColumn[],
  linksIn: readonly SankeyLinkIn[],
  o: SankeyColumnsOptions,
): SankeyColumnsLayout {
  const colOf = new Map<string, number>();
  columns.forEach((c, ci) => c.nodes.forEach((n) => colOf.set(n.id, ci)));
  const kept = linksIn
    .map((l, index) => ({ ...l, index }))
    .filter(
      (l) =>
        Number.isFinite(l.value) &&
        l.value > 0 &&
        colOf.has(l.source) &&
        colOf.get(l.target) === colOf.get(l.source)! + 1,
    );
  type Kept = (typeof kept)[number];
  const vin = new Map<string, number>();
  const vout = new Map<string, number>();
  const outgoing = new Map<string, Kept[]>();
  const incoming = new Map<string, Kept[]>();
  for (const l of kept) {
    vout.set(l.source, (vout.get(l.source) ?? 0) + l.value);
    vin.set(l.target, (vin.get(l.target) ?? 0) + l.value);
    outgoing.set(l.source, [...(outgoing.get(l.source) ?? []), l]);
    incoming.set(l.target, [...(incoming.get(l.target) ?? []), l]);
  }
  const value = new Map<string, number>();
  for (const id of colOf.keys()) {
    const v = Math.max(vin.get(id) ?? 0, vout.get(id) ?? 0);
    if (v > 0) value.set(id, v);
  }
  if (value.size === 0) return { nodes: [], links: [], groups: [], scale: 0, total: 0 };

  const groupOf = new Map<string, string>();
  const cols = columns.map((spec) => {
    const nodes = spec.nodes.filter((n) => value.has(n.id));
    for (const n of nodes) groupOf.set(n.id, n.group ?? "");
    const pinned = (spec.pinned ?? []).filter((id) => nodes.some((n) => n.id === id));
    const free = nodes.filter((n) => !pinned.includes(n.id));
    const groupNames = [
      ...new Set([...(spec.groupOrder ?? []), ...free.map((n) => n.group ?? "")]),
    ].filter((g) => free.some((n) => (n.group ?? "") === g));
    return {
      spec,
      groupNames,
      groups: groupNames.map((g) => free.filter((n) => (n.group ?? "") === g).map((n) => n.id)),
      pinned,
    };
  });
  type Col = (typeof cols)[number];
  const idsOf = (c: Col) => [...c.groups.flat(), ...c.pinned];
  const breaksOf = (c: Col) => Math.max(0, c.groups.length - 1);

  let scale = Number.POSITIVE_INFINITY;
  let total = 0;
  for (const c of cols) {
    const ids = idsOf(c);
    if (ids.length === 0) continue;
    const sum = ids.reduce((a, id) => a + value.get(id)!, 0);
    total = Math.max(total, sum);
    const avail =
      o.height -
      (c.spec.reserveTop ?? 0) -
      (ids.length - 1) * c.spec.pad -
      breaksOf(c) * (c.spec.groupGap ?? 0);
    scale = Math.min(scale, avail / sum);
  }
  scale = Math.max(0, scale);
  const maxPad = Math.max(o.maxPad ?? Number.POSITIVE_INFINITY, ...columns.map((c) => c.pad));

  const stack = (c: Col): Map<string, Pos> => {
    const pos = new Map<string, Pos>();
    const ids = idsOf(c);
    const breaks = new Set<number>();
    let k = 0;
    c.groups.forEach((g, gi) => {
      if (gi > 0) breaks.add(k);
      k += g.length;
    });
    const gg = c.spec.groupGap ?? 0;
    const top = c.spec.reserveTop ?? 0;
    const avail = o.height - top;
    const n = ids.length;
    const pad = c.spec.pad;
    const hs = ids.map((id) => scale * value.get(id)!);
    const nodeSum = hs.reduce((a, h) => a + h, 0);
    let spare = Math.max(0, avail - nodeSum - Math.max(0, n - 1) * pad - breaks.size * gg);
    // gaps[i] sits above node i (gaps[0] unused).
    const gaps = ids.map(() => pad);
    const lh = c.spec.labelHeight ?? 0;
    if (lh > 0 && spare > 0) {
      const need = hs.map((h, i) =>
        i === 0 ? 0 : Math.max(0, lh - (h + hs[i - 1]!) / 2 - pad - (breaks.has(i) ? gg : 0)),
      );
      const wanted = need.reduce((a, x) => a + x, 0);
      const k = wanted > 0 ? Math.min(1, spare / wanted) : 0;
      need.forEach((x, i) => (gaps[i] = gaps[i]! + x * k));
      spare -= wanted * k;
    }
    const even = n > 1 ? Math.min(spare / (n - 1), Math.max(0, maxPad - pad)) : 0;
    const used = nodeSum + gaps.slice(1).reduce((a, g) => a + g + even, 0) + breaks.size * gg;
    let y = top + Math.max(0, (avail - used) / 2);
    ids.forEach((id, i) => {
      if (i > 0) y += gaps[i]! + even + (breaks.has(i) ? gg : 0);
      pos.set(id, { y0: y, y1: y + hs[i]! });
      y += hs[i]!;
    });
    return pos;
  };
  const mid = (p: Pos) => (p.y0 + p.y1) / 2;
  const barycentre = (
    ls: readonly Kept[] | undefined,
    at: Map<string, Pos>,
    end: "source" | "target",
    self: Pos,
  ) => {
    let w = 0;
    let s = 0;
    for (const l of ls ?? []) {
      const p = at.get(l[end]);
      if (!p) continue;
      w += l.value;
      s += l.value * mid(p);
    }
    return w > 0 ? s / w : mid(self);
  };
  const sortColumn = (ci: number, by: "out" | "in") => {
    const c = cols[ci]!;
    if (c.spec.fixed) return;
    const self = stack(c);
    const other = stack(cols[by === "out" ? ci + 1 : ci - 1]!);
    const key = new Map(
      idsOf(c).map((id) => [
        id,
        by === "out"
          ? barycentre(outgoing.get(id), other, "target", self.get(id)!)
          : barycentre(incoming.get(id), other, "source", self.get(id)!),
      ]),
    );
    c.groups = c.groups.map((g) => {
      const before = new Map(g.map((id, i) => [id, i]));
      return [...g].sort((a, b) => key.get(a)! - key.get(b)! || before.get(a)! - before.get(b)!);
    });
  };
  for (let it = 0; it < (o.iterations ?? 0); it++) {
    for (let ci = cols.length - 2; ci >= 0; ci--) sortColumn(ci, "out");
    for (let ci = 1; ci < cols.length; ci++) sortColumn(ci, "in");
  }

  const pos = cols.map(stack);
  const at = (id: string) => pos[colOf.get(id)!]!.get(id)!;
  const placed = new Map<number, { sy: number; ty: number }>();
  for (const [id, ls] of outgoing) {
    let y = at(id).y0;
    const order = [...ls].sort(
      (a, b) =>
        mid(at(a.target)) - mid(at(b.target)) ||
        a.target.localeCompare(b.target) ||
        a.index - b.index,
    );
    for (const l of order) {
      placed.set(l.index, { sy: y, ty: 0 });
      y += scale * l.value;
    }
  }
  for (const [id, ls] of incoming) {
    let y = at(id).y0;
    const order = [...ls].sort(
      (a, b) =>
        mid(at(a.source)) - mid(at(b.source)) ||
        a.source.localeCompare(b.source) ||
        a.index - b.index,
    );
    for (const l of order) {
      placed.get(l.index)!.ty = y;
      y += scale * l.value;
    }
  }

  return {
    nodes: cols.flatMap((c, ci) =>
      idsOf(c).map((id) => ({
        id,
        column: ci,
        group: groupOf.get(id) ?? "",
        value: value.get(id)!,
        valueIn: vin.get(id) ?? 0,
        valueOut: vout.get(id) ?? 0,
        x0: c.spec.x,
        x1: c.spec.x + o.nodeWidth,
        ...pos[ci]!.get(id)!,
      })),
    ),
    links: kept.map((l) => ({
      index: l.index,
      source: l.source,
      target: l.target,
      column: colOf.get(l.source)!,
      value: l.value,
      width: scale * l.value,
      ...placed.get(l.index)!,
    })),
    groups: cols.flatMap((c, ci) =>
      c.groups.map((g, gi) => ({
        column: ci,
        group: c.groupNames[gi]!,
        y0: pos[ci]!.get(g[0]!)!.y0,
        y1: pos[ci]!.get(g[g.length - 1]!)!.y1,
        count: g.length,
      })),
    ),
    scale,
    total,
  };
}

export type SankeyLayoutOptions = {
  /** Height of the node area, px. */
  height: number;
  /** x of the left column's left edge. */
  leftX: number;
  /** x of the right column's right edge. */
  rightX: number;
  nodeWidth: number;
  /** Smallest gap between two nodes of a column, px. */
  padLeft: number;
  padRight: number;
  /** Extra gap between groups of the right column, px. */
  groupGap?: number;
  /** The column with room to spare spreads its gaps up to this; the rest goes above and below. */
  maxPad?: number;
  /** Left nodes kept at the bottom, in this order (Other investors, Investors not named). */
  pinnedLeft?: readonly string[];
  /** Right groups, top to bottom; groups not listed follow in order of appearance. */
  groupOrder?: readonly string[];
  /** Ordering sweeps; 0 keeps the input order. */
  iterations?: number;
};

export type SankeyNode = {
  id: string;
  side: "left" | "right";
  group: string | null;
  value: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

export type SankeyLayout = {
  /** Left column top to bottom, then the right column top to bottom. */
  nodes: SankeyNode[];
  /** The drawn links, in input order. */
  links: SankeyLink[];
  groups: SankeyGroup[];
  /** px per unit of value, one scale for both columns. */
  scale: number;
  total: number;
};

/**
 * Two-column Sankey layout (the "Investor → competitor" view): `layoutSankeyColumns` with an
 * ungrouped left column, pinned at the bottom, and a grouped right column.
 */
export function layoutSankey(
  leftIn: readonly SankeyNodeIn[],
  rightIn: readonly SankeyNodeIn[],
  linksIn: readonly SankeyLinkIn[],
  o: SankeyLayoutOptions,
): SankeyLayout {
  const L = layoutSankeyColumns(
    [
      {
        x: o.leftX,
        nodes: leftIn.map((n) => ({ id: n.id })),
        pad: o.padLeft,
        pinned: o.pinnedLeft,
      },
      {
        x: o.rightX - o.nodeWidth,
        nodes: rightIn,
        pad: o.padRight,
        groupGap: o.groupGap,
        groupOrder: o.groupOrder,
      },
    ],
    linksIn,
    { height: o.height, nodeWidth: o.nodeWidth, maxPad: o.maxPad, iterations: o.iterations },
  );
  return {
    nodes: L.nodes.map(({ id, column, group, value, x0, x1, y0, y1 }) =>
      column === 0
        ? { id, side: "left" as const, group: null, value, x0, x1, y0, y1 }
        : { id, side: "right" as const, group, value, x0, x1: o.rightX, y0, y1 },
    ),
    links: L.links,
    groups: L.groups
      .filter((g) => g.column === 1)
      .map((g) => ({ group: g.group, y0: g.y0, y1: g.y1, count: g.count })),
    scale: L.scale,
    total: L.links.reduce((a, l) => a + l.value, 0),
  };
}

/**
 * Pairs of bands that cross between the same two columns (judged at their centre lines). Bands
 * between different columns never meet.
 */
export function countCrossings(layout: Pick<SankeyLayout, "links">): number {
  const c = layout.links.map((l) => ({
    col: l.column,
    s: l.sy + l.width / 2,
    t: l.ty + l.width / 2,
  }));
  let n = 0;
  for (let i = 0; i < c.length; i++) {
    for (let j = i + 1; j < c.length; j++) {
      if (c[i]!.col !== c[j]!.col) continue;
      if ((c[i]!.s - c[j]!.s) * (c[i]!.t - c[j]!.t) < 0) n += 1;
    }
  }
  return n;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * A filled band from (x0, sy) to (x1, ty), `width` px tall at both ends, with horizontal
 * tangents at the nodes.
 */
export function ribbonPath(x0: number, sy: number, x1: number, ty: number, width: number): string {
  const xm = (x0 + x1) / 2;
  const [a, b, c, d, m] = [x0, sy, x1, ty, xm].map(r2) as [number, number, number, number, number];
  const w = r2(width);
  return (
    `M${a},${b}C${m},${b} ${m},${d} ${c},${d}` +
    `L${c},${r2(d + w)}C${m},${r2(d + w)} ${m},${r2(b + w)} ${a},${r2(b + w)}Z`
  );
}

export type LabelCandidate = { id: string; y: number; height: number; priority: number };

/**
 * Which labels fit without overlapping: highest priority first, a label (a box `height` px
 * tall centred on `y`) is kept when it stays inside [top, bottom] and clears every kept label
 * by `gap` px. The rest are shown on hover.
 */
export function placeLabels(
  items: readonly LabelCandidate[],
  top: number,
  bottom: number,
  gap = 1,
): Set<string> {
  const kept: { a: number; b: number }[] = [];
  const out = new Set<string>();
  const order = [...items].sort((x, y) => y.priority - x.priority || x.y - y.y);
  for (const it of order) {
    const a = it.y - it.height / 2;
    const b = it.y + it.height / 2;
    if (a < top || b > bottom) continue;
    if (kept.some((k) => a < k.b + gap && b > k.a - gap)) continue;
    kept.push({ a, b });
    out.add(it.id);
  }
  return out;
}

/**
 * Labels of one column placed without overlaps, as close to their marks as the room allows (the
 * classic one-dimensional label dodge). Each label is a box `height` px tall that wants to be
 * centred on `y`; boxes keep their top-to-bottom order, stay inside [top, bottom] and clear each
 * other by `gap` px. Runs that would overlap are merged and centred on the mean of their wishes,
 * the least-squares position, then kept inside the bounds. When the boxes cannot all fit, the
 * lowest-priority labels are left out (the chart shows them on hover). Returns each placed
 * label's centre.
 */
export function dodgeLabels(
  items: readonly LabelCandidate[],
  top: number,
  bottom: number,
  gap = 2,
): Map<string, number> {
  const pool = [...items].sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  const need = () => pool.reduce((a, x) => a + x.height, 0) + Math.max(0, pool.length - 1) * gap;
  while (pool.length > 0 && need() > bottom - top) {
    let k = 0;
    for (let i = 1; i < pool.length; i++) if (pool[i]!.priority <= pool[k]!.priority) k = i;
    pool.splice(k, 1);
  }
  type Block = { items: LabelCandidate[]; h: number; want: number; n: number; top: number };
  const settle = (b: Omit<Block, "top">): Block => ({
    ...b,
    top: Math.min(Math.max(b.want / b.n, top), bottom - b.h),
  });
  const blocks: Block[] = [];
  for (const it of pool) {
    let b = settle({ items: [it], h: it.height, want: it.y - it.height / 2, n: 1 });
    for (let p = blocks.at(-1); p && p.top + p.h + gap > b.top + 1e-9; p = blocks.at(-1)) {
      blocks.pop();
      // Merged, each of b's labels sits p.h + gap lower in the block than it did in b.
      b = settle({
        items: [...p.items, ...b.items],
        h: p.h + gap + b.h,
        want: p.want + b.want - b.n * (p.h + gap),
        n: p.n + b.n,
      });
    }
    blocks.push(b);
  }
  const out = new Map<string, number>();
  for (const b of blocks) {
    let y = b.top;
    for (const it of b.items) {
      out.set(it.id, y + it.height / 2);
      y += it.height + gap;
    }
  }
  return out;
}

/* ------------------------------------------------------------- the competitor chart */

/** Node value in a view: estimated money, or rounds split equally among named investors. */
export const linkValue = (l: Pick<FlowLink, "money" | "roundShare">, mode: SankeyMode) =>
  mode === "money" ? (l.money ?? 0) : l.roundShare;

const targetValue = (t: FlowTarget, mode: SankeyMode) =>
  mode === "money" ? (t.disclosedUsd ?? 0) : t.rounds;

/** Chart height: 20 px per competitor with a round, between 820 and 1,000 px. */
export function sankeyHeight(flows: Pick<CompetitorFlows, "targets">): number {
  const n = flows.targets.filter((t) => t.rounds > 0).length;
  return Math.min(1000, Math.max(820, n * 20));
}

export const SANKEY_GROUP_GAP = 26;
const NODE_WIDTH = 12;

/**
 * The competitor Sankey in one view. Competitors are grouped Direct, Adjacent, Remote, biggest
 * first before the crossing sweeps; Other investors and Investors not named stay at the bottom.
 * The right column's gaps take at most about 42% of the height (2 to 12 px), so small
 * competitors keep room for a label without squeezing the bands.
 */
export function competitorSankeyLayout(
  flows: Pick<CompetitorFlows, "sources" | "targets" | "links">,
  mode: SankeyMode,
  frame: { height: number; leftX: number; rightX: number },
): SankeyLayout {
  const rank = (c: CompetitorCategory) => COMPETITOR_CATEGORIES.indexOf(c);
  const right = [...flows.targets]
    .filter((t) => targetValue(t, mode) > 0)
    .sort(
      (a, b) =>
        rank(a.category) - rank(b.category) ||
        targetValue(b, mode) - targetValue(a, mode) ||
        a.name.localeCompare(b.name),
    );
  const padRight = Math.min(12, Math.max(2, (frame.height * 0.42) / Math.max(1, right.length - 1)));
  return layoutSankey(
    flows.sources.map((s) => ({ id: s.id })),
    right.map((t) => ({ id: t.id, group: t.category })),
    flows.links.map((l) => ({ source: l.source, target: l.target, value: linkValue(l, mode) })),
    {
      height: frame.height,
      leftX: frame.leftX,
      rightX: frame.rightX,
      nodeWidth: NODE_WIDTH,
      padLeft: 4,
      padRight,
      groupGap: SANKEY_GROUP_GAP,
      maxPad: 28,
      pinnedLeft: [OTHER_ID, UNNAMED_ID],
      groupOrder: COMPETITOR_CATEGORIES,
      iterations: 6,
    },
  );
}
