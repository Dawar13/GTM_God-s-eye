"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, Legend, VizTooltip } from "@/components/ui-atlas";
import type { InvestorProfile } from "@/lib/data/profile";
import { formatCount, formatPartialDate, formatPercent, formatUsd } from "@/lib/format";
import { CATEGORICAL, markStyle } from "@/lib/viz";
import { FIT_FEATURE_ORDER } from "@/lib/viz/transforms/topByFit";
import { ChartTable } from "./ChartTable";

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const AXIS_LINE = { stroke: "var(--rule)" } as const;
const GRID = "var(--rule)";
const CURSOR = { fill: "var(--accent-soft)" } as const;

/** The mark a Recharts tooltip is hovering, or null. */
function hovered<T>(p: { active?: boolean; payload?: readonly { payload?: unknown }[] }): T | null {
  return p.active && p.payload?.[0]?.payload ? (p.payload[0].payload as T) : null;
}

const pts = (v: number) => `${v.toFixed(1)} pts`;
const domainOnly = (d: string | null) => (d ? d.split(" +")[0]! : null);

/* ------------------------------------------------------------------ fit breakdown */

export function FitBreakdownChart({
  fit,
  provenance,
}: {
  fit: NonNullable<InvestorProfile["fit"]>;
  provenance: InvestorProfile["provenance"];
}) {
  const datum = {
    name: "Fit",
    ...Object.fromEntries(fit.segments.map((s) => [s.feature, s.points])),
  };
  const colorOf = (feature: string) => CATEGORICAL[FIT_FEATURE_ORDER.indexOf(feature as never)]!;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xl font-semibold tabular-nums">
          {fit.total.toFixed(1)} <span className="text-sm font-normal text-ink-2">of 100</span>
        </p>
        <p className="text-sm text-ink-2">
          Known for <span className="tabular-nums">{formatPercent(fit.coverage)}</span> of fit
          weight
        </p>
        {fit.flags.map((f) => (
          <span key={f} className="rounded-md border border-rule px-1.5 text-xs text-ink-2">
            {f === "sparse" ? "Sparse data" : "Conflict"}
          </span>
        ))}
      </div>
      <ChartFrame
        compact
        title="Fit score by feature"
        subtitle="Points each known feature adds to the score, default weights. Unknown features add nothing and the rest are rescaled."
        legend={
          <Legend
            kind="categorical"
            items={fit.segments.map((s) => ({ label: s.label, color: colorOf(s.feature) }))}
          />
        }
        sources={provenance.sourceDomain ? [domainOnly(provenance.sourceDomain)!] : []}
        notShown={{ count: fit.unknown.length, field: "fit features" }}
        height={64}
        tableAlternative={
          <ChartTable
            caption="Fit score by feature"
            rows={[...fit.segments]}
            rowKey={(s) => s.feature}
            columns={[
              { header: "Feature", cell: (s) => s.label },
              { header: "Value", numeric: true, cell: (s) => formatPercent(s.value) },
              { header: "Points", numeric: true, cell: (s) => s.points.toFixed(1) },
              { header: "Most possible", numeric: true, cell: (s) => s.maxPoints.toFixed(1) },
            ]}
          />
        }
      >
        <ResponsiveContainer width="100%" height={64}>
          <BarChart
            data={[datum]}
            layout="vertical"
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={TICK}
              axisLine={AXIS_LINE}
              tickLine={false}
            />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              cursor={false}
              content={(p) =>
                hovered(p) ? (
                  <VizTooltip
                    title="Fit score"
                    value={`${fit.total.toFixed(1)} of 100`}
                    period={`${formatPercent(fit.coverage)} of weight known`}
                    confidence={provenance.confidence}
                    sourceDomain={provenance.sourceDomain}
                  >
                    <ul className="tabular-nums">
                      {fit.segments.map((s) => (
                        <li key={s.feature}>
                          {s.label}: {pts(s.points)} of {s.maxPoints.toFixed(1)}
                        </li>
                      ))}
                      {fit.unknown.map((u) => (
                        <li key={u.feature}>{u.label}: unknown</li>
                      ))}
                    </ul>
                  </VizTooltip>
                ) : null
              }
            />
            {fit.segments.map((s) => {
              const m = markStyle(colorOf(s.feature));
              return (
                <Bar
                  key={s.feature}
                  dataKey={s.feature}
                  name={s.label}
                  stackId="fit"
                  fill={m.fill}
                  stroke={m.stroke}
                  isAnimationActive={false}
                  maxBarSize={28}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      {fit.unknown.length > 0 && (
        <p className="text-xs text-ink-2">
          Unknown, not scored: {fit.unknown.map((u) => u.label).join(", ")}.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ sector weights */

export function SectorWeightsChart({
  sectors,
  provenance,
}: {
  sectors: InvestorProfile["sectors"];
  provenance: InvestorProfile["provenance"];
}) {
  const height = Math.max(60, sectors.bars.length * 26 + 28);
  return (
    <ChartFrame
      compact
      title="Sector weights"
      subtitle={
        sectors.method
          ? `Share of the thesis by sector (${sectors.method.replaceAll("_", " ")}); weights sum to 100%.`
          : "Share of the thesis by sector."
      }
      sources={provenance.sourceDomain ? [domainOnly(provenance.sourceDomain)!] : []}
      notShown={{ count: sectors.unknown ? 1 : 0, field: "sector weights" }}
      state={
        sectors.unknown
          ? { status: "empty", message: "No sector weights are on record for this investor. The sources below show what is known." }
          : { status: "ready" }
      }
      height={height}
      tableAlternative={
        <ChartTable
          caption="Sector weights"
          rows={sectors.bars}
          rowKey={(b) => b.sector}
          columns={[
            { header: "Sector", cell: (b) => b.label },
            { header: "Weight", numeric: true, cell: (b) => formatPercent(b.weight) },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={sectors.bars}
          layout="vertical"
          margin={{ top: 4, right: 36, bottom: 0, left: 0 }}
          barCategoryGap={4}
        >
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis
            type="number"
            domain={[0, "auto"]}
            tick={TICK}
            axisLine={AXIS_LINE}
            tickLine={false}
            tickFormatter={(v: number) => formatPercent(v)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ ...TICK, fill: "var(--ink-2)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            cursor={CURSOR}
            content={(p) => {
              const b = hovered<(typeof sectors.bars)[number]>(p);
              if (!b) return null;
              return (
                <VizTooltip
                  title={b.label}
                  value={formatPercent(b.weight)}
                  period="Share of thesis"
                  confidence={provenance.confidence}
                  sourceDomain={provenance.sourceDomain}
                >
                  {sectors.inputs.length > 0 && <p>From: {sectors.inputs.join(", ")}</p>}
                </VizTooltip>
              );
            }}
          />
          <Bar dataKey="weight" isAnimationActive={false} maxBarSize={16}>
            {sectors.bars.map((b) => {
              const m = markStyle(CATEGORICAL[0]);
              return <Cell key={b.sector} fill={m.fill} stroke={m.stroke} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ funds timeline */

const MISSING_TEXT = {
  size: "size not on record",
  date: "no close date or vintage year",
  "size and date": "size and date not on record",
} as const;

export function FundsTimelineChart({ funds }: { funds: InvestorProfile["funds"] }) {
  const bars = funds.points.map((f) => ({
    ...f,
    label: formatPartialDate(f.date),
    year: f.date.slice(0, 4),
  }));
  return (
    <div className="flex flex-col gap-2">
      <ChartFrame
        compact
        title="Fund size by close date"
        subtitle="One bar per fund, oldest first. Spacing is by order, not to scale in time."
        sources={funds.sources}
        notShown={{ count: funds.notPlotted.length, field: "fund size or date" }}
        state={
          bars.length === 0
            ? {
                status: "empty",
                message:
                  funds.notPlotted.length > 0
                    ? "No fund has both a size and a date on record. The funds without them are listed below."
                    : "No funds are on record for this investor. The sources below show what is known.",
              }
            : { status: "ready" }
        }
        height={200}
        tableAlternative={
          <ChartTable
            caption="Funds with a size and a date"
            rows={bars}
            rowKey={(b) => b.id}
            columns={[
              { header: "Fund", cell: (b) => b.name },
              { header: "Closed", numeric: true, cell: (b) => b.label },
              { header: "Size", numeric: true, cell: (b) => formatUsd(b.sizeUsd) },
            ]}
          />
        }
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="year"
              tick={TICK}
              axisLine={AXIS_LINE}
              tickLine={false}
              interval={bars.length <= 12 ? 0 : "preserveStartEnd"}
              minTickGap={8}
            />
            <YAxis
              tick={TICK}
              axisLine={false}
              tickLine={false}
              width={48}
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
                    title={b.name}
                    value={formatUsd(b.sizeUsd)}
                    period={
                      b.dateIsVintage ? `Vintage ${b.label} (no close date)` : `Closed ${b.label}`
                    }
                    confidence={b.confidence}
                    sourceDomain={b.sourceDomain}
                  />
                );
              }}
            />
            <Bar dataKey="sizeUsd" isAnimationActive={false} maxBarSize={36}>
              {bars.map((b) => {
                const m = markStyle(CATEGORICAL[0]);
                return <Cell key={b.id} fill={m.fill} stroke={m.stroke} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      {funds.notPlotted.length > 0 && (
        <div className="text-xs text-ink-2">
          <p>
            Not plotted ({formatCount(funds.notPlotted.length)}), listed here instead of drawn as
            zero:
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {funds.notPlotted.map((f) => (
              <li key={f.id}>
                {f.name}: {MISSING_TEXT[f.missing]}
                {f.sizeUsd !== null ? ` (${formatUsd(f.sizeUsd)})` : ""}
                {f.date !== null ? ` (${formatPartialDate(f.date)})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
