import { describe, expect, it } from "vitest";
import type { Competitor, Investor, Round } from "@/lib/schema";
import { COMPETITOR_CATEGORIES } from "@/lib/schema/enums";
import { CATEGORICAL_WIDE, CATEGORY_HUES, OTHER_GREY } from "@/lib/viz/palette";
import {
  MAX_NAMED,
  OTHER_ID,
  TOP_BY_MONEY,
  UNNAMED_ID,
  competitorFlows,
  competitorSankeyLayout,
  countCrossings,
  dodgeLabels,
  layoutSankey,
  layoutSankeyColumns,
  placeLabels,
  ribbonPath,
  sankeyHeight,
  type SankeyLayout,
} from "@/lib/viz/transforms/competitorSankey";
import {
  OVERVIEW_INVESTORS,
  OVERVIEW_PER_CATEGORY,
  categoryNodeId,
  competitorOverview,
  overviewHighlight,
  overviewLayout,
  overviewName,
  overviewValue,
  restNodeId,
} from "@/lib/viz/transforms/competitorOverview";

const src = [{ url: "https://example.com/a", kind: "primary", retrieved_at: "2026-10-01" }];

function comp(id: string, over: Partial<Competitor> = {}): Competitor {
  return {
    id,
    name: id.toUpperCase(),
    category: "direct",
    layer: "plant_ops",
    total_raised_usd: null,
    sources: src,
    confidence: "high",
    ...over,
  } as unknown as Competitor;
}

function round(id: string, company_id: string, over: Partial<Round> = {}): Round {
  return {
    id,
    company_id,
    date: "2025-03",
    date_precision: "month",
    stage: "seed",
    amount_usd: 1_000_000,
    lead_investor_ids: [],
    participant_investor_ids: [],
    unspecified_investor_ids: [],
    contested: false,
    sources: src,
    confidence: "high",
    ...over,
  } as unknown as Round;
}

const inv = (id: string, name = id) => ({ id, name }) as unknown as Investor;

