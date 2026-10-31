/**
 * "Who funds our competitors", overview: a three-stage Sankey, the Competitors page's default
 * view. Investors (left) flow into the three competitor categories (middle), which flow into the
 * competitors (right).
 *
 * Built from `competitorFlows`, so the money is the same:
 *  - Investor amounts are the equal-split estimate: each round's disclosed amount split equally
 *    among its named investors. "Investors not named" carries whole rounds, so it is exact.
 *  - Category and competitor amounts are exact: sums of disclosed round amounts.
 *  - Every node conserves. What enters a category leaves it, and each column adds up to the same
 *    total: every disclosed amount, or every round in the rounds view.
 *
 * Left: the OVERVIEW_INVESTORS largest investors by estimated money, in the colours they have in
 * the two-column view, then "Other investors" and "Investors not named". Right, per category:
 * the OVERVIEW_PER_CATEGORY largest competitors by disclosed money, then one "N other …
 * competitors" node (a single leftover competitor is shown instead). Both choices are made on
 * money for both views, so nodes and colours stay put when the band width changes.
 */
import type { Round } from "@/lib/schema";
import type { CompetitorCategory } from "@/lib/schema/enums";
import { COMPETITOR_CATEGORIES } from "@/lib/schema/enums";
import { formatCount } from "@/lib/format";
import { COMPETITOR_CATEGORY_LABELS } from "@/lib/format/labels";
import { CATEGORY_HUES, OTHER_GREY } from "../palette";
import { provenanceOf } from "./common";
import {
  OTHER_ID,
  UNNAMED_ID,
  layoutSankeyColumns,
  type CompetitorFlows,
  type FlowRound,
  type FlowTarget,
  type SankeyColumnsLayout,
  type SankeyMode,
} from "./competitorSankey";
import { periodOf } from "./recentDeals";

/** Investors named on the left; the rest are "Other investors". */
export const OVERVIEW_INVESTORS = 10;
/** Competitors named per category on the right; the rest share one node. */
export const OVERVIEW_PER_CATEGORY = 5;

export const categoryNodeId = (c: CompetitorCategory) => `sankey:category:${c}`;
export const restNodeId = (c: CompetitorCategory) => `sankey:rest:${c}`;

type Provenance = Pick<FlowTarget, "sourceDomain" | "confidence">;

export type OverviewKind = "investor" | "other" | "unnamed" | "category" | "competitor" | "rest";

export type OverviewNode = Provenance & {
  id: string;
  column: 0 | 1 | 2;
  kind: OverviewKind;
  /** Display name; a rest node's counts its members per view (`overviewName`). */
  name: string;
  color: string;
  /** Null in the investor column. */
  category: CompetitorCategory | null;
  /**
   * Money: the equal-split estimate in the investor column (whole amounts for Investors not
   * named), exact sums of disclosed round amounts in the other two. 0 when there is none.
   */
  money: number;
  /** The rounds view's value: rounds split among named investors on the left, whole rounds elsewhere. */
  roundShare: number;
  /** Distinct rounds behind the node, and how many of them disclose an amount. */
  roundCount: number;
  roundsWithAmount: number;
  /** Competitors reached (investor column) or held (category, competitor, rest). */
  competitors: number;
  /**
   * Other investors: its investors. A category or rest node: its competitors with a round. Most
   * money first, then most rounds, then name. Empty for single investors and competitors.
   */
  members: string[];
  /** Members with money (a rest node's name in the money view counts these). */
  membersWithMoney: number;
};

export type OverviewLink = Provenance & {
  source: string;
  target: string;
  /** 0: investor to category; 1: category to competitor. */
  stage: 0 | 1;
  /** Estimated in stage 0 (whole for Investors not named), exact in stage 1; null with no amount. */
  money: number | null;
  /** Rounds split among named investors in stage 0, whole rounds in stage 1. */
  roundShare: number;
  /** Rounds behind the band, oldest first, undated last. */
  roundIds: string[];
  /** Stage 0: the investors in the band. Stage 1: its competitors (several for a rest node). */
  memberIds: string[];
};

