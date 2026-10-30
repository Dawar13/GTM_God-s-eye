"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, Legend, VizTooltip } from "@/components/ui-atlas";
import { formatCount, formatMonthYear, formatUsd, UNKNOWN } from "@/lib/format";
import { LAYER_LABELS, REGION_LABELS, ROUND_STAGE_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import { CATEGORICAL, COMPANY_GREY, darken, markStyle } from "@/lib/viz";
import type { FitFeatureName } from "@/lib/fit/score";
import type { FreshCapitalByRegion } from "@/lib/viz/transforms/freshCapitalByRegion";
import type { FundsByYear } from "@/lib/viz/transforms/fundsByYear";
import type { RecentDeals } from "@/lib/viz/transforms/recentDeals";
import { LAYER_ORDER } from "@/lib/viz/transforms/recentDeals";
import { FIT_FEATURE_ORDER, type TopByFit } from "@/lib/viz/transforms/topByFit";
import { ChartTable } from "./ChartTable";

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const AXIS_LINE = { stroke: "var(--rule)" } as const;
const GRID = "var(--rule)";
const CURSOR = { fill: "var(--accent-soft)" } as const;
const FRESH = markStyle(CATEGORICAL[0]);
const OLDER = markStyle("#B9BFC9");

function TileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm text-accent hover:underline">
      {children}
    </Link>
  );
}

/** The mark a Recharts tooltip is hovering, or null. */
function hovered<T>(p: { active?: boolean; payload?: readonly { payload?: unknown }[] }): T | null {
  return p.active && p.payload?.[0]?.payload ? (p.payload[0].payload as T) : null;
}

const pluralFunds = (n: number) => `${formatCount(n)} ${n === 1 ? "fund" : "funds"}`;

/* ---------------------------------------------------------------- funds by year */