describe("competitorFlows: the equal-split estimate", () => {
  const competitors = [
    comp("co_a", { total_raised_usd: 130 }),
    comp("co_b", { category: "adjacent", total_raised_usd: 90 }),
    comp("co_c", { category: "remote" }),
    comp("co_d"),
  ];
  const investors = [inv("i1"), inv("i2"), inv("i3"), inv("i4"), inv("i5")];
  const rounds = [
    round("r1", "co_a", {
      amount_usd: 100,
      lead_investor_ids: ["i1"],
      participant_investor_ids: ["i2"],
    }),
    round("r2", "co_a", { amount_usd: 30 }), // no named investor
    round("r3", "co_b", {
      amount_usd: 60,
      lead_investor_ids: ["i1"],
      unspecified_investor_ids: ["i3", "i4"],
    }),
    round("r4", "co_b", { amount_usd: null, participant_investor_ids: ["i2"] }),
    round("r5", "co_c", { amount_usd: null, lead_investor_ids: ["i5", "ghost"] }),
    round("r9", "co_other", { amount_usd: 999, lead_investor_ids: ["i1"] }), // not a competitor
  ];
  const f = competitorFlows(competitors, rounds, investors);
  const link = (s: string, t: string) => f.links.find((l) => l.source === s && l.target === t);

  it("splits each round's amount and count equally among its named investors", () => {
    expect(link("i1", "co_a")?.money).toBe(50);
    expect(link("i2", "co_a")?.money).toBe(50);
    expect(link("i1", "co_b")?.money).toBe(20);
    expect(link("i3", "co_b")?.money).toBe(20);
    expect(link("i1", "co_b")?.roundShare).toBeCloseTo(1 / 3, 12);
    // A round with no amount adds rounds, not money.
    expect(link("i2", "co_b")).toMatchObject({ money: null, roundShare: 1, roundIds: ["r4"] });
    // An id with no investor record is not counted; i5 (no money, one competitor) is in Other.
    expect(link(OTHER_ID, "co_c")).toMatchObject({
      money: null,
      roundShare: 1,
      investorIds: ["i5"],
    });
    expect(f.links.some((l) => l.target === "co_other")).toBe(false);
  });

  it("rounds with an amount and no named investor flow whole from Investors not named", () => {
    expect(link(UNNAMED_ID, "co_a")).toMatchObject({ money: 30, roundShare: 1, roundIds: ["r2"] });
    expect(f.sources.at(-1)).toMatchObject({ id: UNNAMED_ID, kind: "unnamed", money: 30 });
    expect(f.roundsWithoutInvestors).toBe(1);
  });

  it("conserves money and rounds: each competitor's inflow is its disclosed amounts and its rounds", () => {
    for (const t of f.targets) {
      const inflow = f.links.filter((l) => l.target === t.id);
      expect(inflow.reduce((a, l) => a + (l.money ?? 0), 0)).toBeCloseTo(t.disclosedUsd ?? 0, 9);
      expect(inflow.reduce((a, l) => a + l.roundShare, 0)).toBeCloseTo(t.rounds, 9);
    }
    expect(f.targets.find((t) => t.id === "co_a")).toMatchObject({ disclosedUsd: 130, rounds: 2 });
    expect(f.targets.find((t) => t.id === "co_c")).toMatchObject({ disclosedUsd: null, rounds: 1 });
    expect(f.totals).toEqual({ money: 190, rounds: 5, roundsWithAmount: 3 });
  });

  it("counts what each view leaves out", () => {
    expect(f.roundsWithoutAmount).toBe(2);
    expect(f.competitorsWithoutAmount).toBe(2); // co_c (no amount) and co_d (no rounds)
    expect(f.competitorsWithoutRounds).toBe(1);
    expect(f.investors).toBe(5);
    expect(f.multiBackers).toBe(2); // i1 and i2
  });

  it("lists every investor-competitor pair with whole rounds for the table", () => {
    expect(f.pairs).toHaveLength(8);
    expect(f.pairs.find((p) => p.investorId === "i2" && p.competitorId === "co_b")).toEqual({
      investorId: "i2",
      competitorId: "co_b",
      rounds: 1,
      money: null,
    });
    expect(f.pairs.find((p) => p.investorId === null)).toMatchObject({
      competitorId: "co_a",
      rounds: 1,
    });
  });
});

describe("competitorFlows: named investors, Other investors and colours", () => {
  // 25 single-competitor investors with falling amounts, and 3 small investors backing two.
  const competitors = [comp("co_a"), comp("co_b", { category: "adjacent" }), comp("co_c")];
  const solo = Array.from({ length: 25 }, (_, i) => `s${String(i).padStart(2, "0")}`);
  const multi = ["m1", "m2", "m3"];
  const investors = [...solo, ...multi].map((id) => inv(id));
  const rounds = [
    ...solo.map((id, i) =>
      round(`r_${id}`, "co_a", { amount_usd: 1000 - i * 10, lead_investor_ids: [id] }),
    ),
    round("rm_a", "co_b", { amount_usd: 3, participant_investor_ids: multi }),
    round("rm_b", "co_c", { amount_usd: 3, participant_investor_ids: multi }),
  ];
  const f = competitorFlows(competitors, rounds, investors);
  const named = f.sources.filter((s) => s.kind === "investor");

  it("names the top investors by money, then those backing two or more competitors", () => {
    expect(named.slice(0, TOP_BY_MONEY).map((s) => s.id)).toEqual(solo.slice(0, TOP_BY_MONEY));
    expect(named.slice(TOP_BY_MONEY, TOP_BY_MONEY + 3).map((s) => s.id)).toEqual(multi);
    expect(named.length).toBe(Math.min(MAX_NAMED, TOP_BY_MONEY + 3));
    expect(f.namedMultiBackers).toBe(3);
  });

  it("gives every named investor its own palette colour, in rank order", () => {
    expect(named.map((s) => s.color)).toEqual(CATEGORICAL_WIDE.slice(0, named.length));
    expect(new Set(named.map((s) => s.color)).size).toBe(named.length);
  });

  it("groups everyone else in Other investors, with its members", () => {
    const other = f.sources.find((s) => s.id === OTHER_ID)!;
    expect(other).toMatchObject({ kind: "other", color: OTHER_GREY });
    expect(other.members.map((m) => m.id)).toEqual(solo.slice(TOP_BY_MONEY));
    const sum = solo.slice(TOP_BY_MONEY).reduce((a, _, i) => a + 1000 - (i + TOP_BY_MONEY) * 10, 0);
    expect(other.money).toBe(sum);
    expect(f.links.find((l) => l.source === OTHER_ID)?.investorIds).toHaveLength(
      other.members.length,
    );
  });
});