/** One left node's money into one competitor, and the nodes it passes through. */
export type OverviewPath = {
  source: string;
  /** The category node. */
  category: string;
  /** The competitor's node: itself, or its category's rest node. */
  target: string;
  competitorId: string;
  money: number | null;
  roundShare: number;
};

export type CompetitorOverview = {
  /** Column 0 in rank order (Other, Not named last), column 1, then column 2 by category. */
  nodes: OverviewNode[];
  links: OverviewLink[];
  paths: OverviewPath[];
  totals: {
    /** Every disclosed amount of the competitors' rounds. */
    money: number;
    rounds: number;
    roundsWithAmount: number;
    competitorsWithAmount: number;
    competitorsWithRounds: number;
  };
};

/** A band's, path's or node's value in a view. */
export const overviewValue = (x: { money: number | null; roundShare: number }, mode: SankeyMode) =>
  mode === "money" ? (x.money ?? 0) : x.roundShare;

/** A node's name in a view: "19 other adjacent competitors" counts the members drawn there. */
export function overviewName(n: Pick<OverviewNode, "kind" | "name" | "category" | "members" | "membersWithMoney">, mode: SankeyMode): string {
  if (n.kind !== "rest" || n.category === null) return n.name;
  const k = mode === "money" ? n.membersWithMoney : n.members.length;
  const label = COMPETITOR_CATEGORY_LABELS[n.category].toLowerCase();
  return `${formatCount(k)} other ${label} ${k === 1 ? "competitor" : "competitors"}`;
}

const byDisclosed = (a: FlowTarget, b: FlowTarget) =>
  (b.disclosedUsd ?? 0) - (a.disclosedUsd ?? 0) || b.rounds - a.rounds || a.name.localeCompare(b.name);