export function FundsByYearTile({ data, href }: { data: FundsByYear; href: string }) {
  const chart = (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data.bars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="year"
          tick={TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          cursor={CURSOR}
          content={(p) => {
            const b = hovered<FundsByYear["bars"][number]>(p);
            if (!b) return null;
            return (
              <VizTooltip
                title={`Funds closed in ${b.year}`}
                value={pluralFunds(b.total)}
                period={String(b.year)}
                confidence={b.confidence}
                sourceDomain={b.sourceDomain}
              >
                <p className="tabular-nums">
                  {formatCount(b.fresh)} fresh, {formatCount(b.older)} older
                </p>
              </VizTooltip>
            );
          }}
        />
        <Bar
          dataKey="older"
          name="Older"
          stackId="f"
          fill={OLDER.fill}
          stroke={OLDER.stroke}
          isAnimationActive={false}
        />
        <Bar
          dataKey="fresh"
          name="Fresh"
          stackId="f"
          fill={FRESH.fill}
          stroke={FRESH.stroke}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
  return (
    <ChartFrame
      title="Funds closed by year"
      subtitle="Each bar counts funds by close year. Fresh = closed on or after Oct 29, 2024 (24 months)."
      legend={
        <Legend
          kind="categorical"
          items={[
            { label: "Fresh", color: CATEGORICAL[0] },
            { label: "Older", color: "#B9BFC9" },
          ]}
        />
      }
      sources={data.sources}
      notShown={{ count: data.notShown, field: "close date" }}
      state={data.bars.length === 0 ? { status: "empty" } : { status: "ready" }}
      action={<TileLink href={href}>Open in Directory</TileLink>}
      tableAlternative={
        <ChartTable
          caption="Funds closed by year"
          rows={data.bars}
          rowKey={(b) => String(b.year)}
          columns={[
            { header: "Year", cell: (b) => b.year },
            { header: "Fresh", numeric: true, cell: (b) => formatCount(b.fresh) },
            { header: "Older", numeric: true, cell: (b) => formatCount(b.older) },
            { header: "Total", numeric: true, cell: (b) => formatCount(b.total) },
          ]}
        />
      }
      height={260}
    >
      {chart}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------ fresh capital by region */

const REGION_NAME = (r: FreshCapitalByRegion["bars"][number]["region"]) =>
  r === "unknown" ? "Region unknown" : REGION_LABELS[r];

export function FreshCapitalTile({ data, href }: { data: FreshCapitalByRegion; href: string }) {
  const bars = data.bars.map((b) => ({
    ...b,
    label:
      b.capitalUsd === null ? `${REGION_NAME(b.region)} (size unknown)` : REGION_NAME(b.region),
  }));
  return (
    <ChartFrame
      title="Fresh capital by region"
      subtitle="Latest fund size of each investor whose latest fund is fresh. Region filter is ignored here."
      legend={
        <Legend
          kind="categorical"
          items={[
            { label: "Fresh latest fund, by region", color: CATEGORICAL[0] },
            { label: "Region not on record", color: "#B9BFC9" },
          ]}
        />
      }
      sources={data.sources}
      notShown={{ count: data.notShown, field: "latest fund size" }}
      state={data.freshInvestors === 0 ? { status: "empty" } : { status: "ready" }}
      action={<TileLink href={href}>Open fresh funds in Directory</TileLink>}
      tableAlternative={
        <ChartTable
          caption="Fresh capital by region"
          rows={bars}
          rowKey={(b) => b.region}
          columns={[
            { header: "Region", cell: (b) => REGION_NAME(b.region) },
            { header: "Fresh investors", numeric: true, cell: (b) => formatCount(b.investors) },
            { header: "Fresh capital", numeric: true, cell: (b) => formatUsd(b.capitalUsd) },
            { header: "Size unknown", numeric: true, cell: (b) => formatCount(b.withoutSize) },
          ]}
        />
      }
      height={260}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={bars} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={56}
            domain={[0, "auto"]}
            tickFormatter={(v: number) => formatUsd(v)}
          />
          <Tooltip
            cursor={CURSOR}
            content={(p) => {
              const b = hovered<(typeof bars)[number]>(p);
              if (!b) return null;
              return (
                <VizTooltip
                  title={`${REGION_NAME(b.region)}: fresh capital`}
                  value={formatUsd(b.capitalUsd)}
                  period="Latest fund, closed Oct 2024 or later"
                  confidence={b.confidence}
                  sourceDomain={b.sourceDomain}
                >
                  <p className="tabular-nums">
                    {formatCount(b.investors)} investors
                    {b.withoutSize > 0 ? `, ${formatCount(b.withoutSize)} without a fund size` : ""}
                  </p>
                </VizTooltip>
              );
            }}
          />
          <Bar dataKey="capitalUsd" isAnimationActive={false} maxBarSize={72}>
            {bars.map((b) => {
              const m = markStyle(b.region === "unknown" ? "#B9BFC9" : CATEGORICAL[0]);
              return <Cell key={b.region} fill={m.fill} stroke={m.stroke} />;
            })}
            <LabelList
              dataKey="capitalUsd"
              position="top"
              fontSize={12}
              fill="var(--ink-2)"
              formatter={(v: unknown) => (typeof v === "number" ? formatUsd(v) : UNKNOWN)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ top 10 by fit */

const FEATURE_LABEL: Record<FitFeatureName, string> = {
  thesis: "Thesis",
  stage: "Stage",
  check: "Check size",
  adjacency: "Adjacency",
  geography: "Geography",
  dry_powder: "Dry powder",
};

const points = (v: number | null) => (v === null ? UNKNOWN : `${v.toFixed(1)} pts`);

export function TopFitTile({ data, href }: { data: TopByFit; href: string }) {
  const { open } = useInspector();
  const rows = data.bars.map((b) => ({
    ...b,
    label: `${b.rank}. ${b.name}${b.flags.length ? ` · ${b.flags.join(", ")}` : ""}`,
    ...Object.fromEntries(FIT_FEATURE_ORDER.map((f) => [f, b.contributions[f]])),
  }));
  const openFrom = (entry: unknown) => {
    const id = entry as { investorId?: string; payload?: { investorId?: string } } | null;
    const target = id?.investorId ?? id?.payload?.investorId;
    if (target) open(target);
  };
  return (
    <ChartFrame
      title="Top 10 by fit score"
      subtitle="Score out of 100 with default weights; segments are points per feature. Unknown features are left out and the rest rescaled."
      legend={
        <div className="flex flex-col gap-1">
          <Legend
            kind="categorical"
            items={FIT_FEATURE_ORDER.map((f, i) => ({
              label: FEATURE_LABEL[f],
              color: CATEGORICAL[i]!,
            }))}
          />
          <p className="text-xs text-muted">
            {data.sparse.toLocaleString("en-US")} investors with too few known features
            (sparse) are not ranked. Conflict = sources disagree. Click a bar to open the
            investor.
          </p>
        </div>
      }
      sources={data.sources}
      notShown={{ count: data.notShown, field: "fit features" }}
      state={data.bars.length === 0 ? { status: "empty" } : { status: "ready" }}
      action={<TileLink href={href}>Open in Directory</TileLink>}
      tableAlternative={
        <ChartTable
          caption="Top 10 investors by fit score"
          rows={data.bars}
          rowKey={(b) => b.investorId}
          columns={[
            { header: "#", numeric: true, cell: (b) => b.rank },
            {
              header: "Investor",
              cell: (b) => (
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => open(b.investorId)}
                >
                  {b.name}
                </button>
              ),
            },
            { header: "Fit", numeric: true, cell: (b) => b.total.toFixed(1) },
            ...FIT_FEATURE_ORDER.map((f) => ({
              header: FEATURE_LABEL[f],
              numeric: true,
              cell: (b: TopByFit["bars"][number]) => points(b.contributions[f]).replace(" pts", ""),
            })),
            { header: "Flags", cell: (b) => (b.flags.length ? b.flags.join(", ") : "none") },
          ]}
        />
      }
      height={320}
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
          barCategoryGap={6}
        >
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={TICK}
            axisLine={AXIS_LINE}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={230}
            tick={{ ...TICK, fill: "var(--ink-2)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            cursor={CURSOR}
            content={(p) => {
              const b = hovered<(typeof rows)[number]>(p);
              if (!b) return null;
              return (
                <VizTooltip
                  title={b.name}
                  value={`${b.total.toFixed(1)} of 100`}
                  period={`${(b.coverage * 100).toFixed(0)}% of weight known`}
                  confidence={b.confidence}
                  sourceDomain={b.sourceDomain}
                >
                  <ul className="tabular-nums">
                    {FIT_FEATURE_ORDER.map((f) => (
                      <li key={f}>
                        {FEATURE_LABEL[f]}: {points(b.contributions[f])}
                      </li>
                    ))}
                  </ul>
                  {b.flags.length > 0 && <p className="mt-1">Flags: {b.flags.join(", ")}</p>}
                </VizTooltip>
              );
            }}
          />
          {FIT_FEATURE_ORDER.map((f, i) => {
            const m = markStyle(CATEGORICAL[i]!);
            return (
              <Bar
                key={f}
                dataKey={f}
                name={FEATURE_LABEL[f]}
                stackId="fit"
                fill={m.fill}
                stroke={m.stroke}
                isAnimationActive={false}
                cursor="pointer"
                onClick={openFrom}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* -------------------------------------------------------------- recent deals timeline */

type Dot = RecentDeals["dots"][number] & { y: number };

const RING = "var(--accent)";
const GREY = COMPANY_GREY.high;

export function RecentDealsTile({ data, href }: { data: RecentDeals; href: string }) {
  const { open } = useInspector();
  const dots: Dot[] = data.dots.map((d) => ({ ...d, y: LAYER_ORDER.indexOf(d.layer) }));
  // Year- and quarter-only dates sit at the start of their period, which can precede the window.
  const minX = dots.reduce((m, d) => Math.min(m, d.x), Number.POSITIVE_INFINITY);
  const maxX = dots.reduce((m, d) => Math.max(m, d.x), 0) + 20 * 86_400_000;
  const first = new Date(minX);
  const xTicks: number[] = [];
  for (let t = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1); t <= maxX;) {
    xTicks.push(t);
    const d = new Date(t);
    t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 6, 1);
  }
  const approx = (d: Dot) => d.datePrecision === "year" || d.datePrecision === "quarter";
  const open1 = (entry: unknown) => {
    const e = entry as { companyId?: string; payload?: { companyId?: string } } | null;
    const id = e?.companyId ?? e?.payload?.companyId;
    if (id) open(id);
  };
  const shape = (p: { cx?: number; cy?: number; payload?: Dot }) => {
    const d = p.payload;
    if (!d || p.cx === undefined || p.cy === undefined) return <g />;
    const m = markStyle(GREY);
    return (
      <circle
        cx={p.cx}
        cy={p.cy}
        r={5}
        fill={approx(d) ? "none" : m.fill}
        stroke={d.isCompetitor ? RING : m.stroke}
        strokeWidth={d.isCompetitor ? 2 : approx(d) ? 1.5 : 1}
        style={{ cursor: "pointer" }}
      />
    );
  };
  return (
    <ChartFrame
      title="Recent deals in our layers"
      subtitle={`Rounds since ${formatMonthYear(data.since.slice(0, 7))} by company layer; "our layers" = companies and competitors with a layer set.`}
      legend={
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
            <Legend kind="categorical" items={[{ label: "Portfolio company", color: GREY }]} />
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" aria-hidden>
                <circle
                  cx="6"
                  cy="6"
                  r="4.5"
                  fill={markStyle(GREY).fill}
                  stroke={RING}
                  strokeWidth="2"
                />
              </svg>
              Competitor
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" aria-hidden>
                <circle cx="6" cy="6" r="4.5" fill="none" stroke={darken(GREY)} strokeWidth="1.5" />
              </svg>
              Date known only to year or quarter
            </span>
          </div>
          <p className="text-xs text-muted">
            {formatCount(data.earlier)} earlier rounds are outside the window. Click a dot to open
            the company.
          </p>
        </div>
      }
      sources={data.sources}
      notShown={{ count: data.notShown, field: "round date" }}
      state={
        dots.length === 0
          ? { status: "empty", message: "No dated rounds in these layers in the window." }
          : { status: "ready" }
      }
      action={<TileLink href={href}>Open Competitors</TileLink>}
      tableAlternative={
        <ChartTable
          caption="Recent deals in our layers"
          rows={[...dots].reverse()}
          rowKey={(d) => d.roundId}
          columns={[
            { header: "Date", cell: (d) => formatMonthYear(d.date) },
            {
              header: "Company",
              cell: (d) => (
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => open(d.companyId)}
                >
                  {d.name}
                </button>
              ),
            },
            { header: "Layer", cell: (d) => LAYER_LABELS[d.layer] },
            { header: "Stage", cell: (d) => ROUND_STAGE_LABELS[d.stage] },
            { header: "Amount", numeric: true, cell: (d) => formatUsd(d.amountUsd) },
            { header: "Kind", cell: (d) => (d.isCompetitor ? "Competitor" : "Company") },
          ]}
        />
      }
      height={320}
    >
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="x"
            scale="time"
            domain={[Math.min(minX, xTicks[0] ?? minX), maxX]}
            ticks={xTicks}
            tick={TICK}
            axisLine={AXIS_LINE}
            tickLine={false}
            tickFormatter={(t: number) => formatMonthYear(new Date(t).toISOString().slice(0, 7))}
          />
          <YAxis
            type="number"
            dataKey="y"
            reversed
            domain={[-0.5, LAYER_ORDER.length - 0.5]}
            ticks={LAYER_ORDER.map((_, i) => i)}
            interval={0}
            width={120}
            tick={{ ...TICK, fill: "var(--ink-2)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(i: number) => LAYER_LABELS[LAYER_ORDER[i]!] ?? ""}
          />
          <Tooltip
            cursor={{ stroke: "var(--rule)" }}
            content={(p) => {
              const d = hovered<Dot>(p);
              if (!d) return null;
              return (
                <VizTooltip
                  title={d.name}
                  value={d.amountUsd === null ? "Amount undisclosed" : formatUsd(d.amountUsd)}
                  period={`${ROUND_STAGE_LABELS[d.stage]}, ${formatMonthYear(d.date)}`}
                  confidence={d.confidence}
                  sourceDomain={d.sourceDomain}
                >
                  <p>{LAYER_LABELS[d.layer]}</p>
                  {d.contested && <p>Sources disagree on this round.</p>}
                </VizTooltip>
              );
            }}
          />
          <Scatter data={dots} shape={shape as never} isAnimationActive={false} onClick={open1} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