describe("layoutSankey", () => {
  const left = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "z" }];
  const right = [
    { id: "x", group: "g1" },
    { id: "y", group: "g1" },
    { id: "w", group: "g2" },
    { id: "q", group: "g2" },
  ];
  const links = [
    { source: "a", target: "w", value: 4 },
    { source: "a", target: "x", value: 1 },
    { source: "b", target: "y", value: 3 },
    { source: "c", target: "x", value: 2 },
    { source: "c", target: "w", value: 0 }, // nothing drawn at zero
    { source: "z", target: "q", value: 1 },
  ];
  const opts = {
    height: 300,
    leftX: 100,
    rightX: 500,
    nodeWidth: 10,
    padLeft: 8,
    padRight: 8,
    groupGap: 20,
    pinnedLeft: ["z"],
    groupOrder: ["g1", "g2"],
    iterations: 4,
  };
  const L = layoutSankey(left, right, links, opts);
  const node = (id: string) => L.nodes.find((n) => n.id === id)!;

  it("drops zero-value links and keeps one scale for both columns", () => {
    expect(L.links).toHaveLength(5);
    expect(L.total).toBe(11);
    for (const n of L.nodes) expect(n.y1 - n.y0).toBeCloseTo(n.value * L.scale, 9);
  });

  it("conserves: every node is exactly as tall as the bands that meet it, stacked inside it", () => {
    for (const n of L.nodes) {
      const own = L.links.filter((l) => (n.side === "left" ? l.source : l.target) === n.id);
      expect(own.reduce((a, l) => a + l.width, 0)).toBeCloseTo(n.y1 - n.y0, 9);
      const tops = own.map((l) => (n.side === "left" ? l.sy : l.ty)).sort((p, q) => p - q);
      expect(tops[0]).toBeCloseTo(n.y0, 9);
      for (const l of own) {
        const top = n.side === "left" ? l.sy : l.ty;
        expect(top).toBeGreaterThanOrEqual(n.y0 - 1e-9);
        expect(top + l.width).toBeLessThanOrEqual(n.y1 + 1e-9);
      }
    }
  });

  it("keeps nodes apart, inside the height, with groups and pins in order", () => {
    for (const side of ["left", "right"] as const) {
      const col = L.nodes.filter((n) => n.side === side);
      for (let i = 1; i < col.length; i++) {
        expect(col[i]!.y0 - col[i - 1]!.y1).toBeGreaterThanOrEqual(8 - 1e-9);
      }
      expect(col[0]!.y0).toBeGreaterThanOrEqual(0);
      expect(col.at(-1)!.y1).toBeLessThanOrEqual(300 + 1e-9);
    }
    expect(L.nodes.filter((n) => n.side === "left").at(-1)!.id).toBe("z");
    expect(L.groups.map((g) => g.group)).toEqual(["g1", "g2"]);
    expect(L.groups[1]!.y0 - L.groups[0]!.y1).toBeGreaterThanOrEqual(8 + 20 - 1e-9);
    expect(node("a").x0).toBe(100);
    expect(node("a").x1).toBe(110);
    expect(node("x").x1).toBe(500);
  });

  it("orders nodes to cut crossings", () => {
    const naive = layoutSankey(left, right, links, { ...opts, iterations: 0 });
    expect(countCrossings(naive)).toBeGreaterThan(0);
    expect(countCrossings(L)).toBeLessThanOrEqual(countCrossings(naive));
    // A pair drawn crossed in input order comes out uncrossed.
    const crossed = [
      { source: "p", target: "y", value: 2 },
      { source: "q", target: "x", value: 1 },
      { source: "q", target: "y", value: 1 },
    ];
    const lr = [{ id: "p" }, { id: "q" }];
    const rr = [{ id: "x" }, { id: "y" }];
    const base = { ...opts, pinnedLeft: [], groupOrder: [] };
    expect(countCrossings(layoutSankey(lr, rr, crossed, { ...base, iterations: 0 }))).toBe(1);
    expect(countCrossings(layoutSankey(lr, rr, crossed, base))).toBe(0);
  });

  it("returns an empty layout when nothing has value", () => {
    const empty = layoutSankey(left, right, [{ source: "a", target: "x", value: 0 }], opts);
    expect(empty).toEqual({ nodes: [], links: [], groups: [], scale: 0, total: 0 });
  });
});