/** Builds the overview from the flows; `rounds` only supplies sources and confidence. */
export function competitorOverview(
  flows: CompetitorFlows,
  rounds: readonly Round[],
): CompetitorOverview {
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const start = (r: FlowRound | undefined) =>
    r?.date ? (periodOf(r.date)?.start ?? null) : null;
  const ordered = (ids: Iterable<string>) =>
    [...new Set(ids)].sort((a, b) => {
      const x = start(flows.rounds[a]);
      const y = start(flows.rounds[b]);
      if (x === null || y === null) return x === y ? a.localeCompare(b) : x === null ? 1 : -1;
      return x - y || a.localeCompare(b);
    });
  const provenance = (ids: readonly string[]): Provenance =>
    provenanceOf(ids.map((id) => roundById.get(id)).filter((r): r is Round => r !== undefined));
  const withAmount = (ids: readonly string[]) =>
    ids.filter((id) => (flows.rounds[id]?.amountUsd ?? null) !== null).length;

  const named = flows.sources.filter((s) => s.kind === "investor");
  const top = named.slice(0, Math.min(OVERVIEW_INVESTORS, flows.namedByMoney));
  const topIds = new Set(top.map((s) => s.id));
  const sourceOf = (id: string) => (topIds.has(id) || id === UNNAMED_ID ? id : OTHER_ID);

  const targets = new Map(flows.targets.map((t) => [t.id, t]));
  const shown = new Set<string>();
  for (const c of COMPETITOR_CATEGORIES) {
    const ranked = flows.targets
      .filter((t) => t.category === c && (t.disclosedUsd ?? 0) > 0)
      .sort(byDisclosed);
    const keep = ranked.length <= OVERVIEW_PER_CATEGORY + 1 ? ranked : ranked.slice(0, OVERVIEW_PER_CATEGORY);
    for (const t of keep) shown.add(t.id);
  }
  const targetOf = (t: FlowTarget) => (shown.has(t.id) ? t.id : restNodeId(t.category));
  const roundsOf = new Map<string, string[]>();
  for (const r of Object.values(flows.rounds)) {
    roundsOf.set(r.companyId, [...(roundsOf.get(r.companyId) ?? []), r.id]);
  }

  // Paths: one per left node and competitor (investors outside the top ten join Other's).
  type PathAcc = OverviewPath & { roundIds: string[]; investorIds: string[] };
  const pathAcc = new Map<string, PathAcc>();
  for (const l of flows.links) {
    const t = targets.get(l.target)!;
    const source = sourceOf(l.source);
    const key = `${source}|${t.id}`;
    const p = pathAcc.get(key) ?? {
      source,
      category: categoryNodeId(t.category),
      target: targetOf(t),
      competitorId: t.id,
      money: null,
      roundShare: 0,
      roundIds: [],
      investorIds: [],
    };
    if (l.money !== null) p.money = (p.money ?? 0) + l.money;
    p.roundShare += l.roundShare;
    p.roundIds.push(...l.roundIds);
    p.investorIds.push(...l.investorIds);
    pathAcc.set(key, p);
  }

  // Stage 0: left node to category, summed over the paths.
  const stage0 = new Map<string, PathAcc>();
  for (const p of pathAcc.values()) {
    const key = `${p.source}|${p.category}`;
    const a = stage0.get(key) ?? { ...p, money: null, roundShare: 0, roundIds: [], investorIds: [] };
    if (p.money !== null) a.money = (a.money ?? 0) + p.money;
    a.roundShare += p.roundShare;
    a.roundIds.push(...p.roundIds);
    a.investorIds.push(...p.investorIds);
    stage0.set(key, a);
  }

  // Money per investor, for ordering Other's members.
  const investorMoney = new Map<string, number>();
  const investorRounds = new Map<string, number>();
  for (const s of flows.sources) {
    if (s.kind === "investor") investorMoney.set(s.id, s.money);
    for (const m of s.members) investorMoney.set(m.id, m.money);
  }
  for (const p of flows.pairs) {
    if (p.investorId !== null) {
      investorRounds.set(p.investorId, (investorRounds.get(p.investorId) ?? 0) + p.rounds);
    }
  }
  const nameOf = new Map<string, string>();
  for (const s of flows.sources) {
    if (s.kind === "investor") nameOf.set(s.id, s.name);
    for (const m of s.members) nameOf.set(m.id, m.name);
  }
  const byInvestorMoney = (a: string, b: string) =>
    (investorMoney.get(b) ?? 0) - (investorMoney.get(a) ?? 0) ||
    (investorRounds.get(b) ?? 0) - (investorRounds.get(a) ?? 0) ||
    (nameOf.get(a) ?? a).localeCompare(nameOf.get(b) ?? b);
  const byCompetitor = (a: string, b: string) => byDisclosed(targets.get(a)!, targets.get(b)!);

  const links: OverviewLink[] = [...stage0.values()].map((a) => {
    const ids = ordered(a.roundIds);
    return {
      source: a.source,
      target: a.category,
      stage: 0,
      money: a.money,
      roundShare: a.roundShare,
      roundIds: ids,
      memberIds: [...new Set(a.investorIds)].sort(byInvestorMoney),
      ...provenance(ids),
    };
  });

  // Stage 1: category to competitor node, from the competitors' own totals (exact).
  const stage1 = new Map<string, { source: string; target: string; ids: string[] }>();
  for (const t of flows.targets) {
    if (t.rounds === 0) continue;
    const source = categoryNodeId(t.category);
    const target = targetOf(t);
    const key = `${source}|${target}`;
    const a = stage1.get(key) ?? { source, target, ids: [] };
    a.ids.push(t.id);
    stage1.set(key, a);
  }
  const sumOf = (ids: readonly string[]) => {
    const ts = ids.map((id) => targets.get(id)!);
    const amounts = ts.map((t) => t.disclosedUsd).filter((m): m is number => m !== null);
    const roundIds = ordered(ids.flatMap((id) => roundsOf.get(id) ?? []));
    return {
      money: amounts.length ? amounts.reduce((x, y) => x + y, 0) : null,
      rounds: ts.reduce((x, t) => x + t.rounds, 0),
      roundsWithAmount: ts.reduce((x, t) => x + t.roundsWithAmount, 0),
      roundIds,
      withMoney: amounts.filter((m) => m > 0).length,
    };
  };
  for (const a of stage1.values()) {
    const s = sumOf(a.ids);
    links.push({
      source: a.source,
      target: a.target,
      stage: 1,
      money: s.money,
      roundShare: s.rounds,
      roundIds: s.roundIds,
      memberIds: [...a.ids].sort(byCompetitor),
      ...provenance(s.roundIds),
    });
  }

  // Column 0.
  const leftNode = (
    id: string,
    kind: "investor" | "other" | "unnamed",
    name: string,
    color: string,
  ): OverviewNode | null => {
    const mine = [...pathAcc.values()].filter((p) => p.source === id);
    if (mine.length === 0) return null;
    const ids = ordered(mine.flatMap((p) => p.roundIds));
    const members =
      kind === "other" ? [...new Set(mine.flatMap((p) => p.investorIds))].sort(byInvestorMoney) : [];
    return {
      id,
      column: 0,
      kind,
      name,
      color,
      category: null,
      money: mine.reduce((a, p) => a + (p.money ?? 0), 0),
      roundShare: mine.reduce((a, p) => a + p.roundShare, 0),
      roundCount: ids.length,
      roundsWithAmount: withAmount(ids),
      competitors: new Set(mine.map((p) => p.competitorId)).size,
      members,
      membersWithMoney: members.filter((m) => (investorMoney.get(m) ?? 0) > 0).length,
      ...provenance(ids),
    };
  };
  const nodes: OverviewNode[] = [
    ...top.map((s) => leftNode(s.id, "investor", s.name, s.color)),
    leftNode(OTHER_ID, "other", "Other investors", OTHER_GREY),
    leftNode(UNNAMED_ID, "unnamed", "Investors not named", OTHER_GREY),
  ].filter((n): n is OverviewNode => n !== null);

  // Columns 1 and 2.
  const right: OverviewNode[] = [];
  for (const c of COMPETITOR_CATEGORIES) {
    const all = flows.targets.filter((t) => t.category === c && t.rounds > 0).sort(byDisclosed);
    if (all.length === 0) continue;
    const s = sumOf(all.map((t) => t.id));
    nodes.push({
      id: categoryNodeId(c),
      column: 1,
      kind: "category",
      name: COMPETITOR_CATEGORY_LABELS[c],
      color: CATEGORY_HUES[c],
      category: c,
      money: s.money ?? 0,
      roundShare: s.rounds,
      roundCount: s.rounds,
      roundsWithAmount: s.roundsWithAmount,
      competitors: all.length,
      members: all.map((t) => t.id),
      membersWithMoney: s.withMoney,
      ...provenance(s.roundIds),
    });
    for (const t of all.filter((x) => shown.has(x.id))) {
      right.push({
        id: t.id,
        column: 2,
        kind: "competitor",
        name: t.name,
        color: CATEGORY_HUES[c],
        category: c,
        money: t.disclosedUsd ?? 0,
        roundShare: t.rounds,
        roundCount: t.rounds,
        roundsWithAmount: t.roundsWithAmount,
        competitors: 1,
        members: [],
        membersWithMoney: 0,
        sourceDomain: t.sourceDomain,
        confidence: t.confidence,
      });
    }
    const rest = all.filter((x) => !shown.has(x.id));
    if (rest.length > 0) {
      const r = sumOf(rest.map((t) => t.id));
      right.push({
        id: restNodeId(c),
        column: 2,
        kind: "rest",
        name: `Other ${COMPETITOR_CATEGORY_LABELS[c].toLowerCase()} competitors`,
        color: CATEGORY_HUES[c],
        category: c,
        money: r.money ?? 0,
        roundShare: r.rounds,
        roundCount: r.rounds,
        roundsWithAmount: r.roundsWithAmount,
        competitors: rest.length,
        members: rest.map((t) => t.id),
        membersWithMoney: r.withMoney,
        ...provenance(r.roundIds),
      });
    }
  }
  nodes.push(...right);

  return {
    nodes,
    links,
    paths: [...pathAcc.values()].map((p) => ({
      source: p.source,
      category: p.category,
      target: p.target,
      competitorId: p.competitorId,
      money: p.money,
      roundShare: p.roundShare,
    })),
    totals: {
      money: flows.totals.money,
      rounds: flows.totals.rounds,
      roundsWithAmount: flows.totals.roundsWithAmount,
      competitorsWithAmount: flows.targets.filter((t) => (t.disclosedUsd ?? 0) > 0).length,
      competitorsWithRounds: flows.targets.filter((t) => t.rounds > 0).length,
    },
  };
}

