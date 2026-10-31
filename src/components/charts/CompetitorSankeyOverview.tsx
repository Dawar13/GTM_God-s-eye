"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ChartFrame, Legend, VizTooltip } from "@/components/ui-atlas";
import { formatCount, formatPartialDate, formatPercent, formatUsd, UNKNOWN } from "@/lib/format";
import { COMPETITOR_CATEGORY_LABELS, ROUND_STAGE_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import { CATEGORY_HUES, OTHER_GREY, markStyle, withOpacity } from "@/lib/viz";
import { COMPETITOR_CATEGORIES, type CompetitorCategory } from "@/lib/schema/enums";
import {
  OTHER_ID,
  UNNAMED_ID,
  dodgeLabels,
  ribbonPath,
  type CompetitorFlows,
  type FlowPair,
  type SankeyColumnNode,
  type SankeyMode,
} from "@/lib/viz/transforms/competitorSankey";
import {
  OVERVIEW_NODE_WIDTH,
  categoryNodeId,
  overviewHighlight,
  overviewLayout,
  overviewName,
  overviewValue,
  type CompetitorOverview,
  type OverviewFocus,
  type OverviewLink,
  type OverviewNode,
} from "@/lib/viz/transforms/competitorOverview";
import { ChartTable } from "./ChartTable";
import {
  HatchPattern,
  clip,
  competitorTip,
  dateSpan,
  moneyText,
  plural,
  share,
} from "./sankeyShared";

/** Node area height; the svg adds the column headings above and a margin below. */
const NODE_H = 780;
const TOP = 46;
const BOTTOM = 26;
const SVG_H = TOP + NODE_H + BOTTOM;
/** Narrower than this, the chart scrolls sideways inside its frame instead of squeezing. */
const MIN_WIDTH = 1040;
const W_NODE = OVERVIEW_NODE_WIDTH;
/** A label: name, amount and share lines (13, 13 and 11 px), and the gap between two labels. */
const LABEL_H = 42;
const LABEL_SPACE = 2;
/** Bar edge to label text; displaced labels draw a leader line across it. */
const LEAD = 22;
/** Room above the first category, and between categories, for the labels drawn above them. */
const MID_TOP = 56;
const MID_PAD = 64;
/** Average glyph width of 13px semibold Plex Sans, for cutting long names. */
const CHAR_W = 7.3;
/** Tiny nodes are drawn at least this tall so they stay visible; their value is unchanged. */
const MIN_DRAWN = 2;
const BAND = { rest: 0.36, faded: 0.07, lit: 0.78 } as const;
const HATCH = "sankey-overview-hatch";
const HALO: CSSProperties = {
  stroke: "var(--panel)",
  strokeWidth: 5,
  paintOrder: "stroke",
  strokeLinejoin: "round",
};

type Tip = { x: number; y: number; flip: boolean };
type Label = { name: string; amount: string; note: string };

const keyOf = (l: { source: string; target: string }) => `${l.source}|${l.target}`;
const mid = (n: { y0: number; y1: number }) => (n.y0 + n.y1) / 2;
/** A share to one decimal; a sliver above zero reads "<0.1%" rather than "0.0%". */
const pct = (f: number) => (f > 0 && f < 0.0005 ? "<0.1%" : formatPercent(f));

/**
 * "Who funds our competitors", overview: investors → competitor category → competitors, in the
 * spirit of an income-statement Sankey. Every number and position comes from
 * `competitorOverview.ts` and `competitorSankey.ts`; this only draws and handles hover, focus
 * and clicks.
 */
export function OverviewSankey({
  data,
  overview,
  mode,
  controls,
}: {
  data: CompetitorFlows;
  overview: CompetitorOverview;
  mode: SankeyMode;
  controls: ReactNode;
}) {
  const { open } = useInspector();
  const [outer, setOuter] = useState<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [focus, setFocus] = useState<OverviewFocus | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  /** The node focused from the keyboard: it gets the accent ring (a click focuses without one). */
  const [focusId, setFocusId] = useState<string | null>(null);

  // A callback ref: the box remounts when "View as table" switches back to the chart.
  useEffect(() => {
    if (!outer) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(outer);
    return () => ro.disconnect();
  }, [outer]);

  const W = Math.max(MIN_WIDTH, width ?? MIN_WIDTH);
  const leftArea = Math.round(Math.min(260, Math.max(210, W * 0.19)));
  const rightArea = Math.round(Math.min(290, Math.max(240, W * 0.21)));
  const xs = useMemo(() => {
    const x0 = leftArea;
    const x2 = W - rightArea - W_NODE;
    return [x0, Math.round((x0 + x2) / 2), x2] as const;
  }, [W, leftArea, rightArea]);
  const layout = useMemo(
    () =>
      overviewLayout(overview, mode, {
        height: NODE_H,
        x: xs,
        midTop: MID_TOP,
        midPad: MID_PAD,
        labelHeight: LABEL_H + LABEL_SPACE,
      }),
    [overview, mode, xs],
  );

  const nodes = useMemo(() => new Map(overview.nodes.map((n) => [n.id, n])), [overview.nodes]);
  const links = useMemo(() => new Map(overview.links.map((l) => [keyOf(l), l])), [overview.links]);
  const targets = useMemo(() => new Map(data.targets.map((t) => [t.id, t])), [data.targets]);
  /** Every investor and competitor name, for tooltips and the table. */
  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.sources) {
      if (s.kind === "investor") m.set(s.id, s.name);
      for (const x of s.members) m.set(x.id, x.name);
    }
    for (const t of data.targets) m.set(t.id, t.name);
    return m;
  }, [data.sources, data.targets]);
  const investorMoney = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data.sources) {
      if (s.kind === "investor") m.set(s.id, s.money);
      for (const x of s.members) m.set(x.id, x.money);
    }
    return m;
  }, [data.sources]);

  const lit = useMemo(
    () => (focus ? overviewHighlight(overview, focus, mode) : null),
    [overview, focus, mode],
  );

  const placed = new Map(layout.nodes.map((n) => [n.id, n]));
  const columns = [0, 1, 2].map((c) => layout.nodes.filter((n) => n.column === c));
  const total = layout.total;
  const top = -TOP + 28;
  const bottom = NODE_H + BOTTOM - 2;
  const labelY = [0, 2].map((c) =>
    dodgeLabels(
      columns[c]!.map((n) => ({ id: n.id, y: mid(n), height: LABEL_H, priority: n.value })),
      top,
      bottom,
      LABEL_SPACE,
    ),
  ) as [Map<string, number>, Map<string, number>];
  const labelYOf = (n: SankeyColumnNode) =>
    n.column === 0 ? labelY[0].get(n.id) : n.column === 2 ? labelY[1].get(n.id) : undefined;

  /* ------------------------------------------------------------------- labels */

  const amountOf = (o: OverviewNode): string => {
    if (mode === "rounds") return plural(o.roundCount, "round");
    return o.column === 0 ? moneyText(o.money, o.kind === "unnamed") : formatUsd(o.money);
  };
  const labelOf = (n: SankeyColumnNode): Label => {
    const o = nodes.get(n.id)!;
    const unit = mode === "money" ? "money" : "rounds";
    if (o.column === 2) {
      const cat = placed.get(categoryNodeId(o.category!));
      const label = COMPETITOR_CATEGORY_LABELS[o.category!].toLowerCase();
      return {
        name: overviewName(o, mode),
        amount: amountOf(o),
        note: cat ? `${pct(n.value / cat.value)} of ${label} ${unit}` : "",
      };
    }
    const estimate = o.column === 0 && (o.kind !== "unnamed" || mode === "rounds") ? "~" : "";
    const of = mode === "money" ? "all disclosed" : "all rounds";
    return {
      name: o.name,
      amount: amountOf(o),
      note: total > 0 ? `${estimate}${pct(n.value / total)} of ${of}` : "",
    };
  };

  /* ----------------------------------------------------------------- tooltips */

  const membersList = (ids: readonly string[], money: (id: string) => string, max = 8) => (
    <ul className="space-y-0.5 tabular-nums">
      {ids.slice(0, max).map((id) => (
        <li key={id}>
          {nameOf.get(id) ?? id}
          {money(id)}
        </li>
      ))}
      {ids.length > max && (
        <li>and {formatCount(ids.length - max)} more; View as table lists them all.</li>
      )}
    </ul>
  );
  const competitorMoney = (id: string) => {
    const t = targets.get(id);
    if (!t) return "";
    return mode === "money"
      ? t.disclosedUsd === null
        ? ", no disclosed amount"
        : ` ${formatUsd(t.disclosedUsd)}`
      : ` ${plural(t.rounds, "round")}`;
  };

  const nodeTip = (o: OverviewNode): ReactNode => {
    if (o.kind === "competitor") {
      const t = targets.get(o.id);
      return t ? competitorTip(t, mode) : null;
    }
    if (o.column === 0) {
      const bands = overview.links.filter((l) => l.source === o.id && overviewValue(l, mode) > 0);
      return (
        <VizTooltip
          className="max-w-80"
          title={o.name}
          value={
            mode === "money"
              ? moneyText(o.money, o.kind === "unnamed", true)
              : plural(o.roundCount, "round")
          }
          period={
            o.kind === "other"
              ? `${plural(o.members.length, "investor")}, ${plural(o.competitors, "competitor")}`
              : o.kind === "unnamed"
                ? `${plural(o.roundCount, "round")} at ${plural(o.competitors, "competitor")}`
                : `Backs ${plural(o.competitors, "competitor")}`
          }
          confidence={o.confidence}
          sourceDomain={o.sourceDomain}
        >
          <ul className="space-y-0.5 tabular-nums">
            {bands.map((l) => (
              <li key={l.target}>
                {nodes.get(l.target)?.name}:{" "}
                {mode === "money"
                  ? moneyText(l.money, o.kind === "unnamed")
                  : plural(l.roundIds.length, "round")}
              </li>
            ))}
          </ul>
          {o.kind === "other" && (
            <div className="mt-1">
              {membersList(o.members, (id) => {
                const m = investorMoney.get(id) ?? 0;
                return m > 0 ? ` ~${formatUsd(m)}` : "";
              })}
            </div>
          )}
          <p className="mt-1 text-xs">
            {o.kind === "unnamed"
              ? "Rounds whose sources name no investor: whole amounts, not estimates."
              : "Estimate: each round's amount split equally among its named investors."}
            {o.kind === "investor" ? " Click to open the profile." : ""}
          </p>
        </VizTooltip>
      );
    }
    // A category or a rest node: exact sums of disclosed rounds.
    const label = COMPETITOR_CATEGORY_LABELS[o.category!];
    return (
      <VizTooltip
        className="max-w-80"
        title={o.kind === "category" ? `${label} competitors` : overviewName(o, mode)}
        value={mode === "money" ? `${formatUsd(o.money)} disclosed` : plural(o.roundCount, "round")}
        period={`${plural(o.competitors, "competitor")} with a round, ${formatCount(o.membersWithMoney)} with a disclosed amount`}
        confidence={o.confidence}
        sourceDomain={o.sourceDomain}
      >
        {o.kind === "rest" && membersList(o.members, competitorMoney)}
        <p className="mt-1 text-xs tabular-nums">
          Exact: the sum of disclosed round amounts ({formatCount(o.roundsWithAmount)} of{" "}
          {plural(o.roundCount, "round")}).
        </p>
      </VizTooltip>
    );
  };

  const linkTip = (l: OverviewLink): ReactNode => {
    const s = nodes.get(l.source)!;
    const t = nodes.get(l.target)!;
    const behind = l.roundIds.map((id) => data.rounds[id]!).filter(Boolean);
    const shown = mode === "money" ? behind.filter((r) => r.amountUsd !== null) : behind;
    const unnamed = s.kind === "unnamed";
    if (l.stage === 0) {
      const paths = overview.paths
        .filter((p) => p.source === l.source && p.category === l.target)
        .filter((p) => overviewValue(p, mode) > 0)
        .sort((a, b) => overviewValue(b, mode) - overviewValue(a, mode));
      return (
        <VizTooltip
          className="max-w-80"
          title={`${s.name} → ${t.name}`}
          value={
            mode === "money" ? moneyText(l.money, unnamed, true) : plural(behind.length, "round")
          }
          period={dateSpan(shown)}
          confidence={l.confidence}
          sourceDomain={l.sourceDomain}
        >
          <ul className="space-y-0.5 tabular-nums">
            {paths.slice(0, 5).map((p) => (
              <li key={p.competitorId}>
                {nameOf.get(p.competitorId) ?? p.competitorId}:{" "}
                {mode === "money"
                  ? moneyText(p.money, unnamed)
                  : `${share(p.roundShare)} ${p.roundShare === 1 ? "round" : "rounds"} after splitting`}
              </li>
            ))}
            {paths.length > 5 && <li>and {plural(paths.length - 5, "more competitor")}</li>}
          </ul>
          {s.kind === "other" && (
            <p className="mt-1">
              Investors:{" "}
              {l.memberIds
                .slice(0, 6)
                .map((id) => nameOf.get(id) ?? id)
                .join(", ")}
              {l.memberIds.length > 6 ? ` and ${formatCount(l.memberIds.length - 6)} more` : ""}
            </p>
          )}
          <p className="mt-1 text-xs">
            {unnamed
              ? "The sources give these amounts but name no investor."
              : "Estimate: each round's amount split equally among its named investors."}
          </p>
        </VizTooltip>
      );
    }
    const rest = t.kind === "rest";
    return (
      <VizTooltip
        className="max-w-80"
        title={`${s.name} → ${overviewName(t, mode)}`}
        value={
          mode === "money" ? `${formatUsd(l.money)} disclosed` : plural(behind.length, "round")
        }
        period={dateSpan(shown)}
        confidence={l.confidence}
        sourceDomain={l.sourceDomain}
      >
        {rest ? (
          membersList(l.memberIds, competitorMoney)
        ) : (
          <ul className="space-y-0.5 tabular-nums">
            {shown.slice(0, 5).map((r) => (
              <li key={r.id}>
                {ROUND_STAGE_LABELS[r.stage]}, {formatPartialDate(r.date)}:{" "}
                {r.amountUsd === null ? "amount not disclosed" : formatUsd(r.amountUsd)}
              </li>
            ))}
            {shown.length > 5 && <li>and {plural(shown.length - 5, "more round")}</li>}
          </ul>
        )}
        <p className="mt-1 text-xs">Exact: the sum of disclosed round amounts.</p>
      </VizTooltip>
    );
  };

  let tipBody: ReactNode = null;
  if (focus && tip) {
    if (focus.kind === "link") {
      const l = links.get(keyOf(focus));
      if (l) tipBody = linkTip(l);
    } else {
      const o = nodes.get(focus.id);
      if (o) tipBody = nodeTip(o);
    }
  }

  /* -------------------------------------------------------------- interaction */

  const place = (e: MouseEvent) => {
    const box = inner.current?.getBoundingClientRect();
    if (!box) return;
    const x = e.clientX - box.left;
    setTip({ x, y: e.clientY - box.top, flip: x > W - 340 });
  };
  const clear = () => {
    setFocus(null);
    setTip(null);
  };
  const openable = (id: string) => {
    const k = nodes.get(id)?.kind;
    return k === "investor" || k === "competitor";
  };
  const onNodeKey = (e: KeyboardEvent, id: string) => {
    if ((e.key === "Enter" || e.key === " ") && openable(id)) {
      e.preventDefault();
      open(id);
    } else if (e.key === "Escape") clear();
  };

  /** A node's paint: its colour, grey for Other, the hatch for Investors not named. */
  const paint = (id: string) => {
    const o = nodes.get(id);
    if (!o || o.kind === "unnamed") return `url(#${HATCH})`;
    return o.kind === "other" ? OTHER_GREY : o.color;
  };
  const sliceFill = (l: OverviewLink) =>
    l.stage === 0 ? paint(l.source) : lit?.via ? paint(lit.via) : paint(l.source);
  const nodeDim = (id: string) => (lit && !lit.nodes.has(id) ? 0.28 : 1);

  /* -------------------------------------------------------------------- marks */

  const label3 = (
    x: number,
    y: number,
    anchor: "start" | "middle" | "end",
    l: Label,
    max: number,
    halo: boolean,
  ) => (
    <g style={halo ? HALO : undefined} className="tabular-nums">
      <text
        x={x}
        y={y - 14}
        dy="0.35em"
        textAnchor={anchor}
        fontSize="13"
        fontWeight={600}
        fill="var(--ink)"
      >
        {clip(l.name, max)}
      </text>
      <text
        x={x}
        y={y + 1}
        dy="0.35em"
        textAnchor={anchor}
        fontSize="13"
        fontWeight={600}
        fill="var(--ink)"
      >
        {l.amount}
      </text>
      <text x={x} y={y + 15} dy="0.35em" textAnchor={anchor} fontSize="11" fill="var(--muted)">
        {l.note}
      </text>
    </g>
  );
  const maxChars = (area: number) => Math.max(8, Math.floor((area - LEAD - 10) / CHAR_W));

  const ariaFor = (n: SankeyColumnNode): string => {
    const o = nodes.get(n.id)!;
    const l = labelOf(n);
    const amount =
      mode === "money"
        ? o.column === 0 && o.kind !== "unnamed"
          ? `about ${formatUsd(o.money)} estimated`
          : `${formatUsd(o.money)} disclosed`
        : plural(o.roundCount, "round");
    const where =
      o.column === 0
        ? "investor"
        : o.column === 1
          ? "competitor category"
          : `${COMPETITOR_CATEGORY_LABELS[o.category!].toLowerCase()} competitor`;
    return `${l.name}, ${where}: ${amount}, ${l.note}.${openable(n.id) ? " Press Enter to open." : ""}`;
  };

  const drawNode = (n: SankeyColumnNode) => {
    const o = nodes.get(n.id)!;
    const h = Math.max(MIN_DRAWN, n.y1 - n.y0);
    const y = mid(n) - h / 2;
    const focused = focusId === n.id;
    const l = labelOf(n);
    const ly = labelYOf(n);
    const m = markStyle(o.kind === "other" || o.kind === "unnamed" ? OTHER_GREY : o.color);
    const bar =
      o.kind === "unnamed" ? (
        <rect
          x={n.x0}
          y={y}
          width={W_NODE}
          height={h}
          fill={`url(#${HATCH})`}
          stroke={OTHER_GREY}
          strokeDasharray="2 2"
        />
      ) : o.kind === "rest" ? (
        <rect
          x={n.x0 + 0.5}
          y={y}
          width={W_NODE - 1}
          height={h}
          fill={withOpacity(o.color, 0.3)}
          stroke={m.stroke}
          strokeDasharray="3 2"
        />
      ) : (
        <rect
          x={n.x0}
          y={y}
          width={W_NODE}
          height={h}
          fill={m.fill}
          stroke={m.stroke}
          strokeWidth={1}
        />
      );

    let label: ReactNode = null;
    let lead: ReactNode = null;
    let hit: ReactNode = null;
    if (n.column === 1) {
      const cy = n.y0 - 8 - 21;
      label = label3(n.x0 + W_NODE / 2, cy, "middle", l, 24, true);
      hit = (
        <rect x={n.x0 - 70} y={cy - 22} width={W_NODE + 140} height={h + 52} fill="transparent" />
      );
    } else if (ly !== undefined) {
      const left = n.column === 0;
      const tx = left ? n.x0 - LEAD : n.x1 + LEAD;
      label = label3(
        tx,
        ly,
        left ? "end" : "start",
        l,
        maxChars(left ? leftArea : rightArea),
        false,
      );
      // A leader line when the label had to move off its node.
      if (Math.abs(ly - mid(n)) > Math.max(3, h / 2 - 3)) {
        const a = left ? n.x0 - 2 : n.x1 + 2;
        const b = left ? tx + 4 : tx - 4;
        const c = (a + b) / 2;
        lead = (
          <path
            d={`M${a},${mid(n)}C${c},${mid(n)} ${c},${ly} ${b},${ly}`}
            fill="none"
            stroke="var(--muted)"
            strokeOpacity={0.55}
            strokeWidth={1}
          />
        );
      }
      const lx = left ? tx - (leftArea - LEAD - 4) : tx;
      hit = (
        <>
          <rect
            x={left ? 0 : n.x0}
            y={mid(n) - Math.max(h, 12) / 2}
            width={left ? n.x1 : W - n.x0}
            height={Math.max(h, 12)}
            fill="transparent"
          />
          <rect
            x={lx}
            y={ly - LABEL_H / 2}
            width={(left ? leftArea : rightArea) - LEAD - 4}
            height={LABEL_H}
            fill="transparent"
          />
        </>
      );
    }
    return (
      <g
        key={n.id}
        tabIndex={0}
        role={openable(n.id) ? "button" : "img"}
        aria-label={ariaFor(n)}
        className="cursor-pointer transition-opacity duration-(--dur-open) ease-(--ease-out) outline-none"
        style={{ opacity: nodeDim(n.id) }}
        onMouseEnter={(e) => {
          setFocus({ kind: "node", id: n.id });
          place(e);
        }}
        onMouseMove={place}
        onMouseLeave={clear}
        onFocus={(e) => {
          if (!e.currentTarget.matches(":focus-visible")) return;
          setFocusId(n.id);
          setFocus({ kind: "node", id: n.id });
          setTip(
            n.column === 2
              ? { x: n.x0 - 10, y: n.y0 + TOP, flip: true }
              : { x: n.x1 + 10, y: n.y0 + TOP, flip: false },
          );
        }}
        onBlur={() => {
          setFocusId(null);
          clear();
        }}
        onClick={() => openable(n.id) && open(n.id)}
        onKeyDown={(e) => onNodeKey(e, n.id)}
      >
        {hit}
        {lead}
        {bar}
        {focused && (
          <rect
            x={n.x0 - 3}
            y={y - 3}
            width={W_NODE + 6}
            height={h + 6}
            rx={3}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}
        {label}
      </g>
    );
  };

  // Labels the dodge had to leave out (none with today's data) appear on hover, with a halo.
  const hoverLabels = lit
    ? layout.nodes.filter((n) => n.column !== 1 && lit.nodes.has(n.id) && labelYOf(n) === undefined)
    : [];

  /* -------------------------------------------------------------------- frame */

  const t = overview.totals;
  const empty = layout.nodes.length === 0;
  const named = overview.nodes.filter((n) => n.kind === "investor");
  const other = nodes.get(OTHER_ID);
  const unnamed = nodes.get(UNNAMED_ID);
  const categories = COMPETITOR_CATEGORIES.filter((c) => nodes.has(categoryNodeId(c)));
  const headline =
    mode === "money" ? (
      <>
        <span className="text-[28px] leading-9 font-semibold text-ink">{formatUsd(t.money)}</span>
        <span className="text-base text-ink-2">
          disclosed across {plural(t.roundsWithAmount, "round")} into{" "}
          {plural(t.competitorsWithAmount, "competitor")}
        </span>
      </>
    ) : (
      <>
        <span className="text-[28px] leading-9 font-semibold text-ink">
          {plural(t.rounds, "round")}
        </span>
        <span className="text-base text-ink-2">
          into {plural(t.competitorsWithRounds, "competitor")}; {formatCount(t.roundsWithAmount)} of
          them disclose an amount ({formatUsd(t.money)})
        </span>
      </>
    );

  return (
    <ChartFrame
      title="Who funds our competitors"
      subtitle={
        mode === "money"
          ? "Read left to right: investors, the kind of competitor they backed, then the competitors. Band width is disclosed money; investor amounts (~) are estimates, each round's amount split equally among its named investors."
          : "Read left to right: investors, the kind of competitor they backed, then the competitors. Band width is rounds; an investor's share (~) is each round split equally among its named investors."
      }
      action={controls}
      legend={
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-1.5 text-sm text-ink-2">
              <svg width="26" height="10" aria-hidden>
                {named.slice(0, 4).map((n, i) => (
                  <rect
                    key={n.id}
                    x={i * 6.5 + 0.5}
                    y="1"
                    width="5"
                    height="8"
                    fill={markStyle(n.color).fill}
                  />
                ))}
              </svg>
              Top {formatCount(named.length)} investors by estimated money, one colour each
            </span>
            <Legend
              kind="categorical"
              items={[
                ...(other
                  ? [
                      {
                        label: `Other investors (${formatCount(other.members.length)})`,
                        color: OTHER_GREY,
                        shape: "square" as const,
                      },
                    ]
                  : []),
              ]}
            />
            {unnamed && (
              <span className="flex items-center gap-1.5 text-sm text-ink-2">
                <svg width="10" height="10" aria-hidden>
                  <defs>
                    <HatchPattern id={`${HATCH}-key`} size={4} />
                  </defs>
                  <rect
                    x="0.5"
                    y="0.5"
                    width="9"
                    height="9"
                    fill={`url(#${HATCH}-key)`}
                    stroke={OTHER_GREY}
                    strokeDasharray="2 1"
                  />
                </svg>
                Investors not named ({plural(unnamed.roundCount, "round")})
              </span>
            )}
            <Legend
              kind="categorical"
              items={categories.map((c) => ({
                label: `${COMPETITOR_CATEGORY_LABELS[c]} competitors`,
                color: CATEGORY_HUES[c],
                shape: "square" as const,
              }))}
            />
          </div>
          <p className="text-xs text-muted">
            Amounts with ~ are estimates; category and competitor amounts are exact sums of
            disclosed rounds, so every column adds up to the same total. The{" "}
            {formatCount(categories.length)} categories each show their top competitors by disclosed
            money and one node for the rest. Hover or focus a node or band to trace its path.
          </p>
        </div>
      }
      sources={data.sourceDomains}
      notShown={
        mode === "money"
          ? [
              { count: data.roundsWithoutAmount, field: "amount", noun: "rounds" },
              {
                count: data.competitorsWithoutAmount,
                field: "a round with an amount",
                noun: "competitors",
              },
            ]
          : [{ count: data.competitorsWithoutRounds, field: "rounds", noun: "competitors" }]
      }
      height={SVG_H + 52}
      state={
        empty
          ? {
              status: "empty",
              message:
                "No competitor round names an investor or an amount yet. The table below lists each competitor's rounds.",
            }
          : { status: "ready" }
      }
      tableAlternative={
        <OverviewTable
          pairs={data.pairs}
          nameOf={nameOf}
          categoryOf={(id) => targets.get(id)?.category ?? null}
          onOpen={open}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">{headline}</p>
        <div ref={setOuter} className="scrollbar-subtle overflow-x-auto">
          {width === null ? (
            <div style={{ height: SVG_H }} />
          ) : (
            <div ref={inner} className="relative" style={{ width: W }}>
              <svg
                width={W}
                height={SVG_H}
                role="group"
                aria-label={`Sankey diagram in three columns: ${plural(columns[0]!.length, "investor node")}, ${plural(columns[1]!.length, "competitor category", "competitor categories")} and ${plural(columns[2]!.length, "competitor node")}. Tab to each node; View as table lists every investor and competitor.`}
                onMouseLeave={clear}
                className="block"
              >
                <defs>
                  <HatchPattern id={HATCH} />
                </defs>
                <g transform={`translate(0, ${TOP})`}>
                  <g aria-hidden fontSize="12" fontWeight={500} fill="var(--muted)">
                    <text x={xs[0] - LEAD} y={-TOP + 12} dy="0.35em" textAnchor="end">
                      Investors
                    </text>
                    <text x={xs[1] + W_NODE / 2} y={-TOP + 12} dy="0.35em" textAnchor="middle">
                      Competitor category
                    </text>
                    <text x={xs[2] + W_NODE + LEAD} y={-TOP + 12} dy="0.35em">
                      Competitors
                    </text>
                  </g>
                  <g aria-hidden>
                    {layout.links.map((l) => {
                      const key = keyOf(l);
                      const ol = links.get(key)!;
                      const a = placed.get(l.source)!;
                      const b = placed.get(l.target)!;
                      return (
                        <path
                          key={key}
                          d={ribbonPath(a.x1, l.sy, b.x0, l.ty, l.width)}
                          fill={paint(l.source)}
                          fillOpacity={lit ? BAND.faded : BAND.rest}
                          className="cursor-pointer transition-[fill-opacity] duration-(--dur-open) ease-(--ease-out)"
                          onMouseEnter={(e) => {
                            setFocus({ kind: "link", source: l.source, target: l.target });
                            place(e);
                          }}
                          onMouseMove={place}
                          onMouseLeave={clear}
                          onClick={() => {
                            const id = ol.stage === 0 ? l.source : l.target;
                            if (openable(id)) open(id);
                          }}
                        />
                      );
                    })}
                  </g>
                  {lit && (
                    <g aria-hidden className="pointer-events-none">
                      {layout.links.map((l) => {
                        const v = lit.links.get(keyOf(l));
                        if (!v) return null;
                        const a = placed.get(l.source)!;
                        const b = placed.get(l.target)!;
                        return (
                          <path
                            key={keyOf(l)}
                            d={ribbonPath(
                              a.x1,
                              l.sy,
                              b.x0,
                              l.ty,
                              Math.min(l.width, v * layout.scale),
                            )}
                            fill={sliceFill(links.get(keyOf(l))!)}
                            fillOpacity={BAND.lit}
                          />
                        );
                      })}
                    </g>
                  )}
                  {columns.map((c) => c.map(drawNode))}
                  <g aria-hidden className="pointer-events-none">
                    {hoverLabels.map((n) => (
                      <g key={`hover-${n.id}`}>
                        {label3(
                          n.column === 0 ? n.x0 - LEAD : n.x1 + LEAD,
                          mid(n),
                          n.column === 0 ? "end" : "start",
                          labelOf(n),
                          maxChars(n.column === 0 ? leftArea : rightArea),
                          true,
                        )}
                      </g>
                    ))}
                  </g>
                </g>
              </svg>
              {tipBody && tip && (
                <div
                  className="pointer-events-none absolute z-20"
                  // Below the pointer in the top half, above it in the bottom half, so the
                  // tooltip never runs past the chart and scrolls its box.
                  style={{
                    left: tip.flip ? tip.x - 14 : tip.x + 14,
                    top: tip.y > SVG_H / 2 ? tip.y - 14 : tip.y + 14,
                    transform: `translate(${tip.flip ? "-100%" : "0"}, ${tip.y > SVG_H / 2 ? "-100%" : "0"})`,
                  }}
                >
                  {tipBody}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ChartFrame>
  );
}

/** Every investor and competitor pair with its category, whole rounds and the estimated money. */
function OverviewTable({
  pairs,
  nameOf,
  categoryOf,
  onOpen,
}: {
  pairs: readonly FlowPair[];
  nameOf: ReadonlyMap<string, string>;
  categoryOf: (competitorId: string) => CompetitorCategory | null;
  onOpen: (id: string) => void;
}) {
  const rank = (id: string) => {
    const c = categoryOf(id);
    return c === null ? COMPETITOR_CATEGORIES.length : COMPETITOR_CATEGORIES.indexOf(c);
  };
  return (
    <ChartTable
      caption="Investor, competitor category and competitor, with rounds and estimated money (each round's amount split equally among its named investors)"
      rows={pairs}
      rowKey={(p) => `${p.investorId ?? UNNAMED_ID}|${p.competitorId}`}
      initialSort={{ column: "Estimated money", dir: "desc" }}
      limit={60}
      scrollClassName="max-h-[32rem]"
      columns={[
        {
          header: "Investor",
          sortValue: (p) =>
            p.investorId === null ? "~" : (nameOf.get(p.investorId) ?? "").toLowerCase(),
          cell: (p) =>
            p.investorId === null ? (
              <span className="text-ink-2">Investors not named</span>
            ) : (
              <button
                type="button"
                className="text-left text-accent hover:underline"
                onClick={() => onOpen(p.investorId!)}
              >
                {nameOf.get(p.investorId) ?? p.investorId}
              </button>
            ),
        },
        {
          header: "Category",
          sortValue: (p) => rank(p.competitorId),
          cell: (p) => {
            const c = categoryOf(p.competitorId);
            return c === null ? UNKNOWN : COMPETITOR_CATEGORY_LABELS[c];
          },
        },
        {
          header: "Competitor",
          sortValue: (p) => (nameOf.get(p.competitorId) ?? "").toLowerCase(),
          cell: (p) => (
            <button
              type="button"
              className="text-left text-accent hover:underline"
              onClick={() => onOpen(p.competitorId)}
            >
              {nameOf.get(p.competitorId) ?? p.competitorId}
            </button>
          ),
        },
        {
          header: "Rounds",
          numeric: true,
          sortValue: (p) => p.rounds,
          cell: (p) => formatCount(p.rounds),
        },
        {
          header: "Estimated money",
          numeric: true,
          sortValue: (p) => p.money,
          cell: (p) => (p.money === null ? UNKNOWN : moneyText(p.money, p.investorId === null)),
        },
      ]}
    />
  );
}