describe("drawing helpers", () => {
  it("ribbonPath is a closed band of the given width at both ends", () => {
    expect(ribbonPath(0, 10, 100, 40, 5)).toBe("M0,10C50,10 50,40 100,40L100,45C50,45 50,15 0,15Z");
  });

  it("placeLabels keeps the biggest labels and never overlaps two", () => {
    const kept = placeLabels(
      [
        { id: "small", y: 20, height: 14, priority: 1 },
        { id: "big", y: 26, height: 14, priority: 9 },
        { id: "far", y: 60, height: 14, priority: 0 },
        { id: "edge", y: 2, height: 14, priority: 5 },
      ],
      0,
      100,
    );
    expect([...kept].sort()).toEqual(["big", "far"]);
  });

  it("sankeyHeight scales with the competitors that have rounds, within 820 to 1,000 px", () => {
    const t = (n: number) =>
      ({ targets: Array.from({ length: n }, () => ({ rounds: 1 })) }) as never;
    expect(sankeyHeight(t(10))).toBe(820);
    expect(sankeyHeight(t(45))).toBe(900);
    expect(sankeyHeight(t(80))).toBe(1000);
  });
});

describe("competitorSankeyLayout", () => {
  const competitors = [
    comp("co_a"),
    comp("co_b", { category: "adjacent" }),
    comp("co_c", { category: "remote" }),
  ];
  const rounds = [
    round("r1", "co_c", { amount_usd: 10, lead_investor_ids: ["i1"] }),
    round("r2", "co_a", { amount_usd: 5, lead_investor_ids: ["i1", "i2"] }),
    round("r3", "co_b", { amount_usd: null, lead_investor_ids: ["i2"] }),
    round("r4", "co_a", { amount_usd: 7 }),
  ];
  const f = competitorFlows(competitors, rounds, [inv("i1"), inv("i2")]);
  const frame = { height: 820, leftX: 200, rightX: 900 };
  const sum = (l: SankeyLayout, side: "left" | "right") =>
    l.nodes.filter((n) => n.side === side).reduce((a, n) => a + n.value, 0);

  it("money view: competitor nodes are their disclosed amounts; rounds with no amount are not drawn", () => {
    const L = competitorSankeyLayout(f, "money", frame);
    expect(sum(L, "right")).toBeCloseTo(22, 9);
    expect(sum(L, "left")).toBeCloseTo(22, 9);
    expect(L.nodes.some((n) => n.id === "co_b")).toBe(false);
    expect(L.groups.map((g) => g.group)).toEqual(["direct", "remote"]);
    expect(L.nodes.filter((n) => n.side === "left").at(-1)!.id).toBe(UNNAMED_ID);
  });

  it("rounds view: competitor nodes are their round counts", () => {
    const L = competitorSankeyLayout(f, "rounds", frame);
    expect(sum(L, "right")).toBeCloseTo(4, 9);
    expect(L.nodes.find((n) => n.id === "co_a")!.value).toBeCloseTo(2, 9);
    expect(L.groups.map((g) => g.group)).toEqual(["direct", "adjacent", "remote"]);
  });
});