/* --------------------------------------------------------------------------- layout */

export const OVERVIEW_NODE_WIDTH = 24;
/** Gaps between investors, and between competitors (plus a wider gap between categories). */
export const OVERVIEW_PAD = { investors: 16, competitors: 12, categories: 26 } as const;

/**
 * The overview in one view, three columns at `frame.x`. Investors are sorted to cut crossings,
 * Other and Not named pinned at the bottom; categories keep the order direct, adjacent, remote,
 * at least `frame.midPad` apart with `frame.midTop` free above the first (room for the labels
 * drawn above them); competitors are grouped by category, biggest first, the rest node last.
 */
export function overviewLayout(
  o: Pick<CompetitorOverview, "nodes" | "links">,
  mode: SankeyMode,
  frame: {
    height: number;
    x: readonly [number, number, number];
    midTop: number;
    midPad: number;
    /** Height of a label beside an investor or competitor (see SankeyColumn.labelHeight). */
    labelHeight: number;
  },
): SankeyColumnsLayout {
  const col = (c: 0 | 1 | 2) =>
    o.nodes.filter((n) => n.column === c).map((n) => ({ id: n.id, group: n.category ?? undefined }));
  return layoutSankeyColumns(
    [
      {
        x: frame.x[0],
        nodes: col(0),
        pad: OVERVIEW_PAD.investors,
        pinned: [OTHER_ID, UNNAMED_ID],
        labelHeight: frame.labelHeight,
      },
      {
        x: frame.x[1],
        nodes: col(1),
        pad: frame.midPad,
        reserveTop: frame.midTop,
        fixed: true,
      },
      {
        x: frame.x[2],
        nodes: col(2),
        pad: OVERVIEW_PAD.competitors,
        groupGap: OVERVIEW_PAD.categories,
        groupOrder: COMPETITOR_CATEGORIES,
        labelHeight: frame.labelHeight,
      },
    ],
    o.links.map((l) => ({ source: l.source, target: l.target, value: overviewValue(l, mode) })),
    { height: frame.height, nodeWidth: OVERVIEW_NODE_WIDTH, maxPad: 40, iterations: 6 },
  );
}

