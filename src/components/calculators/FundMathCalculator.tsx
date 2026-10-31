"use client";

import { useMemo } from "react";
import { parseAsInteger, useQueryStates } from "nuqs";
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
  BulletGauge,
  CalculatorLayout,
  ChartFrame,
  FormulaLine,
  Legend,
  NumberField,
  Stat,
  VizTooltip,
} from "@/components/ui-atlas";
import { FUND_MATH_DEFAULTS as D } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS, matchesDefaults, numberParam } from "@/lib/calculators/url";
import { useLastValid } from "@/lib/calculators/useLastValid";
import { fundScenario } from "@/lib/finance";
import { formatMultiple, formatPercent, formatUsd } from "@/lib/format";
import { CATEGORICAL, markStyle } from "@/lib/viz";
import { exitByFundSize, exitGauge, type FundBar } from "@/lib/viz/transforms/calcFund";

const parsers = {
  fund: numberParam(D.fund),
  own: numberParam(D.own),
  rnd: parseAsInteger.withDefault(D.rnd),
  dil: numberParam(D.dil),
  mult: numberParam(D.mult),
  ex: numberParam(D.ex),
};

type Inputs = { fund: number; own: number; rnd: number; dil: number; mult: number; ex: number };

function compute(i: Inputs) {
  const scenario = fundScenario({
    fundSize: i.fund,
    entryOwnership: i.own,
    laterRounds: i.rnd,
    dilutionPerRound: i.dil,
    multiple: i.mult,
    assumedExit: i.ex,
  });
  return {
    scenario,
    gauge: exitGauge(scenario.exitNeeded, i.ex),
    bars: exitByFundSize({
      selectedFundSize: i.fund,
      ownershipAtExit: scenario.ownershipAtExit,
      multiple: i.mult,
      formatSize: formatUsd,
    }),
  };
}

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const SELECTED = markStyle(CATEGORICAL[0]);
const OTHER = markStyle("#C4C9D1");

export function FundMathCalculator() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const inputs = useMemo<Inputs>(
    () => ({ fund: v.fund, own: v.own, rnd: v.rnd, dil: v.dil, mult: v.mult, ex: v.ex }),
    [v.fund, v.own, v.rnd, v.dil, v.mult, v.ex],
  );
  const { result, error, stale } = useLastValid(inputs, compute);
  const s = result?.scenario;
  const goal = v.mult === 1 ? "the fund" : `${v.mult}× the fund`;

  return (
    <CalculatorLayout
      isExample={matchesDefaults(inputs, D)}
      onReset={() => void setV(null)}
      error={error}
      stale={stale}
      inputs={
        <>
          <NumberField
            label="Fund size"
            kind="usd"
            min={5_000_000}
            max={10_000_000_000}
            slider="log"
            value={v.fund}
            onChange={(fund) => void setV({ fund })}
            hint="Total capital the fund invests. Drag it to see how the exit a single company needs scales with it."
          />
          <NumberField
            label="Ownership at entry"
            kind="percent"
            min={0.005}
            max={1}
            step={0.005}
            value={v.own}
            onChange={(own) => void setV({ own })}
            hint="The stake the fund holds right after its first check."
          />
          <NumberField
            label="Later funding rounds"
            kind="count"
            min={0}
            max={8}
            step={1}
            value={v.rnd}
            onChange={(rnd) => void setV({ rnd: Math.round(rnd) })}
            hint="Rounds after entry in which the fund does not invest. Each one dilutes it."
          />
          <NumberField
            label="Dilution per later round"
            kind="percent"
            min={0}
            max={0.6}
            step={0.005}
            value={v.dil}
            onChange={(dil) => void setV({ dil })}
            hint="Share of the company sold in each later round, applied equally to every one."
          />
          <NumberField
            label="Return you want"
            kind="count"
            min={1}
            max={10}
            step={1}
            value={v.mult}
            onChange={(mult) => void setV({ mult: Math.round(mult) })}
            hint="1 means this one company returns the whole fund; 3 means three times the fund."
          />
          <NumberField
            label="Exit you assume"
            kind="usd"
            min={1_000_000}
            max={100_000_000_000}
            slider="log"
            value={v.ex}
            onChange={(ex) => void setV({ ex })}
            hint="Your own assumption, compared with the exit that is needed. Example values are not data."
          />
        </>
      }
      how={
        <>
          <p>
            A fund needs its winners to return more than the fund. Its stake shrinks with every
            later round it does not follow, so the stake at exit is the entry stake times (1 −
            dilution) for each later round. The company must then be worth the fund size times the
            return you want, divided by that stake. The same stake in a bigger fund needs a
            proportionally bigger exit, which is why a $50M fund and a $1B fund look for different
            companies.
          </p>
          <FormulaLine>
            ownership at exit = entry × (1 − dilution)^rounds · exit needed = fund size × multiple ÷
            ownership at exit
          </FormulaLine>
          {result && s && (
            <div className="flex flex-col gap-2">
              <p className="font-medium text-ink">Worked example, with the current inputs</p>
              <FormulaLine>
                Ownership at exit: {formatPercent(v.own)} × (1 − {formatPercent(v.dil)})^{v.rnd} ={" "}
                {formatPercent(s.ownershipAtExit)}
              </FormulaLine>
              <FormulaLine>
                Exit needed: {formatUsd(v.fund)} × {v.mult} ÷ {formatPercent(s.ownershipAtExit)} ={" "}
                {formatUsd(s.exitNeeded)}
              </FormulaLine>
              <FormulaLine>
                At a {formatUsd(v.ex)} exit: {formatUsd(v.ex)} × {formatPercent(s.ownershipAtExit)}{" "}
                = {formatUsd(v.ex * s.ownershipAtExit)} back,{" "}
                {formatMultiple(s.returnAtAssumedExit)} the fund
              </FormulaLine>
            </div>
          )}
        </>
      }
    >
      {result && s && (
        <>
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-4">
            <Stat label="Ownership at exit" value={formatPercent(s.ownershipAtExit)} />
            <Stat label={`Exit that returns ${goal}`} value={formatUsd(s.exitNeeded)} />
            <Stat label="Exit you assume" value={formatUsd(v.ex)} />
            <Stat label="Fund back at that exit" value={formatMultiple(s.returnAtAssumedExit)} />
          </div>
          <ChartFrame
            title="Exit needed to return the fund"
            subtitle="The tick is the exit that returns the fund. The bar is the exit you assume. Both start at zero on one linear scale."
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            computed="Computed from the inputs on the left. Example values are illustrative, not data."
            height={150}
            tableAlternative={
              <ChartTable
                caption="Exit needed against exit assumed"
                rows={[
                  {
                    key: "need",
                    label: `Exit that returns ${goal}`,
                    value: formatUsd(s.exitNeeded),
                  },
                  { key: "assume", label: "Exit you assume", value: formatUsd(v.ex) },
                  {
                    key: "back",
                    label: "Fund back at the assumed exit",
                    value: formatMultiple(s.returnAtAssumedExit),
                  },
                ]}
                rowKey={(r) => r.key}
                columns={[
                  { header: "Measure", cell: (r) => r.label },
                  { header: "Value", numeric: true, cell: (r) => r.value },
                ]}
              />
            }
          >
            <BulletGauge
              assumedFrac={result.gauge.assumedFrac}
              requiredFrac={result.gauge.requiredFrac}
              max={result.gauge.max}
              formatValue={formatUsd}
              reaches={result.gauge.reaches}
              color={CATEGORICAL[0]}
              requiredLabel={`${formatUsd(s.exitNeeded)} exit returns ${goal}`}
              assumedLabel={`You assume a ${formatUsd(v.ex)} exit, which gives ${formatMultiple(s.returnAtAssumedExit)} the fund`}
              ariaLabel={`Exit that returns ${goal}: ${formatUsd(s.exitNeeded)}. Exit you assume: ${formatUsd(v.ex)}.`}
            />
          </ChartFrame>
          <FundBars bars={result.bars} ownership={s.ownershipAtExit} goal={goal} />
        </>
      )}
    </CalculatorLayout>
  );
}

