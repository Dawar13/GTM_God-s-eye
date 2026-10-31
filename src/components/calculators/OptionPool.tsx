"use client";

import { useMemo } from "react";
import { useQueryStates } from "nuqs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTable } from "@/components/charts/ChartTable";
import {
  CalculatorLayout,
  ChartFrame,
  FormulaLine,
  Legend,
  NumberField,
  ShareBar,
  Stat,
  VizTooltip,
} from "@/components/ui-atlas";
import { OPTION_POOL_DEFAULTS as D } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS, matchesDefaults, numberParam } from "@/lib/calculators/url";
import { useLastValid } from "@/lib/calculators/useLastValid";
import { CAP_TABLE_ROUNDING, poolShuffle } from "@/lib/finance";
import { formatCount, formatPercent, formatPricePerShare, formatUsd } from "@/lib/format";
import { CATEGORICAL, markStyle } from "@/lib/viz";
import { optionPoolBars, poolOwnership } from "@/lib/viz/transforms/calcOwnership";

const parsers = {
  pre: numberParam(D.pre),
  inv: numberParam(D.inv),
  fsh: numberParam(D.fsh),
  pool: numberParam(D.pool),
  tgt: numberParam(D.tgt),
};
type Inputs = { pre: number; inv: number; fsh: number; pool: number; tgt: number };

function compute(i: Inputs) {
  return poolShuffle({
    headlinePreMoney: i.pre,
    investment: i.inv,
    existingShares: i.fsh,
    existingPool: i.pool,
    targetPostPoolPct: i.tgt,
    rounding: CAP_TABLE_ROUNDING,
  });
}

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const HEADLINE = markStyle(CATEGORICAL[0]);
const EFFECTIVE = markStyle(CATEGORICAL[2]);