/* ------------------------------------------------------------------------ highlight */

export type OverviewFocus =
  | { kind: "node"; id: string }
  | { kind: "link"; source: string; target: string };

export type OverviewLit = {
  nodes: Set<string>;
  /** Band key ("source|target") to the part of the band on the lit paths, in view units. */
  links: Map<string, number>;
  /** The left node whose paths are lit, when the focus is one or one of its bands. */
  via: string | null;
};

/**
 * What a hovered or focused node or band lights: every path through it. Each band's lit value is
 * the part of it on those paths (the whole band when they all are), so an investor shows as a
 * slice of each category-to-competitor band it reaches, and a competitor as a slice of each
 * investor's band into its category.
 */
export function overviewHighlight(
  o: Pick<CompetitorOverview, "paths">,
  focus: OverviewFocus,
  mode: SankeyMode,
): OverviewLit {
  const on = o.paths.filter((p) =>
    overviewValue(p, mode) > 0 &&
    (focus.kind === "node"
      ? p.source === focus.id || p.category === focus.id || p.target === focus.id
      : (p.source === focus.source && p.category === focus.target) ||
        (p.category === focus.source && p.target === focus.target)),
  );
  const nodes = new Set<string>();
  const links = new Map<string, number>();
  const add = (key: string, v: number) => links.set(key, (links.get(key) ?? 0) + v);
  for (const p of on) {
    const v = overviewValue(p, mode);
    nodes.add(p.source).add(p.category).add(p.target);
    add(`${p.source}|${p.category}`, v);
    add(`${p.category}|${p.target}`, v);
  }
  if (focus.kind === "node") nodes.add(focus.id);
  const via = focus.kind === "node" ? focus.id : focus.source;
  return { nodes, links, via: on.some((p) => p.source === via) ? via : null };
}