function FundBars({ bars, ownership, goal }: { bars: FundBar[]; ownership: number; goal: string }) {
  const first = bars[0] as FundBar;
  const last = bars[bars.length - 1] as FundBar;
  return (
    <ChartFrame
      title="Why fund size changes the target"
      subtitle={`Exit one company needs to return ${goal} at ${formatPercent(ownership)} ownership at exit, for different fund sizes.`}
      legend={
        <Legend
          kind="categorical"
          items={[
            { label: "Fund size you set", color: CATEGORICAL[0] },
            { label: "Other fund sizes", color: "#C4C9D1" },
          ]}
        />
      }
      sources={[]}
      notShown={{ count: 0, field: "none" }}
      computed="Computed from the inputs on the left. Example values are illustrative, not data."
      height={300}
      tableAlternative={
        <ChartTable
          caption="Exit needed by fund size"
          rows={bars}
          rowKey={(b) => b.key}
          columns={[
            { header: "Fund size", numeric: true, cell: (b) => formatUsd(b.fundSize) },
            { header: "Exit needed", numeric: true, cell: (b) => formatUsd(b.exitNeeded) },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-2">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={bars} margin={{ top: 24, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rule)" />
            <XAxis
              dataKey="label"
              tick={TICK}
              axisLine={{ stroke: "var(--rule)" }}
              tickLine={false}
              interval={0}
              label={{
                value: "Fund size",
                position: "insideBottom",
                offset: -4,
                fontSize: 12,
                fill: "var(--ink-2)",
              }}
              height={40}
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
                const b = p.active ? (p.payload?.[0]?.payload as FundBar | undefined) : undefined;
                if (!b) return null;
                return (
                  <VizTooltip
                    title={`${b.label} fund`}
                    value={formatUsd(b.exitNeeded)}
                    confidence={null}
                    sourceDomain={null}
                    computed
                  >
                    <p>Exit needed to return {goal}</p>
                  </VizTooltip>
                );
              }}
            />
            <Bar dataKey="exitNeeded" isAnimationActive={false}>
              {bars.map((b) => {
                const m = b.selected ? SELECTED : OTHER;
                return <Cell key={b.key} fill={m.fill} stroke={m.stroke} />;
              })}
              <LabelList
                dataKey="exitNeeded"
                position="top"
                formatter={(n: unknown) => formatUsd(Number(n))}
                style={{ fontSize: 13, fill: "var(--ink)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {first !== last && (
          <p className="text-sm text-ink-2">
            At this ownership a {first.label} fund needs a {formatUsd(first.exitNeeded)} exit and a{" "}
            {last.label} fund needs {formatUsd(last.exitNeeded)}.
          </p>
        )}
      </div>
    </ChartFrame>
  );
}
