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
 * The layout is a small two-column version of the d3-sankey idea, kept here so it is pure and
 * tested: node height = scale × value with one scale for both columns (so every node's height
 * is the sum of its band widths), nodes ordered by the barycentre of their partners to cut
 * crossings, and bands stacked at each node in the order of the node at their other end.
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

export type SankeyLink = {
  /** Index into the input links. */
  index: number;
  source: string;
  target: string;
  value: number;
  /** Band width, px. */
  width: number;
  /** Top of the band at the source node and at the target node. */
  sy: number;
  ty: number;
};

export type SankeyGroup = { group: string; y0: number; y1: number; count: number };

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

type Pos = { y0: number; y1: number };

/**
 * Two-column Sankey layout. Links with no positive value and nodes left with none are dropped.
 * Node heights are scale × value; the column that needs more room for its gaps sets the scale
 * and fills the height, the other spreads its gaps (up to `maxPad`) and is centred.
 */
export function layoutSankey(
  leftIn: readonly SankeyNodeIn[],
  rightIn: readonly SankeyNodeIn[],
  linksIn: readonly SankeyLinkIn[],
  o: SankeyLayoutOptions,
): SankeyLayout {
  const leftIds = new Set(leftIn.map((n) => n.id));
  const rightIds = new Set(rightIn.map((n) => n.id));
  const kept = linksIn
    .map((l, index) => ({ ...l, index }))
    .filter(
      (l) =>
        Number.isFinite(l.value) && l.value > 0 && leftIds.has(l.source) && rightIds.has(l.target),
    );
  const lv = new Map<string, number>();
  const rv = new Map<string, number>();
  for (const l of kept) {
    lv.set(l.source, (lv.get(l.source) ?? 0) + l.value);
    rv.set(l.target, (rv.get(l.target) ?? 0) + l.value);
  }
  const total = kept.reduce((a, l) => a + l.value, 0);
  if (!(total > 0)) return { nodes: [], links: [], groups: [], scale: 0, total: 0 };

  const pinned = (o.pinnedLeft ?? []).filter((id) => lv.has(id));
  let free = leftIn.map((n) => n.id).filter((id) => lv.has(id) && !pinned.includes(id));
  const groupOf = new Map(rightIn.map((n) => [n.id, n.group ?? ""]));
  const rightKept = rightIn.filter((n) => rv.has(n.id));
  const groupNames = [
    ...new Set([...(o.groupOrder ?? []), ...rightKept.map((n) => n.group ?? "")]),
  ].filter((g) => rightKept.some((n) => (n.group ?? "") === g));
  let groups = groupNames.map((g) =>
    rightKept.filter((n) => (n.group ?? "") === g).map((n) => n.id),
  );

  const nL = free.length + pinned.length;
  const nR = rightKept.length;
  const gg = o.groupGap ?? 0;
  const availL = o.height - Math.max(0, nL - 1) * o.padLeft;
  const availR = o.height - Math.max(0, nR - 1) * o.padRight - Math.max(0, groups.length - 1) * gg;
  const scale = Math.max(0, Math.min(availL, availR)) / total;
  const maxPad = Math.max(o.maxPad ?? Number.POSITIVE_INFINITY, o.padLeft, o.padRight);

  /** Stacks a column; `breaks` holds the indexes that start a new group. */
  const stack = (ids: string[], values: Map<string, number>, pad: number, breaks: Set<number>) => {
    const pos = new Map<string, Pos>();
    const n = ids.length;
    const nodeSum = ids.reduce((a, id) => a + scale * values.get(id)!, 0);
    const spare = o.height - nodeSum - Math.max(0, n - 1) * pad - breaks.size * gg;
    const gap = n > 1 ? Math.min(pad + Math.max(0, spare) / (n - 1), maxPad) : 0;
    const used = nodeSum + Math.max(0, n - 1) * gap + breaks.size * gg;
    let y = Math.max(0, (o.height - used) / 2);
    ids.forEach((id, i) => {
      if (breaks.has(i)) y += gg;
      const h = scale * values.get(id)!;
      pos.set(id, { y0: y, y1: y + h });
      y += h + gap;
    });
    return pos;
  };
  const leftPos = () => stack([...free, ...pinned], lv, o.padLeft, new Set());
  const rightPos = () => {
    const breaks = new Set<number>();
    let i = 0;
    groups.forEach((g, gi) => {
      if (gi > 0) breaks.add(i);
      i += g.length;
    });
    return stack(groups.flat(), rv, o.padRight, breaks);
  };
  const mid = (p: Pos) => (p.y0 + p.y1) / 2;

  const outgoing = new Map<string, typeof kept>();
  const incoming = new Map<string, typeof kept>();
  for (const l of kept) {
    outgoing.set(l.source, [...(outgoing.get(l.source) ?? []), l]);
    incoming.set(l.target, [...(incoming.get(l.target) ?? []), l]);
  }
  const barycentre = (ls: typeof kept, at: Map<string, Pos>, end: "source" | "target") => {
    let w = 0;
    let s = 0;
    for (const l of ls) {
      w += l.value;
      s += l.value * mid(at.get(l[end])!);
    }
    return w > 0 ? s / w : 0;
  };
  const sortBy = (ids: string[], key: (id: string) => number) => {
    const before = new Map(ids.map((id, i) => [id, i]));
    return [...ids].sort((a, b) => key(a) - key(b) || before.get(a)! - before.get(b)!);
  };

  for (let it = 0; it < (o.iterations ?? 0); it++) {
    const r = rightPos();
    free = sortBy(free, (id) => barycentre(outgoing.get(id)!, r, "target"));
    const l = leftPos();
    groups = groups.map((g) => sortBy(g, (id) => barycentre(incoming.get(id)!, l, "source")));
  }
  const lp = leftPos();
  const rp = rightPos();

  // Bands leave a node in the order of their target and arrive in the order of their source.
  const placed = new Map<number, { sy: number; ty: number }>();
  for (const [id, ls] of outgoing) {
    let y = lp.get(id)!.y0;
    const order = [...ls].sort(
      (a, b) =>
        mid(rp.get(a.target)!) - mid(rp.get(b.target)!) ||
        a.target.localeCompare(b.target) ||
        a.index - b.index,
    );
    for (const l of order) {
      placed.set(l.index, { sy: y, ty: 0 });
      y += scale * l.value;
    }
  }
  for (const [id, ls] of incoming) {
    let y = rp.get(id)!.y0;
    const order = [...ls].sort(
      (a, b) =>
        mid(lp.get(a.source)!) - mid(lp.get(b.source)!) ||
        a.source.localeCompare(b.source) ||
        a.index - b.index,
    );
    for (const l of order) {
      placed.get(l.index)!.ty = y;
      y += scale * l.value;
    }
  }

  const leftX1 = o.leftX + o.nodeWidth;
  const rightX0 = o.rightX - o.nodeWidth;
  const nodes: SankeyNode[] = [
    ...[...free, ...pinned].map((id) => ({
      id,
      side: "left" as const,
      group: null,
      value: lv.get(id)!,
      x0: o.leftX,
      x1: leftX1,
      ...lp.get(id)!,
    })),
    ...groups.flat().map((id) => ({
      id,
      side: "right" as const,
      group: groupOf.get(id) ?? null,
      value: rv.get(id)!,
      x0: rightX0,
      x1: o.rightX,
      ...rp.get(id)!,
    })),
  ];
  return {
    nodes,
    links: kept.map((l) => ({
      index: l.index,
      source: l.source,
      target: l.target,
      value: l.value,
      width: scale * l.value,
      ...placed.get(l.index)!,
    })),
    groups: groups.map((g, i) => ({
      group: groupNames[i]!,
      y0: rp.get(g[0]!)!.y0,
      y1: rp.get(g[g.length - 1]!)!.y1,
      count: g.length,
    })),
    scale,
    total,
  };
}

/** Pairs of bands that cross between the columns (judged at their centre lines). */
export function countCrossings(layout: Pick<SankeyLayout, "links">): number {
  const c = layout.links.map((l) => ({ s: l.sy + l.width / 2, t: l.ty + l.width / 2 }));
  let n = 0;
  for (let i = 0; i < c.length; i++) {
    for (let j = i + 1; j < c.length; j++) {
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
