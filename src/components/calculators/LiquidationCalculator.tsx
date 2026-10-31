"use client";

import { useMemo, useState } from "react";
import { parseAsStringLiteral, useQueryStates } from "nuqs";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
  Segmented,
  Stat,
  VizTooltip,
} from "@/components/ui-atlas";
import { LIQUIDATION_DEFAULTS as D } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS, matchesDefaults, numberParam } from "@/lib/calculators/url";
import { useLastValid } from "@/lib/calculators/useLastValid";
import {
  distribute,
  liquidationBreakpoints,
  type Participation,
  type PreferredClass,
} from "@/lib/finance";
import { formatCount, formatUsd } from "@/lib/format";
import { CATEGORICAL, logAxisTitle } from "@/lib/viz";
import {
  breakpointLabels,
  labelledBreakpoints,
  payoutSeries,
  payoutSeriesKeys,
  payoutTable,
  type PayoutRow,
} from "@/lib/viz/transforms/calcLiquidation";

const PART = ["none", "full", "capped"] as const;

const parsers = {
  cs: numberParam(D.cs),
  ai: numberParam(D.ai),
  ash: numberParam(D.ash),
  am: numberParam(D.am),
  ap: parseAsStringLiteral(PART).withDefault(D.ap),
  ac: numberParam(D.ac),
  bi: numberParam(D.bi),
  bsh: numberParam(D.bsh),
  bm: numberParam(D.bm),
  bp: parseAsStringLiteral(PART).withDefault(D.bp),
  bc: numberParam(D.bc),
  sen: parseAsStringLiteral(["b", "pari"] as const).withDefault(D.sen),
  max: numberParam(D.max),
  sc: parseAsStringLiteral(["lin", "log"] as const).withDefault(D.sc),
  x: numberParam(D.x),
};

type Inputs = {
  cs: number;
  ai: number;
  ash: number;
  am: number;
  ap: Participation;
  ac: number;
  bi: number;
  bsh: number;
  bm: number;
  bp: Participation;
  bc: number;
  sen: "b" | "pari";
  max: number;
  sc: "lin" | "log";
  x: number;
};

function compute(i: Inputs) {
  const classes: PreferredClass[] = [
    {
      name: "Series A",
      invested: i.ai,
      shares: i.ash,
      multiple: i.am,
      participation: i.ap,
      capMultiple: i.ap === "capped" ? i.ac : undefined,
      seniority: 1,
    },
    {
      name: "Series B",
      invested: i.bi,
      shares: i.bsh,
      multiple: i.bm,
      participation: i.bp,
      capMultiple: i.bp === "capped" ? i.bc : undefined,
      seniority: i.sen === "b" ? 2 : 1,
    },
  ];
  const base = { commonShares: i.cs, classes };
  const breakpoints = liquidationBreakpoints(base, i.max);
  const scale = i.sc === "log" ? "log" : "linear";
  return {
    keys: payoutSeriesKeys(base),
    rows: payoutSeries({ base, maxExit: i.max, scale, breakpoints }),
    table: payoutTable(base, i.max, breakpoints),
    labels: breakpointLabels(breakpoints),
    at: distribute({ ...base, exitValue: i.x }),
    classes,
    base,
  };
}

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const COLORS: Record<string, string> = {
  common: CATEGORICAL[4],
  c0: CATEGORICAL[0],
  c1: CATEGORICAL[1],
};
const PART_LABEL = { none: "None", full: "Full", capped: "Capped" } as const;

/** Powers of ten inside [min, max], for a log axis. */
function logTicks(min: number, max: number): number[] {
  const out: number[] = [];
  for (let p = Math.ceil(Math.log10(min)); 10 ** p <= max; p++) out.push(10 ** p);
  return out;
}