describe("CATEGORICAL_WIDE stays distinguishable", () => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin) as [number, number, number];
  };
  const lab = (hex: string) => {
    const [r, g, b] = rgb(hex);
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
    const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
    const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const deltaE = (a: string, b: string) => {
    const [p, q] = [lab(a), lab(b)];
    return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!);
  };
  const luminance = (hex: string) => {
    const [r, g, b] = rgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
    return (x! + 0.05) / (y! + 0.05);
  };

  it("has one colour per named investor, all different", () => {
    expect(CATEGORICAL_WIDE).toHaveLength(MAX_NAMED);
    expect(new Set(CATEGORICAL_WIDE).size).toBe(CATEGORICAL_WIDE.length);
  });

  it("keeps every pair at least ΔE 12 apart and every hue ΔE 20 from the Other grey", () => {
    for (let i = 0; i < CATEGORICAL_WIDE.length; i++) {
      expect(deltaE(CATEGORICAL_WIDE[i]!, OTHER_GREY)).toBeGreaterThanOrEqual(20);
      for (let j = i + 1; j < CATEGORICAL_WIDE.length; j++) {
        expect(deltaE(CATEGORICAL_WIDE[i]!, CATEGORICAL_WIDE[j]!)).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("gives every hue at least 3:1 against the dark panel", () => {
    for (const c of CATEGORICAL_WIDE) expect(contrast(c, "#1D2026")).toBeGreaterThanOrEqual(3);
  });

  it("keeps the three category hues from the palette, ΔE 40 apart and ΔE 20 from the Other grey", () => {
    const hues = Object.values(CATEGORY_HUES);
    for (let i = 0; i < hues.length; i++) {
      expect(CATEGORICAL_WIDE).toContain(hues[i]);
      expect(deltaE(hues[i]!, OTHER_GREY)).toBeGreaterThanOrEqual(20);
      for (let j = i + 1; j < hues.length; j++) {
        expect(deltaE(hues[i]!, hues[j]!)).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

describe("layoutSankeyColumns: three columns", () => {
  const cols = [
    { x: 0, nodes: [{ id: "a" }, { id: "b" }], pad: 10 },
    { x: 200, nodes: [{ id: "m1" }, { id: "m2" }], pad: 40, reserveTop: 30, fixed: true },
    { x: 400, nodes: [{ id: "x" }, { id: "y" }, { id: "z" }], pad: 10 },
  ];
  const links = [
    { source: "a", target: "m2", value: 3 },
    { source: "b", target: "m1", value: 2 },
    { source: "a", target: "m1", value: 1 },
    { source: "m1", target: "x", value: 1 },
    { source: "m1", target: "z", value: 2 },
    { source: "m2", target: "y", value: 3 },
    { source: "a", target: "x", value: 5 }, // skips a column: dropped
  ];
  const opts = { height: 400, nodeWidth: 20, iterations: 4 };
  const L = layoutSankeyColumns(cols, links, opts);
  const node = (id: string) => L.nodes.find((n) => n.id === id)!;

  it("conserves at every node: as tall as its bands on each side, which stack inside it", () => {
    expect(L.links).toHaveLength(6);
    for (const n of L.nodes) {
      expect(n.y1 - n.y0).toBeCloseTo(n.value * L.scale, 9);
      for (const side of ["in", "out"] as const) {
        const own = L.links.filter((l) => (side === "in" ? l.target : l.source) === n.id);
        if (own.length === 0) continue;
        expect(own.reduce((a, l) => a + l.width, 0)).toBeCloseTo(n.y1 - n.y0, 9);
        for (const l of own) {
          const top = side === "in" ? l.ty : l.sy;
          expect(top).toBeGreaterThanOrEqual(n.y0 - 1e-9);
          expect(top + l.width).toBeLessThanOrEqual(n.y1 + 1e-9);
        }
      }
    }
    for (const id of ["m1", "m2"]) expect(node(id).valueIn).toBeCloseTo(node(id).valueOut, 12);
    const colSum = (c: number) =>
      L.nodes.filter((n) => n.column === c).reduce((a, n) => a + n.value, 0);
    expect([colSum(0), colSum(1), colSum(2)]).toEqual([6, 6, 6]);
  });

  it("places columns at their x, keeps a fixed column's order and its reserved top", () => {
    expect([node("a").x0, node("m1").x0, node("x").x0]).toEqual([0, 200, 400]);
    expect(node("m1").x1).toBe(220);
    expect(node("m1").y1).toBeLessThan(node("m2").y0);
    expect(node("m1").y0).toBeGreaterThanOrEqual(30);
    expect(node("m2").y0 - node("m1").y1).toBeGreaterThanOrEqual(40 - 1e-9);
  });

  it("orders free columns to cut crossings between each pair of columns", () => {
    const naive = layoutSankeyColumns(cols, links, { ...opts, iterations: 0 });
    expect(countCrossings(naive)).toBeGreaterThan(0);
    expect(countCrossings(L)).toBe(0);
  });

  it("gives spare room to the gaps whose labels collide, never below the pad", () => {
    // The right column (pad 30) sets the scale; the left has 30 px to spare.
    const left = { x: 0, nodes: ["p", "q", "r", "s"].map((id) => ({ id })), pad: 20 };
    const right = { x: 100, nodes: ["t1", "t2", "t3", "t4"].map((id) => ({ id })), pad: 30 };
    const ls = [
      { source: "p", target: "t1", value: 50 },
      { source: "q", target: "t2", value: 1 },
      { source: "r", target: "t3", value: 1 },
      { source: "s", target: "t4", value: 50 },
    ];
    const o2 = { height: 300, nodeWidth: 10 };
    const plain = layoutSankeyColumns([left, right], ls, o2);
    const aware = layoutSankeyColumns([{ ...left, labelHeight: 60 }, right], ls, o2);
    expect(aware.scale).toBe(plain.scale);
    const gap = (G: typeof plain, a: string, b: string) =>
      G.nodes.find((n) => n.id === b)!.y0 - G.nodes.find((n) => n.id === a)!.y1;
    // Plain: the spare is spread evenly over the three gaps.
    expect(gap(plain, "q", "r")).toBeCloseTo(30, 9);
    // Label-aware: all of it goes between the two small nodes, whose labels collide.
    expect(gap(aware, "q", "r")).toBeCloseTo(50, 9);
    expect(gap(aware, "p", "q")).toBeCloseTo(20, 9);
    expect(gap(aware, "r", "s")).toBeCloseTo(20, 9);
    for (const n of aware.nodes) expect(n.y1).toBeLessThanOrEqual(300 + 1e-9);
  });
});

describe("dodgeLabels", () => {
  const box = (id: string, y: number, priority = 1) => ({ id, y, height: 40, priority });

  it("leaves labels that do not collide on their marks", () => {
    const at = dodgeLabels([box("a", 30), box("b", 100), box("c", 200)], 0, 300);
    expect([...at.entries()]).toEqual([
      ["a", 30],
      ["b", 100],
      ["c", 200],
    ]);
  });

  it("spreads a crowded run around its marks without overlaps, in order, inside the bounds", () => {
    const items = [box("a", 150), box("b", 152), box("c", 154), box("d", 156), box("e", 5)];
    const at = dodgeLabels(items, 0, 400, 2);
    const ys = ["e", "a", "b", "c", "d"].map((id) => at.get(id)!);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(42 - 1e-9);
    }
    expect(ys[0]! - 20).toBeGreaterThanOrEqual(0);
    expect(ys.at(-1)! + 20).toBeLessThanOrEqual(400);
    // The run of four is centred on the mean of its marks (153), the least-squares position.
    expect((at.get("a")! + at.get("d")!) / 2).toBeCloseTo(153, 6);
  });

  it("keeps a run inside the bounds and drops the lowest priority when they cannot all fit", () => {
    const edge = dodgeLabels([box("a", 395), box("b", 398)], 0, 400, 2);
    expect(edge.get("b")! + 20).toBeLessThanOrEqual(400 + 1e-9);
    expect(edge.get("b")! - edge.get("a")!).toBeCloseTo(42, 9);
    const full = dodgeLabels([box("a", 10, 5), box("b", 20, 1), box("c", 30, 9)], 0, 90, 2);
    expect([...full.keys()].sort()).toEqual(["a", "c"]);
  });
});

describe("competitorOverview", () => {
  // Eight direct competitors (five named, three in the rest), two adjacent, one remote with no
  // amount, one with no rounds; twelve investors with falling money and m1 backing two categories.
  const directs = Array.from({ length: 8 }, (_, k) => comp(`d${k + 1}`));
  const competitors = [
    ...directs,
    comp("a1", { category: "adjacent" }),
    comp("a2", { category: "adjacent" }),
    comp("r1", { category: "remote" }),
    comp("d9"),
  ];
  const iid = (k: number) => `i${String(k).padStart(2, "0")}`;
  const investors = ["m1", ...Array.from({ length: 12 }, (_, k) => iid(k + 1))].map((id) =>
    inv(id),
  );
  const rounds = [
    ...directs.map((_, k) =>
      round(`rd${k + 1}`, `d${k + 1}`, {
        amount_usd: 90 - k * 10,
        lead_investor_ids: [iid(k + 1)],
      }),
    ),
    round("ra1", "a1", { amount_usd: 500, lead_investor_ids: ["i09", "m1"] }),
    round("ra2", "a2", {
      amount_usd: 300,
      lead_investor_ids: ["i10"],
      participant_investor_ids: ["i11"],
    }),
    round("rd1b", "d1", { amount_usd: 60, lead_investor_ids: ["m1", "i12"] }),
    round("rr1", "r1", { amount_usd: null, lead_investor_ids: ["i12"] }),
    round("ru", "d2", { amount_usd: 40 }),
  ];
  const flows = competitorFlows(competitors, rounds, investors);
  const o = competitorOverview(flows, rounds);
  const col = (c: number) => o.nodes.filter((n) => n.column === c);
  const byId = (id: string) => o.nodes.find((n) => n.id === id)!;
  const frame = {
    height: 700,
    x: [200, 500, 800] as const,
    midTop: 50,
    midPad: 60,
    labelHeight: 44,
  };

  it("names the top investors by estimated money in their usual colours, then Other and Not named", () => {
    const left = col(0);
    expect(left.map((n) => n.id)).toEqual([
      "m1",
      "i09",
      "i10",
      "i11",
      "i01",
      "i02",
      "i03",
      "i04",
      "i05",
      "i06",
      OTHER_ID,
      UNNAMED_ID,
    ]);
    expect(left.slice(0, OVERVIEW_INVESTORS).map((n) => n.color)).toEqual(
      CATEGORICAL_WIDE.slice(0, OVERVIEW_INVESTORS),
    );
    const other = byId(OTHER_ID);
    expect(other).toMatchObject({ kind: "other", color: OTHER_GREY, money: 80 });
    expect(other.members).toEqual(["i12", "i07", "i08"]); // most money, then most rounds
    expect(byId(UNNAMED_ID)).toMatchObject({ kind: "unnamed", money: 40 });
  });

  it("shows the top competitors of each category and one rest node, coloured by category", () => {
    expect(col(1).map((n) => n.id)).toEqual(COMPETITOR_CATEGORIES.map(categoryNodeId));
    expect(col(2).map((n) => n.id)).toEqual([
      "d1",
      "d2",
      "d3",
      "d4",
      "d5",
      restNodeId("direct"),
      "a1",
      "a2",
      restNodeId("remote"),
    ]);
    expect(OVERVIEW_PER_CATEGORY).toBe(5);
    for (const n of [...col(1), ...col(2)]) expect(n.color).toBe(CATEGORY_HUES[n.category!]);
    const rest = byId(restNodeId("direct"));
    expect(rest.members).toEqual(["d6", "d7", "d8"]);
    expect(overviewName(rest, "money")).toBe("3 other direct competitors");
    const remote = byId(restNodeId("remote"));
    expect(overviewName(remote, "rounds")).toBe("1 other remote competitor");
  });

  it("keeps category and competitor money exact and investor money an equal-split estimate", () => {
    expect(byId(categoryNodeId("direct")).money).toBe(540);
    expect(byId(categoryNodeId("adjacent")).money).toBe(800);
    expect(byId("d1").money).toBe(150);
    expect(byId("m1").money).toBe(280); // 500 ÷ 2 + 60 ÷ 2
    expect(o.totals).toEqual({
      money: 1340,
      rounds: 13,
      roundsWithAmount: 12,
      competitorsWithAmount: 10,
      competitorsWithRounds: 11,
    });
  });

  it("conserves in both views: every column adds up to the same total, categories pass it on", () => {
    for (const mode of ["money", "rounds"] as const) {
      const L = overviewLayout(o, mode, frame);
      const want = mode === "money" ? 1340 : 13;
      for (const c of [0, 1, 2]) {
        const sum = L.nodes.filter((n) => n.column === c).reduce((a, n) => a + n.value, 0);
        expect(sum).toBeCloseTo(want, 9);
      }
      for (const n of L.nodes) {
        expect(n.value).toBeCloseTo(overviewValue(byId(n.id), mode), 9);
        if (n.column === 1) expect(n.valueIn).toBeCloseTo(n.valueOut, 9);
      }
      // Nothing drawn at zero: the remote competitor has no amount, so only the rounds view has it.
      expect(L.nodes.some((n) => n.id === categoryNodeId("remote"))).toBe(mode === "rounds");
    }
  });

  it("places the overview's labels without overlaps", () => {
    const L = overviewLayout(o, "money", frame);
    for (const c of [0, 2]) {
      const ns = L.nodes.filter((n) => n.column === c);
      const at = dodgeLabels(
        ns.map((n) => ({ id: n.id, y: (n.y0 + n.y1) / 2, height: 42, priority: n.value })),
        -20,
        720,
        2,
      );
      expect(at.size).toBe(ns.length);
      const ys = [...at.values()].sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(44 - 1e-9);
      }
    }
    const mids = L.nodes.filter((n) => n.column === 1);
    expect(mids[0]!.y0).toBeGreaterThanOrEqual(frame.midTop);
    for (let i = 1; i < mids.length; i++) {
      expect(mids[i]!.y0 - mids[i - 1]!.y1).toBeGreaterThanOrEqual(frame.midPad - 1e-9);
    }
  });

  it("lights every path through a hovered node: an investor as slices of its competitors' bands", () => {
    const m1 = overviewHighlight(o, { kind: "node", id: "m1" }, "money");
    expect(m1.via).toBe("m1");
    expect(m1.links.get(`${categoryNodeId("direct")}|d1`)).toBeCloseTo(30, 9);
    expect(m1.links.get(`${categoryNodeId("adjacent")}|a1`)).toBeCloseTo(250, 9);
    const out = [...m1.links].filter(([k]) => k.startsWith("sankey:category"));
    expect(out.reduce((a, [, v]) => a + v, 0)).toBeCloseTo(280, 9);

    const d1 = overviewHighlight(o, { kind: "node", id: "d1" }, "money");
    expect(d1.via).toBeNull();
    const into = [...d1.links].filter(([k]) => !k.startsWith("sankey:category"));
    expect(into.reduce((a, [, v]) => a + v, 0)).toBeCloseTo(150, 9);
    expect(d1.nodes).toEqual(new Set(["m1", "i01", OTHER_ID, categoryNodeId("direct"), "d1"]));

    const band = overviewHighlight(
      o,
      { kind: "link", source: "m1", target: categoryNodeId("adjacent") },
      "rounds",
    );
    expect(band.via).toBe("m1");
    expect([...band.links.keys()].sort()).toEqual(
      [`m1|${categoryNodeId("adjacent")}`, `${categoryNodeId("adjacent")}|a1`].sort(),
    );
  });
});
