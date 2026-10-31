"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ChartFrame, Legend, Segmented, VizTooltip } from "@/components/ui-atlas";
import { formatCount, formatPartialDate, formatUsd, UNKNOWN } from "@/lib/format";
import { COMPETITOR_CATEGORY_LABELS, LAYER_LABELS, ROUND_STAGE_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import { CATEGORICAL_WIDE, COMPANY_GREY, OTHER_GREY, markStyle, withOpacity } from "@/lib/viz";
import {
  OTHER_ID,
  UNNAMED_ID,
  competitorSankeyLayout,
  placeLabels,
  ribbonPath,
  sankeyHeight,
  type CompetitorFlows,
  type FlowLink,
  type FlowPair,
  type FlowRound,
  type FlowSource,
  type FlowTarget,
  type SankeyMode,
  type SankeyNode,
} from "@/lib/viz/transforms/competitorSankey";
import type { CompetitorCategory } from "@/lib/schema/enums";
import { ChartTable } from "./ChartTable";

/** Space above the first node for the first group's label, and below the last. */
const TOP = 26;
const BOTTOM = 12;
/** Narrower than this, the chart scrolls sideways instead of squeezing its labels. */
const MIN_WIDTH = 760;
const LABEL_GAP = 8;
/** A label's line box; nodes closer than this share labels through hover. */
const LINE = 14;
/** Average glyph width of 12px Plex Sans, for cutting long names. */
const CHAR_W = 6.4;
/** Tiny nodes are drawn at least this tall so they stay visible; their value is unchanged. */
const MIN_DRAWN = 1;
const BAND = { rest: 0.4, active: 0.85, faded: 0.08 } as const;
const HATCH = "sankey-hatch";

type Active = { kind: "node"; id: string } | { kind: "link"; key: string } | null;
type Tip = { x: number; y: number; flip: boolean };

const linkKey = (l: Pick<FlowLink, "source" | "target">) => `${l.source}|${l.target}`;
const plural = (n: number, one: string, many = `${one}s`) =>
  `${formatCount(n)} ${n === 1 ? one : many}`;
const clip = (s: string, max: number) =>
  s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;
/** Money behind a node or band: split among named investors it is an estimate, "not named" is whole. */
const moneyText = (usd: number | null, exact: boolean, long = false) =>
  exact
    ? `${formatUsd(usd)}${long ? " disclosed" : ""}`
    : `~${formatUsd(usd)}${long ? " estimated" : ""}`;
/** Rounds as drawn in the rounds view: whole numbers plain, splits to one decimal. */
const share = (v: number) =>
  Math.abs(v - Math.round(v)) < 1e-9 ? formatCount(Math.round(v)) : v.toFixed(1);

function dateSpan(rounds: readonly FlowRound[]): string | null {
  const dated = rounds.map((r) => r.date).filter((d): d is string => d !== null);
  if (dated.length === 0) return rounds.length ? "Dates not recorded" : null;
  const first = formatPartialDate(dated[0]);
  const last = formatPartialDate(dated[dated.length - 1]);
  return first === last ? first : `${first} to ${last}`;
}

/**
 * "Who funds our competitors": investors on the left, competitors on the right, band width =
 * estimated money (equal split) or rounds. Layout and every number come from
 * `competitorSankey.ts`; this only draws and handles hover, focus and clicks.
 */
export function CompetitorSankey({ data }: { data: CompetitorFlows }) {
  const { open } = useInspector();
  const [mode, setMode] = useState<SankeyMode>("money");
  const [outer, setOuter] = useState<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [active, setActive] = useState<Active>(null);
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

  const height = sankeyHeight(data);
  const W = Math.max(MIN_WIDTH, width ?? MIN_WIDTH);
  const leftLabel = Math.round(Math.min(250, Math.max(170, W * 0.2)));
  const rightLabel = Math.round(Math.min(300, Math.max(200, W * 0.24)));
  const layout = useMemo(
    () => competitorSankeyLayout(data, mode, { height, leftX: leftLabel, rightX: W - rightLabel }),
    [data, mode, height, leftLabel, rightLabel, W],
  );

  const sources = useMemo(() => new Map(data.sources.map((s) => [s.id, s])), [data.sources]);
  const targets = useMemo(() => new Map(data.targets.map((t) => [t.id, t])), [data.targets]);
  const links = useMemo(() => new Map(data.links.map((l) => [linkKey(l), l])), [data.links]);
  /** Every investor and competitor name, for band tooltips and the table. */
  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.sources) {
      if (s.kind === "investor") m.set(s.id, s.name);
      for (const x of s.members) m.set(x.id, x.name);
    }
    for (const t of data.targets) m.set(t.id, t.name);
    return m;
  }, [data.sources, data.targets]);

  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  const other = sources.get(OTHER_ID);
  const unnamed = sources.get(UNNAMED_ID);
  const named = data.sources.filter((s) => s.kind === "investor");

  // What the hovered or focused mark touches.
  const lit = useMemo(() => {
    if (!active) return null;
    const ls = layout.links.filter((l) =>
      active.kind === "node"
        ? l.source === active.id || l.target === active.id
        : linkKey(l) === active.key,
    );
    const nodes = new Set(ls.flatMap((l) => [l.source, l.target]));
    if (active.kind === "node") nodes.add(active.id);
    return { links: new Set(ls.map(linkKey)), nodes };
  }, [active, layout.links]);

  const leftNodes = layout.nodes.filter((n) => n.side === "left");
  const rightNodes = layout.nodes.filter((n) => n.side === "right");
  const mid = (n: SankeyNode) => (n.y0 + n.y1) / 2;
  const leftLabels = placeLabels(
    leftNodes.map((n) => ({ id: n.id, y: mid(n), height: LINE, priority: n.value })),
    -TOP,
    height + BOTTOM,
  );
  const groupLabelY = (y0: number) => y0 - 17;
  const rightLabels = placeLabels(
    [
      ...layout.groups.map((g) => ({
        id: `group:${g.group}`,
        y: groupLabelY(g.y0),
        height: LINE,
        priority: Number.POSITIVE_INFINITY,
      })),
      ...rightNodes.map((n) => ({ id: n.id, y: mid(n), height: LINE, priority: n.value })),
    ],
    -TOP,
    height + BOTTOM,
  );

  const sourceValue = (s: FlowSource) =>
    mode === "money" ? moneyText(s.money, s.kind === "unnamed") : plural(s.roundCount, "round");
  const targetValue = (t: FlowTarget) =>
    mode === "money" ? formatUsd(t.disclosedUsd) : plural(t.rounds, "round");

  const place = (e: MouseEvent) => {
    const box = inner.current?.getBoundingClientRect();
    if (!box) return;
    const x = e.clientX - box.left;
    setTip({ x, y: e.clientY - box.top, flip: x > W - 320 });
  };
  const focusNode = (n: SankeyNode) => {
    setActive({ kind: "node", id: n.id });
    setTip(
      n.side === "left"
        ? { x: n.x1 + 10, y: n.y0 + TOP, flip: false }
        : { x: n.x0 - 10, y: n.y0 + TOP, flip: true },
    );
  };
  const clear = () => {
    setActive(null);
    setTip(null);
  };
  const openable = (id: string) => id !== OTHER_ID && id !== UNNAMED_ID;
  const onNodeKey = (e: KeyboardEvent, id: string) => {
    if ((e.key === "Enter" || e.key === " ") && openable(id)) {
      e.preventDefault();
      open(id);
    } else if (e.key === "Escape") clear();
  };

  const bandFill = (s: FlowSource) =>
    s.kind === "unnamed" ? `url(#${HATCH})` : s.kind === "other" ? OTHER_GREY : s.color;
  const opacityFor = (key: string) =>
    !lit ? BAND.rest : lit.links.has(key) ? BAND.active : BAND.faded;
  const nodeDim = (id: string) => (lit && !lit.nodes.has(id) ? 0.3 : 1);

  /* ---------------------------------------------------------------- tooltips */

  const linkTip = (l: FlowLink): ReactNode => {
    const s = sources.get(l.source)!;
    const t = targets.get(l.target)!;
    const behind = l.roundIds.map((id) => data.rounds[id]!);
    const shown = mode === "money" ? behind.filter((r) => r.amountUsd !== null) : behind;
    const noAmount = behind.length - behind.filter((r) => r.amountUsd !== null).length;
    const members = s.kind === "other" ? l.investorIds.map((id) => nameOf.get(id) ?? id) : [];
    return (
      <VizTooltip
        className="max-w-80"
        title={`${s.name} → ${t.name}`}
        value={
          mode === "money"
            ? moneyText(l.money, s.kind === "unnamed", true)
            : plural(behind.length, "round")
        }
        period={dateSpan(shown)}
        confidence={l.confidence}
        sourceDomain={l.sourceDomain}
      >
        <ul className="space-y-0.5 tabular-nums">
          {shown.slice(0, 5).map((r) => (
            <li key={r.id}>
              {ROUND_STAGE_LABELS[r.stage]}, {formatPartialDate(r.date)}:{" "}
              {r.amountUsd === null
                ? "amount not disclosed"
                : r.named > 1
                  ? `${formatUsd(r.amountUsd)} ÷ ${r.named} named investors = ${formatUsd(r.amountUsd / r.named)} each`
                  : formatUsd(r.amountUsd)}
            </li>
          ))}
          {shown.length > 5 && <li>and {plural(shown.length - 5, "more round")}</li>}
        </ul>
        {members.length > 0 && (
          <p className="mt-1">
            Investors: {members.slice(0, 6).join(", ")}
            {members.length > 6 ? ` and ${formatCount(members.length - 6)} more` : ""}
          </p>
        )}
        {mode === "money" && noAmount > 0 && (
          <p className="mt-1">
            {plural(noAmount, "round")} with no disclosed amount {noAmount === 1 ? "adds" : "add"}{" "}
            width only in the rounds view.
          </p>
        )}
        <p className="mt-1 text-xs">
          {s.kind === "unnamed"
            ? "The sources give these amounts but name no investor."
            : mode === "money"
              ? "Estimate: each round's amount split equally among its named investors."
              : `Drawn as ${share(l.roundShare)} of a round: each round is split equally among its named investors.`}
        </p>
      </VizTooltip>
    );
  };

  const sourceTip = (s: FlowSource): ReactNode => (
    <VizTooltip
      className="max-w-80"
      title={s.name}
      value={
        mode === "money"
          ? moneyText(s.money, s.kind === "unnamed", true)
          : plural(s.roundCount, "round")
      }
      period={
        s.kind === "other"
          ? `${plural(s.members.length, "investor")}, ${plural(s.competitors, "competitor")}`
          : s.kind === "unnamed"
            ? `${plural(s.roundCount, "round")} at ${plural(s.competitors, "competitor")}`
            : `Backs ${plural(s.competitors, "competitor")}`
      }
      confidence={s.confidence}
      sourceDomain={s.sourceDomain}
    >
      {s.kind === "other" && (
        <ul className="space-y-0.5 tabular-nums">
          {s.members.slice(0, 8).map((m) => (
            <li key={m.id}>
              {m.name}
              {m.money > 0 ? ` ~${formatUsd(m.money)}` : ""}
            </li>
          ))}
          {s.members.length > 8 && (
            <li>and {formatCount(s.members.length - 8)} more; View as table lists them all.</li>
          )}
        </ul>
      )}
      {s.kind === "unnamed" && <p>Rounds whose sources name no investor.</p>}
      {s.kind === "investor" && (
        <p>
          {mode === "rounds"
            ? `Drawn as ${share(s.roundShare)} of a round after splitting. `
            : "Estimate: each round's amount split equally among its named investors. "}
          Click to open the profile.
        </p>
      )}
    </VizTooltip>
  );

  const targetTip = (t: FlowTarget): ReactNode => {
    const differs =
      t.totalRaisedUsd !== null &&
      t.disclosedUsd !== null &&
      Math.abs(t.totalRaisedUsd - t.disclosedUsd) >= 1;
    return (
      <VizTooltip
        className="max-w-80"
        title={t.name}
        value={
          mode === "money"
            ? `${formatUsd(t.disclosedUsd)} in disclosed rounds`
            : plural(t.rounds, "round")
        }
        period={`${COMPETITOR_CATEGORY_LABELS[t.category]} · ${LAYER_LABELS[t.layer]}`}
        confidence={t.confidence}
        sourceDomain={t.sourceDomain}
      >
        <p className="tabular-nums">
          {formatCount(t.roundsWithAmount)} of {plural(t.rounds, "round")} with a disclosed amount.
        </p>
        {differs && (
          <p className="tabular-nums">
            The table&apos;s total raised is {formatUsd(t.totalRaisedUsd)}, not the{" "}
            {formatUsd(t.disclosedUsd)} these rounds add up to.
          </p>
        )}
        {t.totalRaisedUsd === null && t.disclosedUsd !== null && (
          <p>The table has no stored total raised for it ({UNKNOWN}).</p>
        )}
        <p>Click to open the competitor.</p>
      </VizTooltip>
    );
  };

  let tipBody: ReactNode = null;
  if (active && tip) {
    if (active.kind === "link") {
      const l = links.get(active.key);
      if (l) tipBody = linkTip(l);
    } else {
      const s = sources.get(active.id);
      const t = targets.get(active.id);
      tipBody = s ? sourceTip(s) : t ? targetTip(t) : null;
    }
  }

  /* ------------------------------------------------------------------- marks */

  const nodeLabel = (n: SankeyNode, halo: boolean) => {
    const halos = halo
      ? {
          stroke: "var(--panel)",
          strokeWidth: 4,
          paintOrder: "stroke" as const,
          strokeLinejoin: "round" as const,
        }
      : {};
    if (n.side === "left") {
      const s = sources.get(n.id)!;
      const value = sourceValue(s);
      const max = Math.floor((leftLabel - LABEL_GAP - 6) / CHAR_W) - value.length - 1;
      return (
        <text
          x={n.x0 - LABEL_GAP}
          y={mid(n)}
          dy="0.32em"
          textAnchor="end"
          fontSize="12"
          style={halos}
        >
          <tspan fill="var(--ink)">{clip(s.name, max)}</tspan>
          <tspan fill="var(--muted)" dx="6">
            {value}
          </tspan>
        </text>
      );
    }
    const t = targets.get(n.id)!;
    const value = targetValue(t);
    const max = Math.floor((rightLabel - LABEL_GAP - 6) / CHAR_W) - value.length - 1;
    return (
      <text x={n.x1 + LABEL_GAP} y={mid(n)} dy="0.32em" fontSize="12" style={halos}>
        <tspan fill="var(--ink)">{clip(t.name, max)}</tspan>
        <tspan fill="var(--muted)" dx="6">
          {value}
        </tspan>
      </text>
    );
  };

  const ariaFor = (n: SankeyNode): string => {
    if (n.side === "left") {
      const s = sources.get(n.id)!;
      const v =
        mode === "money"
          ? s.kind === "unnamed"
            ? `${formatUsd(s.money)} disclosed`
            : `about ${formatUsd(s.money)} estimated`
          : plural(s.roundCount, "round");
      if (s.kind === "other")
        return `Other investors: ${plural(s.members.length, "investor")}, ${v}. View as table lists them.`;
      if (s.kind === "unnamed") return `Investors not named: ${v}.`;
      return `${s.name}: ${v}, backs ${plural(s.competitors, "competitor")}. Press Enter to open.`;
    }
    const t = targets.get(n.id)!;
    const v =
      mode === "money"
        ? `${formatUsd(t.disclosedUsd)} in disclosed rounds`
        : plural(t.rounds, "round");
    return `${t.name}, ${COMPETITOR_CATEGORY_LABELS[t.category].toLowerCase()} competitor: ${v}. Press Enter to open.`;
  };

  const drawNode = (n: SankeyNode) => {
    const h = Math.max(MIN_DRAWN, n.y1 - n.y0);
    const y = mid(n) - h / 2;
    const hitH = Math.max(h, 10);
    const focused = focusId === n.id;
    const labelled = n.side === "left" ? leftLabels.has(n.id) : rightLabels.has(n.id);
    let mark: ReactNode;
    if (n.side === "left") {
      const s = sources.get(n.id)!;
      const m = markStyle(s.kind === "investor" ? s.color : OTHER_GREY);
      mark =
        s.kind === "unnamed" ? (
          <rect
            x={n.x0}
            y={y}
            width={n.x1 - n.x0}
            height={h}
            fill={`url(#${HATCH})`}
            stroke={OTHER_GREY}
            strokeDasharray="2 2"
          />
        ) : (
          <rect
            x={n.x0}
            y={y}
            width={n.x1 - n.x0}
            height={h}
            fill={m.fill}
            stroke={m.stroke}
            strokeWidth={1}
          />
        );
    } else {
      const m = markStyle(COMPANY_GREY.high);
      mark = (
        <>
          <rect
            x={n.x0}
            y={y}
            width={n.x1 - n.x0}
            height={h}
            fill={m.fill}
            stroke={m.stroke}
            strokeWidth={1}
          />
          <rect x={n.x0} y={y} width={2} height={h} fill="var(--accent)" />
        </>
      );
    }
    const hitX = n.side === "left" ? 0 : n.x0;
    const hitW = n.side === "left" ? n.x1 : W - n.x0;
    return (
      <g
        key={n.id}
        tabIndex={0}
        role={openable(n.id) ? "button" : "img"}
        aria-label={ariaFor(n)}
        className="cursor-pointer transition-opacity duration-(--dur-open) ease-(--ease-out) outline-none"
        style={{ opacity: nodeDim(n.id) }}
        onMouseEnter={(e) => {
          setActive({ kind: "node", id: n.id });
          place(e);
        }}
        onMouseMove={place}
        onMouseLeave={clear}
        onFocus={(e) => {
          if (!e.currentTarget.matches(":focus-visible")) return;
          setFocusId(n.id);
          focusNode(n);
        }}
        onBlur={() => {
          setFocusId(null);
          clear();
        }}
        onClick={() => openable(n.id) && open(n.id)}
        onKeyDown={(e) => onNodeKey(e, n.id)}
      >
        <rect x={hitX} y={mid(n) - hitH / 2} width={hitW} height={hitH} fill="transparent" />
        {mark}
        {focused && (
          <rect
            x={n.x0 - 3}
            y={y - 3}
            width={n.x1 - n.x0 + 6}
            height={h + 6}
            rx={3}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}
        {labelled && nodeLabel(n, false)}
      </g>
    );
  };

  // Labels that did not fit appear on hover or focus, over the bands, with a halo.
  const hoverLabels = lit
    ? layout.nodes.filter(
        (n) =>
          (active?.kind === "node" ? n.id === active.id : lit.nodes.has(n.id)) &&
          !(n.side === "left" ? leftLabels : rightLabels).has(n.id),
      )
    : [];

  const extras = named.length - data.namedByMoney;
  const empty = layout.nodes.length === 0;

  return (
    <ChartFrame
      title="Who funds our competitors"
      subtitle={
        mode === "money"
          ? "Each band runs from an investor to a competitor it backed. Band width is estimated money: each round's disclosed amount split equally among the round's named investors."
          : "Each band runs from an investor to a competitor it backed. Band width is rounds: each round counts once, split equally among the round's named investors."
      }
      action={
        <Segmented
          label="Band width"
          value={mode}
          onChange={(m) => {
            setMode(m);
            clear();
          }}
          options={[
            { value: "money", label: "Estimated money (equal split)" },
            { value: "rounds", label: "Number of rounds" },
          ]}
        />
      }
      legend={
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
            <span className="flex items-center gap-1.5 text-sm text-ink-2">
              <svg width="26" height="10" aria-hidden>
                {CATEGORICAL_WIDE.slice(0, 4).map((c, i) => (
                  <rect
                    key={c}
                    x={i * 6.5 + 0.5}
                    y="1"
                    width="5"
                    height="8"
                    fill={markStyle(c).fill}
                  />
                ))}
              </svg>
              Named investor, one colour each ({formatCount(named.length)})
            </span>
            <Legend
              kind="categorical"
              items={[
                ...(other
                  ? [
                      {
                        label: `Other investors (${formatCount(other.members.length)})`,
                        color: OTHER_GREY,
                      },
                    ]
                  : []),
                {
                  label: "Competitor (node height = its total in this view)",
                  color: COMPANY_GREY.high,
                  ring: "var(--accent)",
                },
              ]}
            />
            {unnamed && (
              <span className="flex items-center gap-1.5 text-sm text-ink-2">
                <svg width="10" height="10" aria-hidden>
                  <defs>
                    <pattern
                      id={`${HATCH}-key`}
                      width="4"
                      height="4"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <rect width="4" height="4" fill={withOpacity(OTHER_GREY, 0.2)} />
                      <line x1="0" y1="0" x2="0" y2="4" stroke={OTHER_GREY} strokeWidth="2" />
                    </pattern>
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
          </div>
          <p className="text-xs text-muted">
            Named: the top {formatCount(data.namedByMoney)} investors by estimated money
            {extras > 0
              ? `, then ${formatCount(extras)} more of the ${formatCount(data.multiBackers)} investors that back two or more competitors (most competitors first)`
              : ""}
            . Bands show at 40% and light up on hover; competitors are grouped direct, adjacent,
            remote. Labels that do not fit appear on hover.
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
      height={height + TOP + BOTTOM}
      state={
        empty
          ? {
              status: "empty",
              message:
                "No competitor round names an investor or an amount yet. The table below lists each competitor's rounds.",
            }
          : { status: "ready" }
      }
      tableAlternative={<FlowTable pairs={data.pairs} nameOf={nameOf} onOpen={open} />}
    >
      <div ref={setOuter} className="scrollbar-subtle overflow-x-auto">
        {width === null ? (
          <div style={{ height: height + TOP + BOTTOM }} />
        ) : (
          <div ref={inner} className="relative" style={{ width: W }}>
            <svg
              width={W}
              height={height + TOP + BOTTOM}
              role="group"
              aria-label={`Sankey diagram: ${plural(leftNodes.length, "investor node")} on the left, ${plural(rightNodes.length, "competitor")} on the right. Tab to each node; View as table lists every band.`}
              onMouseLeave={clear}
              className="block"
            >
              <defs>
                <pattern
                  id={HATCH}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill={withOpacity(OTHER_GREY, 0.25)} />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={OTHER_GREY} strokeWidth="2.5" />
                </pattern>
              </defs>
              <g transform={`translate(0, ${TOP})`}>
                <g aria-hidden>
                  {layout.links.map((l) => {
                    const key = linkKey(l);
                    const s = sources.get(l.source)!;
                    const a = nodeById.get(l.source)!;
                    const b = nodeById.get(l.target)!;
                    return (
                      <path
                        key={key}
                        d={ribbonPath(a.x1, l.sy, b.x0, l.ty, l.width)}
                        fill={bandFill(s)}
                        fillOpacity={opacityFor(key)}
                        className="cursor-pointer transition-[fill-opacity] duration-(--dur-open) ease-(--ease-out)"
                        onMouseEnter={(e) => {
                          setActive({ kind: "link", key });
                          place(e);
                        }}
                        onMouseMove={place}
                        onMouseLeave={clear}
                        onClick={() => open(l.target)}
                      />
                    );
                  })}
                </g>
                {layout.groups.map((g) =>
                  rightLabels.has(`group:${g.group}`) ? (
                    <text
                      key={g.group}
                      x={W - rightLabel + LABEL_GAP}
                      y={groupLabelY(g.y0)}
                      dy="0.32em"
                      fontSize="11"
                      fontWeight={500}
                      fill="var(--ink-2)"
                    >
                      {COMPETITOR_CATEGORY_LABELS[g.group as CompetitorCategory] ?? g.group} (
                      {formatCount(g.count)})
                    </text>
                  ) : null,
                )}
                {leftNodes.map(drawNode)}
                {rightNodes.map(drawNode)}
                <g aria-hidden className="pointer-events-none">
                  {hoverLabels.map((n) => (
                    <g key={`hover-${n.id}`}>{nodeLabel(n, true)}</g>
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
                  top: tip.y > (height + TOP) / 2 ? tip.y - 14 : tip.y + 14,
                  transform: `translate(${tip.flip ? "-100%" : "0"}, ${tip.y > (height + TOP) / 2 ? "-100%" : "0"})`,
                }}
              >
                {tipBody}
              </div>
            )}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

/** Every investor and competitor pair, with whole rounds and the estimated money. */
function FlowTable({
  pairs,
  nameOf,
  onOpen,
}: {
  pairs: readonly FlowPair[];
  nameOf: ReadonlyMap<string, string>;
  onOpen: (id: string) => void;
}) {
  return (
    <ChartTable
      caption="Investors and the competitors they backed, with rounds and estimated money (each round's amount split equally among its named investors)"
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