export function LiquidationCalculator() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const inputs = useMemo<Inputs>(
    () => ({
      cs: v.cs,
      ai: v.ai,
      ash: v.ash,
      am: v.am,
      ap: v.ap,
      ac: v.ac,
      bi: v.bi,
      bsh: v.bsh,
      bm: v.bm,
      bp: v.bp,
      bc: v.bc,
      sen: v.sen,
      max: v.max,
      sc: v.sc,
      x: v.x,
    }),
    [v.cs, v.ai, v.ash, v.am, v.ap, v.ac, v.bi, v.bsh, v.bm, v.bp, v.bc, v.sen, v.max, v.sc, v.x],
  );
  const { result, error, stale } = useLastValid(inputs, compute);
  const log = v.sc === "log";
  const min = log ? v.max / 1000 : 0;
  // Plot width (chart width less the y axis and right margin), for spacing breakpoint labels.
  const [plotWidth, setPlotWidth] = useState(600);
  const labelled = result
    ? labelledBreakpoints(result.labels, [min, v.max], log, plotWidth)
    : new Set<number>();
  const crowded = result
    ? result.labels.filter((b) => b.exit >= min && b.exit <= v.max).length - labelled.size
    : 0;
  const labelAt = new Map<number, string>();
  for (const b of result?.labels ?? []) {
    const prev = labelAt.get(b.exit);
    labelAt.set(b.exit, prev ? `${prev}; ${b.label}` : b.label);
  }

  const tableAlt = result && (
    <ChartTable
      caption="Payout by exit value, with each breakpoint"
      rows={result.table}
      rowKey={(r) => String(r.exit)}
      columns={[
        { header: "Exit value", numeric: true, cell: (r) => formatUsd(r.exit) },
        ...result.keys.map((k) => ({
          header: k.label,
          numeric: true,
          cell: (r: PayoutRow) => formatUsd(r[k.key]),
        })),
        { header: "Breakpoint", cell: (r: PayoutRow) => labelAt.get(r.exit) ?? "" },
      ]}
    />
  );

  return (
    <CalculatorLayout
      isExample={matchesDefaults(inputs, D)}
      onReset={() => void setV(null)}
      error={error}
      stale={stale}
      inputs={
        <>
          <NumberField
            label="Common shares"
            kind="count"
            min={100_000}
            max={1_000_000_000}
            slider="log"
            value={v.cs}
            onChange={(cs) => void setV({ cs })}
            hint="Founders and employees, including exercised options."
          />
          <ClassFields
            name="Series A"
            invested={v.ai}
            shares={v.ash}
            multiple={v.am}
            part={v.ap}
            cap={v.ac}
            onInvested={(ai) => void setV({ ai })}
            onShares={(ash) => void setV({ ash })}
            onMultiple={(am) => void setV({ am })}
            onPart={(ap) => void setV({ ap })}
            onCap={(ac) => void setV({ ac })}
          />
          <ClassFields
            name="Series B"
            invested={v.bi}
            shares={v.bsh}
            multiple={v.bm}
            part={v.bp}
            cap={v.bc}
            onInvested={(bi) => void setV({ bi })}
            onShares={(bsh) => void setV({ bsh })}
            onMultiple={(bm) => void setV({ bm })}
            onPart={(bp) => void setV({ bp })}
            onCap={(bc) => void setV({ bc })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Who is paid first</span>
            <Segmented
              label="Who is paid first"
              value={v.sen}
              onChange={(sen) => void setV({ sen })}
              options={[
                { value: "b", label: "Series B first" },
                { value: "pari", label: "Pari passu" },
              ]}
            />
          </div>
          <h3 className="pt-2 text-sm font-semibold">Exit range</h3>
          <NumberField
            label="Largest exit to show"
            kind="usd"
            min={1_000_000}
            max={10_000_000_000}
            slider="log"
            value={v.max}
            onChange={(max) => void setV({ max })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Exit axis</span>
            <Segmented
              label="Exit axis"
              value={v.sc}
              onChange={(sc) => void setV({ sc })}
              options={[
                { value: "lin", label: "Linear" },
                { value: "log", label: "Log scale" },
              ]}
            />
          </div>
          <NumberField
            label="Exit to read off"
            kind="usd"
            min={0}
            max={10_000_000_000}
            step={100_000}
            value={v.x}
            onChange={(x) => void setV({ x })}
            hint="The stats above the chart show who gets what at this exit value."
          />
        </>
      }
      how={
        <>
          <p>
            At an exit, preferred classes are paid before common. Each class that does not convert
            takes its preference (multiple × money invested), senior classes first and pari passu
            inside a tier. What is left is shared by as-converted shares among common, converted
            classes and participating classes. A participating class takes its preference and its
            share of the rest; a capped one stops when its total reaches the cap and the excess goes
            to everyone else. A class converts to common when that pays it more than its preference,
            found by testing each choice until none improves. The dashed lines are the exit values
            where a curve changes slope, found by bisection on the same payout function the curves
            use.
          </p>
          <FormulaLine>
            preference = multiple × invested · converts when as-converted share of the residual &gt;
            preference (non-participating) · capped total ≤ cap × invested
          </FormulaLine>
          {result && (
            <div className="flex flex-col gap-2">
              <p className="font-medium text-ink">
                Worked example at a {formatUsd(v.x)} exit, with the current inputs
              </p>
              {result.at.classes.map((c, i) => {
                const k = result.classes[i] as PreferredClass;
                return (
                  <FormulaLine key={c.name}>
                    {c.name}:{" "}
                    {c.converted
                      ? `converts, ${formatCount(k.shares)} shares share the residual → ${formatUsd(c.total)}`
                      : `preference ${formatUsd(c.preference)} (${k.multiple}× of ${formatUsd(k.invested)})${
                          c.participation > 0
                            ? ` + participation ${formatUsd(c.participation)}`
                            : ""
                        } → ${formatUsd(c.total)}`}
                  </FormulaLine>
                );
              })}
              <FormulaLine>
                Common: {formatUsd(result.at.common)} · total paid:{" "}
                {formatUsd(result.at.common + result.at.classes.reduce((a, c) => a + c.total, 0))}{" "}
                of {formatUsd(v.x)}
              </FormulaLine>
            </div>
          )}
        </>
      }
    >
      {result && (
        <>
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-4">
            <Stat label="Exit value" value={formatUsd(v.x)} />
            <Stat label="Common gets" value={formatUsd(result.at.common)} />
            {result.at.classes.map((c) => (
              <Stat
                key={c.name}
                label={`${c.name} gets`}
                value={formatUsd(c.total)}
                unit={c.converted ? "converted" : undefined}
              />
            ))}
          </div>
          <ChartFrame
            title="Who gets what at each exit"
            subtitle="Payout to each class as the exit value rises. Dashed lines mark where a class's treatment changes."
            legend={
              <Legend
                kind="categorical"
                items={result.keys.map((k) => ({ label: k.label, color: COLORS[k.key] as string }))}
              />
            }
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            computed="Computed from the inputs on the left. Example values are illustrative, not data."
            height={420}
            tableAlternative={tableAlt}
          >
            <ResponsiveContainer
              width="100%"
              height={420}
              onResize={(w) => setPlotWidth(Math.max(0, w - 64 - 24))}
            >
              <LineChart data={result.rows} margin={{ top: 12, right: 24, bottom: 28, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rule)" />
                <XAxis
                  dataKey="exit"
                  type="number"
                  scale={log ? "log" : "linear"}
                  domain={[min, v.max]}
                  allowDataOverflow
                  ticks={log ? logTicks(min, v.max) : undefined}
                  tick={TICK}
                  axisLine={{ stroke: "var(--rule)" }}
                  tickLine={false}
                  tickFormatter={(n: number) => formatUsd(n)}
                  label={{
                    value: log ? logAxisTitle("Exit value") : "Exit value",
                    position: "insideBottom",
                    offset: -16,
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
                  cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
                  content={(p) => {
                    const row = p.active
                      ? (p.payload?.[0]?.payload as PayoutRow | undefined)
                      : undefined;
                    if (!row) return null;
                    return (
                      <VizTooltip
                        title="Exit value"
                        value={formatUsd(row.exit)}
                        confidence={null}
                        sourceDomain={null}
                        computed
                      >
                        {result.keys.map((k) => (
                          <p key={k.key} className="tabular-nums">
                            {k.label}: {formatUsd(row[k.key])}
                          </p>
                        ))}
                      </VizTooltip>
                    );
                  }}
                />
                {result.labels
                  .map((b, i) => ({ b, i }))
                  .filter(({ b }) => b.exit >= min && b.exit <= v.max)
                  .map(({ b, i }) => (
                    <ReferenceLine
                      key={`${b.kind}-${b.label}`}
                      x={b.exit}
                      stroke="var(--muted)"
                      strokeDasharray="5 4"
                      label={(p: { viewBox?: { x?: number; y?: number } }) => {
                        // Too close to the last drawn label: keep the line, leave the words to the table.
                        if (!labelled.has(i)) return null;
                        const x = (p.viewBox?.x ?? 0) - 5;
                        const y = (p.viewBox?.y ?? 0) + 6;
                        return (
                          <text
                            x={x}
                            y={y}
                            transform={`rotate(-90 ${x} ${y})`}
                            textAnchor="end"
                            fontSize={12}
                            fill="var(--ink-2)"
                            stroke="var(--panel)"
                            strokeWidth={3}
                            paintOrder="stroke"
                          >
                            {b.label}
                          </text>
                        );
                      }}
                    />
                  ))}
                {result.keys.map((k) => (
                  <Line
                    key={k.key}
                    type="linear"
                    dataKey={k.key}
                    stroke={COLORS[k.key]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          {result.labels.length === 0 && (
            <p className="text-sm text-ink-2">
              No breakpoints fall inside this exit range. Widen the range to see them.
            </p>
          )}
          {crowded > 0 && (
            <p className="text-sm text-ink-2">
              {crowded === 1
                ? "One breakpoint line has no label because it sits close to another."
                : `${crowded} breakpoint lines have no label because they sit close to others.`}{" "}
              Switch to View as table to read every breakpoint.
            </p>
          )}
        </>
      )}
    </CalculatorLayout>
  );
}

function ClassFields({
  name,
  invested,
  shares,
  multiple,
  part,
  cap,
  onInvested,
  onShares,
  onMultiple,
  onPart,
  onCap,
}: {
  name: string;
  invested: number;
  shares: number;
  multiple: number;
  part: Participation;
  cap: number;
  onInvested: (n: number) => void;
  onShares: (n: number) => void;
  onMultiple: (n: number) => void;
  onPart: (p: Participation) => void;
  onCap: (n: number) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-rule p-3">
      <legend className="px-1 text-sm font-semibold">{name}</legend>
      <NumberField
        label={`${name} invested`}
        kind="usd"
        min={10_000}
        max={5_000_000_000}
        slider="log"
        value={invested}
        onChange={onInvested}
      />
      <NumberField
        label={`${name} shares`}
        kind="count"
        min={1_000}
        max={1_000_000_000}
        slider="log"
        value={shares}
        onChange={onShares}
        hint="Common shares this class converts into."
      />
      <NumberField
        label={`${name} preference multiple`}
        kind="count"
        min={1}
        max={5}
        step={1}
        value={multiple}
        onChange={(n) => onMultiple(Math.round(n))}
        hint="1 means the class gets its money back first; 2 means twice its money."
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{name} participation</span>
        <Segmented
          label={`${name} participation`}
          value={part}
          onChange={onPart}
          options={PART.map((p) => ({ value: p, label: PART_LABEL[p] }))}
        />
      </div>
      {part === "capped" && (
        <NumberField
          label={`${name} total return cap`}
          kind="count"
          min={1}
          max={10}
          step={1}
          value={cap}
          onChange={(n) => onCap(Math.round(n))}
          hint="Multiple of the money invested that the class stops at, preference and participation together. Must be at least the preference multiple."
        />
      )}
    </fieldset>
  );
}