export function OptionPool() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const inputs = useMemo<Inputs>(
    () => ({ pre: v.pre, inv: v.inv, fsh: v.fsh, pool: v.pool, tgt: v.tgt }),
    [v.pre, v.inv, v.fsh, v.pool, v.tgt],
  );
  const { result, error, stale } = useLastValid(inputs, compute);
  const bars = useMemo(
    () => (result ? optionPoolBars(result, inputs.pre) : null),
    [result, inputs.pre],
  );
  const own = useMemo(() => (result ? poolOwnership(result) : null), [result]);

  // Two bars; the effective bar is stacked with the dashed "gap" so both reach the headline height.
  const data = bars?.bars.map((b) => ({
    ...b,
    gap: b.key === "effective" ? bars.gap : 0,
  }));

  return (
    <CalculatorLayout
      isExample={matchesDefaults(inputs, D)}
      onReset={() => void setV(null)}
      error={error}
      stale={stale}
      inputs={
        <>
          <NumberField
            label="Headline pre-money"
            kind="usd"
            min={100_000}
            max={10_000_000_000}
            slider="log"
            value={v.pre}
            onChange={(pre) => void setV({ pre })}
            hint="The pre-money valuation in the term sheet, before the pool top-up is taken out of it."
          />
          <NumberField
            label="New investment"
            kind="usd"
            min={10_000}
            max={1_000_000_000}
            slider="log"
            value={v.inv}
            onChange={(inv) => void setV({ inv })}
            hint="Total new money in the round. The example is the app's assumed $1.0M raise."
          />
          <NumberField
            label="Founder and existing shares"
            kind="count"
            min={100_000}
            max={1_000_000_000}
            slider="log"
            value={v.fsh}
            onChange={(fsh) => void setV({ fsh })}
            hint="Shares held by founders and other existing holders, not counting the unissued pool."
          />
          <NumberField
            label="Existing unissued pool"
            kind="count"
            min={0}
            max={500_000_000}
            slider="linear"
            step={10_000}
            value={v.pool}
            onChange={(pool) => void setV({ pool })}
            hint="Options set aside but not yet granted. Counted toward the target before any top-up."
          />
          <NumberField
            label="Target pool after the round"
            kind="percent"
            min={0}
            max={0.4}
            step={0.005}
            value={v.tgt}
            onChange={(tgt) => void setV({ tgt })}
            hint="Share of all fully diluted shares after closing that investors want available as unissued options. A top-up is created before the round, so only existing holders bear it."
          />
        </>
      }
      how={
        <>
          <p>
            Investors often ask for the pool to be topped up before they invest. The new options are
            counted in the pre-money, so the price per share falls and existing holders carry the
            whole cost. The effective pre-money is the headline figure less the value of the new
            options at the round price.
          </p>
          <FormulaLine>
            top-up = (t · k · S − existing pool) ÷ (1 − t · k), where k = post ÷ pre, t = target
            pool, S = shares before the top-up
          </FormulaLine>
          <FormulaLine>
            price = headline pre ÷ (S + top-up) · effective pre = headline pre − top-up × price
          </FormulaLine>
          {result && (
            <>
              <p className="font-medium text-ink">Worked example with the current inputs</p>
              <FormulaLine>
                k = {formatUsd(inputs.pre + inputs.inv)} ÷ {formatUsd(inputs.pre)} · S ={" "}
                {formatCount(inputs.fsh + inputs.pool)} · top-up ={" "}
                {formatCount(result.poolIncrease)} shares
              </FormulaLine>
              <FormulaLine>
                Price per share: {formatUsd(inputs.pre)} ÷{" "}
                {formatCount(inputs.fsh + inputs.pool + result.poolIncrease)} ={" "}
                {formatPricePerShare(result.pricePerShare)}
              </FormulaLine>
              <FormulaLine>
                Gap: {formatCount(result.poolIncrease)} ×{" "}
                {formatPricePerShare(result.pricePerShare)} = {formatUsd(result.gap)}, so the
                effective pre-money is {formatUsd(result.effectivePreMoney)}
              </FormulaLine>
              <FormulaLine>
                Pool after the round: {formatCount(result.capTable.pool)} ÷{" "}
                {formatCount(result.postFDShares)} = {formatPercent(result.ownership.pool)}
              </FormulaLine>
            </>
          )}
        </>
      }
    >
      {result && bars && own && data && (
        <>
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-4">
            <Stat label="Effective pre-money" value={formatUsd(result.effectivePreMoney)} />
            <Stat label="Gap vs headline" value={formatUsd(result.gap)} />
            <Stat label="Pool top-up" value={formatCount(result.poolIncrease)} unit="shares" />
            <Stat label="Price per share" value={formatPricePerShare(result.pricePerShare)} />
          </div>
          <ChartFrame
            title="Headline vs effective pre-money"
            subtitle={`The pool top-up takes ${formatUsd(result.gap)} (${formatPercent(bars.gapShare)}) out of the headline valuation.`}
            legend={
              <Legend
                kind="categorical"
                items={[
                  { label: "Headline pre-money", color: CATEGORICAL[0] },
                  { label: "Effective pre-money", color: CATEGORICAL[2] },
                  { label: "Value of the pool top-up (gap)", color: "#8A919C", hollow: true },
                ]}
              />
            }
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            computed="Computed from the inputs on the left. Example values are illustrative, not data."
            height={280}
            tableAlternative={
              <ChartTable
                caption="Headline and effective pre-money"
                rows={data}
                rowKey={(r) => r.key}
                columns={[
                  { header: "Measure", cell: (r) => r.label },
                  { header: "Value", numeric: true, cell: (r) => formatUsd(r.value) },
                  {
                    header: "Gap to headline",
                    numeric: true,
                    cell: (r) => (r.gap > 0 ? formatUsd(r.gap) : "—"),
                  },
                ]}
              />
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} margin={{ top: 20, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rule)" />
                <XAxis
                  dataKey="label"
                  tick={TICK}
                  axisLine={{ stroke: "var(--rule)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, "auto"]}
                  tick={TICK}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(n: number) => formatUsd(n)}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent-soft)" }}
                  content={(p) => {
                    const row = p.active
                      ? (p.payload?.[0]?.payload as (typeof data)[number] | undefined)
                      : undefined;
                    if (!row) return null;
                    return (
                      <VizTooltip
                        title={row.label}
                        value={formatUsd(row.value)}
                        confidence={null}
                        sourceDomain={null}
                        computed
                      >
                        {row.gap > 0 && (
                          <p className="tabular-nums">Gap to headline {formatUsd(row.gap)}</p>
                        )}
                      </VizTooltip>
                    );
                  }}
                />
                <Bar
                  dataKey="value"
                  stackId="p"
                  isAnimationActive={false}
                  stroke={HEADLINE.stroke}
                  fill={HEADLINE.fill}
                >
                  {data.map((d) => {
                    const m = d.key === "headline" ? HEADLINE : EFFECTIVE;
                    return <Cell key={d.key} fill={m.fill} stroke={m.stroke} />;
                  })}
                  <LabelList
                    dataKey="value"
                    position="insideTop"
                    formatter={(n: unknown) => formatUsd(Number(n))}
                    fill="var(--ink)"
                    fontSize={13}
                  />
                </Bar>
                <Bar
                  dataKey="gap"
                  stackId="p"
                  isAnimationActive={false}
                  fill="transparent"
                  stroke="var(--muted)"
                  strokeDasharray="4 3"
                >
                  <LabelList
                    dataKey="gap"
                    position="center"
                    formatter={(n: unknown) => (Number(n) > 0 ? `Gap ${formatUsd(Number(n))}` : "")}
                    fill="var(--ink)"
                    fontSize={13}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ChartFrame
            title="Ownership after the round"
            subtitle="One bar, 100% of the fully diluted shares after closing, pool included."
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            computed="Computed from the inputs on the left. Example values are illustrative, not data."
            height={120}
            tableAlternative={
              <ChartTable
                caption="Ownership after the round"
                rows={own.segments}
                rowKey={(s) => s.key}
                columns={[
                  { header: "Holder", cell: (s) => s.label },
                  { header: "Shares", numeric: true, cell: (s) => formatCount(s.shares) },
                  { header: "Ownership", numeric: true, cell: (s) => formatPercent(s.fraction) },
                ]}
              />
            }
          >
            <ShareBar segments={own.segments} ariaLabel="Ownership after the round" />
          </ChartFrame>
        </>
      )}
    </CalculatorLayout>
  );
}
