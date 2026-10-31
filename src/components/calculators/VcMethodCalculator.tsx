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
  Stat,
  VizTooltip,
} from "@/components/ui-atlas";
import { VC_METHOD_DEFAULTS as D } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS, matchesDefaults, numberParam } from "@/lib/calculators/url";
import { useLastValid } from "@/lib/calculators/useLastValid";
import { vcMethod } from "@/lib/finance";
import { formatPercent, formatUsd } from "@/lib/format";
import { CATEGORICAL, markStyle } from "@/lib/viz";
import { postMoneyByMultiple, type PostMoneyBar } from "@/lib/viz/transforms/calcFund";

const parsers = {
  ex: numberParam(D.ex),
  tm: numberParam(D.tm),
  ret: numberParam(D.ret),
  inv: numberParam(D.inv),
};

type Inputs = { ex: number; tm: number; ret: number; inv: number };

function compute(i: Inputs) {
  const r = vcMethod({
    exitValue: i.ex,
    targetMultiple: i.tm,
    retention: i.ret,
    investment: i.inv,
  });
  const bars = postMoneyByMultiple({
    exitValue: i.ex,
    retention: i.ret,
    investment: i.inv,
    selectedMultiple: i.tm,
  });
  return { r, bars };
}

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const SELECTED = markStyle(CATEGORICAL[0]);
const OTHER = markStyle("#C4C9D1");

export function VcMethodCalculator() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const inputs = useMemo<Inputs>(
    () => ({ ex: v.ex, tm: v.tm, ret: v.ret, inv: v.inv }),
    [v.ex, v.tm, v.ret, v.inv],
  );
  const { result, error, stale } = useLastValid(inputs, compute);
  const r = result?.r;

  return (
    <CalculatorLayout
      isExample={matchesDefaults(inputs, D)}
      onReset={() => void setV(null)}
      error={error}
      stale={stale}
      inputs={
        <>
          <NumberField
            label="Exit value"
            kind="usd"
            min={1_000_000}
            max={100_000_000_000}
            slider="log"
            value={v.ex}
            onChange={(ex) => void setV({ ex })}
            hint="The company value you expect at exit. An assumption: the example is not data."
          />
          <NumberField
            label="Target return multiple"
            kind="count"
            min={1}
            max={100}
            slider="log"
            step={1}
            value={v.tm}
            onChange={(tm) => void setV({ tm: Math.round(tm) })}
            hint="How many times the investment you want back, for example 10 for 10×."
          />
          <NumberField
            label="Ownership kept to exit"
            kind="percent"
            min={0.05}
            max={1}
            step={0.005}
            value={v.ret}
            onChange={(ret) => void setV({ ret })}
            hint="Share of the entry stake left after later rounds dilute it. 50% means the stake halves."
          />
          <NumberField
            label="Investment"
            kind="usd"
            min={10_000}
            max={1_000_000_000}
            slider="log"
            value={v.inv}
            onChange={(inv) => void setV({ inv })}
          />
        </>
      }
      how={
        <>
          <p>
            The VC method starts from the exit and works back. To earn the target multiple, the
            stake held at exit has to be worth investment × multiple. Later rounds shrink the stake,
            so the entry stake must be larger by the amount kept: the post-money valuation is the
            exit value times the share kept, divided by the multiple. Pre-money is post-money less
            the investment.
          </p>
          <FormulaLine>
            post-money = exit × share kept ÷ target multiple · pre-money = post-money − investment ·
            entry ownership = investment ÷ post-money
          </FormulaLine>
          {result && r && (
            <div className="flex flex-col gap-2">
              <p className="font-medium text-ink">Worked example, with the current inputs</p>
              <FormulaLine>
                Post-money: {formatUsd(v.ex)} × {formatPercent(v.ret)} ÷ {v.tm} ={" "}
                {formatUsd(r.postMoney)}
              </FormulaLine>
              <FormulaLine>
                Pre-money: {formatUsd(r.postMoney)} − {formatUsd(v.inv)} = {formatUsd(r.preMoney)}
              </FormulaLine>
              <FormulaLine>
                Entry ownership: {formatUsd(v.inv)} ÷ {formatUsd(r.postMoney)} ={" "}
                {formatPercent(r.requiredOwnership)}; at exit {formatPercent(r.requiredOwnership)} ×{" "}
                {formatPercent(v.ret)} = {formatPercent(r.ownershipAtExit)}, worth{" "}
                {formatUsd(v.ex * r.ownershipAtExit)}
              </FormulaLine>
            </div>
          )}
        </>
      }
    >
      {result && r && (
        <>
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-4">
            <Stat label="Post-money you can pay" value={formatUsd(r.postMoney)} />
            <Stat label="Pre-money you can pay" value={formatUsd(r.preMoney)} />
            <Stat label="Ownership needed at entry" value={formatPercent(r.requiredOwnership)} />
            <Stat label="Ownership at exit" value={formatPercent(r.ownershipAtExit)} />
          </div>
          <ChartFrame
            title="Highest post-money you can pay"
            subtitle="Post-money that still earns each target multiple at this exit and share kept. A higher target leaves less room."
            legend={
              <Legend
                kind="categorical"
                items={[
                  { label: "Target you set", color: CATEGORICAL[0] },
                  { label: "Other targets", color: "#C4C9D1" },
                ]}
              />
            }
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            computed="Computed from the inputs on the left. Example values are illustrative, not data."
            height={300}
            tableAlternative={
              <ChartTable
                caption="Post-money by target multiple"
                rows={result.bars}
                rowKey={(b) => String(b.multiple)}
                columns={[
                  { header: "Target multiple", numeric: true, cell: (b) => `${b.multiple}×` },
                  { header: "Post-money", numeric: true, cell: (b) => formatUsd(b.postMoney) },
                ]}
              />
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={result.bars} margin={{ top: 24, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rule)" />
                <XAxis
                  dataKey="multiple"
                  tick={TICK}
                  axisLine={{ stroke: "var(--rule)" }}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(n: number) => `${n}×`}
                  height={40}
                  label={{
                    value: "Target multiple",
                    position: "insideBottom",
                    offset: -4,
                    fontSize: 12,
                    fill: "var(--ink-2)",
                  }}
                />
                <YAxis
                  domain={[0, "auto"]}
                  tick={TICK}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={(n: number) => formatUsd(n)}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent-soft)" }}
                  content={(p) => {
                    const b = p.active
                      ? (p.payload?.[0]?.payload as PostMoneyBar | undefined)
                      : undefined;
                    if (!b) return null;
                    return (
                      <VizTooltip
                        title={`${b.multiple}× target`}
                        value={formatUsd(b.postMoney)}
                        confidence={null}
                        sourceDomain={null}
                        computed
                      >
                        <p>Highest post-money that still earns {b.multiple}×</p>
                      </VizTooltip>
                    );
                  }}
                />
                <Bar dataKey="postMoney" isAnimationActive={false}>
                  {result.bars.map((b) => {
                    const m = b.selected ? SELECTED : OTHER;
                    return <Cell key={b.multiple} fill={m.fill} stroke={m.stroke} />;
                  })}
                  <LabelList
                    dataKey="postMoney"
                    position="top"
                    formatter={(n: unknown) => formatUsd(Number(n))}
                    style={{ fontSize: 13, fill: "var(--ink)" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </>
      )}
    </CalculatorLayout>
  );
}
