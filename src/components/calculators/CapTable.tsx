"use client";

import { useMemo } from "react";
import { useQueryStates } from "nuqs";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTable, type TableColumn } from "@/components/charts/ChartTable";
import { Button } from "@/components/ui/button";
import {
  CalculatorLayout,
  ChartFrame,
  FormulaLine,
  Legend,
  NumberField,
  Panel,
  Stat,
  VizTooltip,
} from "@/components/ui-atlas";
import {
  MAX_STEPS,
  encodeSteps,
  STEP_LABEL,
  newStep,
  stepsParser,
  toCapTableSteps,
  type StepDraft,
} from "@/lib/calculators/capTableSteps";
import { CAP_TABLE_DEFAULTS as D } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS, numberParam } from "@/lib/calculators/url";
import { useLastValid } from "@/lib/calculators/useLastValid";
import { CAP_TABLE_ROUNDING, POOL, initialSnapshot, simulate } from "@/lib/finance";
import {
  formatCount,
  formatPercent,
  formatPoints,
  formatPricePerShare,
  formatUsd,
  UNKNOWN,
} from "@/lib/format";
import { markStyle } from "@/lib/viz";
import { FOUNDERS_KEY, capTableSeries, type CapPoint } from "@/lib/viz/transforms/calcCapTable";

const parsers = { fsh: numberParam(D.fsh), pool: numberParam(D.pool), steps: stepsParser };
const FOUNDERS = "founders";

type Inputs = { fsh: number; pool: number; steps: StepDraft[] };

function compute(i: Inputs) {
  const engineSteps = toCapTableSteps(i.steps);
  const start = initialSnapshot({ [FOUNDERS]: i.fsh, [POOL]: i.pool });
  const snaps = simulate({
    holdings: { [FOUNDERS]: i.fsh, [POOL]: i.pool },
    steps: engineSteps,
    rounding: CAP_TABLE_ROUNDING,
  });
  const snapshots = [start, ...snaps];
  return { engineSteps, snapshots, series: capTableSeries(engineSteps, snapshots) };
}

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;

export function CapTable() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const inputs = useMemo<Inputs>(
    () => ({ fsh: v.fsh, pool: v.pool, steps: v.steps }),
    [v.fsh, v.pool, v.steps],
  );
  const { result, error, stale } = useLastValid(inputs, compute);

  const setSteps = (steps: StepDraft[]) => void setV({ steps });
  const update = (i: number, next: StepDraft) =>
    setSteps(inputs.steps.map((s, j) => (j === i ? next : s)));
  const remove = (i: number) => setSteps(inputs.steps.filter((_, j) => j !== i));
  const add = (kind: StepDraft["kind"]) => setSteps([...inputs.steps, newStep(kind)]);

  const series = result?.series;
  const points = series?.points ?? [];
  const first = points[0];
  const last = points[points.length - 1];

  const columns: TableColumn<CapPoint>[] = series
    ? [
        { header: "Step", cell: (p) => p.label },
        ...series.classes.map((c): TableColumn<CapPoint> => ({
          header: c.key === FOUNDERS_KEY ? "Founders (%)" : `${c.label} (%)`,
          numeric: true,
          highlight: c.key === FOUNDERS_KEY,
          cell: (p) => formatPercent(p.fractions[c.key]),
        })),
        { header: "Fully diluted shares", numeric: true, cell: (p) => formatCount(p.totalShares) },
        {
          header: "Pending SAFEs and notes",
          numeric: true,
          cell: (p) => (p.pendingUsd > 0 ? formatUsd(p.pendingUsd) : UNKNOWN),
        },
        {
          header: "Round price",
          numeric: true,
          cell: (p) => (p.pricePerShare === null ? UNKNOWN : formatPricePerShare(p.pricePerShare)),
        },
      ]
    : [];
  const table = series && (
    <ChartTable
      caption="Ownership by class after each step"
      rows={points}
      rowKey={(p) => String(p.index)}
      columns={columns}
    />
  );

  return (
    <CalculatorLayout
      isExample={v.fsh === D.fsh && v.pool === D.pool && encodeSteps(inputs.steps) === D.steps}
      onReset={() => void setV(null)}
      error={error}
      stale={stale}
      inputs={
        <>
          <NumberField
            label="Founder shares"
            kind="count"
            min={100_000}
            max={1_000_000_000}
            slider="log"
            value={v.fsh}
            onChange={(fsh) => void setV({ fsh })}
            hint="Shares the founders hold at the start. Ownership everywhere on this page is fully diluted."
          />
          <NumberField
            label="Unissued option pool"
            kind="count"
            min={0}
            max={500_000_000}
            slider="linear"
            step={10_000}
            value={v.pool}
            onChange={(pool) => void setV({ pool })}
            hint="Options set aside but not yet granted. They count in the fully diluted total and in the option pool class."
          />
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Steps, in order</h3>
            {inputs.steps.length === 0 && (
              <p className="text-sm text-ink-2">
                No steps yet. Add a SAFE, note, pool top-up or priced round.
              </p>
            )}
            <ol className="flex flex-col gap-3">
              {inputs.steps.map((s, i) => (
                <StepCard
                  key={`${i}-${s.kind}`}
                  step={s}
                  index={i}
                  onChange={(next) => update(i, next)}
                  onRemove={() => remove(i)}
                />
              ))}
            </ol>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Add a step">
              {(["ps", "rs", "n", "t", "r"] as const).map((k) => (
                <Button
                  key={k}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={inputs.steps.length >= MAX_STEPS}
                  onClick={() => add(k)}
                >
                  Add {STEP_LABEL[k].toLowerCase()}
                </Button>
              ))}
            </div>
          </div>
        </>
      }
      how={
        <>
          <p>
            Steps run in order. A SAFE or note owns nothing until the next priced round, where it
            converts at the better of its cap price and its discounted round price. A pool top-up in
            a priced round is counted in the pre-money, so it dilutes existing holders only. Prices
            are rounded to four decimals and shares to whole shares, and every percentage is of the
            fully diluted shares including the unissued pool.
          </p>
          <FormulaLine>
            ownership = class shares ÷ total fully diluted shares · round price = pre-money ÷
            (shares before + conversions + pool top-up)
          </FormulaLine>
          {series && first && last && <WorkedExample result={result} />}
        </>
      }
    >
      {series && first && last && (
        <>
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-4">
            <Stat label="Founders at start" value={formatPercent(first.founders)} />
            <Stat label="Founders after the last step" value={formatPercent(last.founders)} />
            <Stat
              label="Change for founders"
              value={formatPoints(last.founders - first.founders)}
            />
            <Stat label="Fully diluted shares" value={formatCount(last.totalShares)} />
          </div>
          <ChartFrame
            title="Ownership after each step"
            subtitle="Each column is the cap table after one step; the line follows founder ownership."
            legend={
              <Legend
                kind="categorical"
                items={series.classes.map((c) => ({ label: c.label, color: c.color }))}
              />
            }
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            computed="Computed from the inputs on the left. Example values are illustrative, not data."
            height={300}
            tableAlternative={table}
          >
            <StepChart series={series} />
          </ChartFrame>
          <Panel className="flex flex-col gap-3">
            <div>
              <h3 className="text-lg font-semibold">Ownership at each step</h3>
              <p className="text-sm text-ink-2">
                Founder ownership is highlighted. SAFEs and notes show as pending money until a
                priced round converts them.
              </p>
            </div>
            {table}
          </Panel>
        </>
      )}
    </CalculatorLayout>
  );
}

function StepChart({ series }: { series: NonNullable<ReturnType<typeof compute>>["series"] }) {
  const data = series.points.map((p) => ({ label: p.label, point: p, ...p.fractions }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={data}
        margin={{ top: 24, right: 8, bottom: 0, left: 0 }}
        barCategoryGap={0}
      >
        <CartesianGrid vertical={false} stroke="var(--rule)" />
        <XAxis
          dataKey="label"
          tick={TICK}
          axisLine={{ stroke: "var(--rule)" }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(n: number) => formatPercent(n)}
        />
        <Tooltip
          cursor={{ fill: "var(--accent-soft)" }}
          content={(p) => {
            const row = p.active
              ? (p.payload?.[0]?.payload as { point: CapPoint } | undefined)
              : undefined;
            if (!row) return null;
            const pt = row.point;
            return (
              <VizTooltip
                title={pt.label}
                value={`Founders ${formatPercent(pt.founders)}`}
                confidence={null}
                sourceDomain={null}
                computed
              >
                <ul className="tabular-nums">
                  {series.classes.map((c) => (
                    <li key={c.key}>
                      {c.label} {formatPercent(pt.fractions[c.key])}
                    </li>
                  ))}
                </ul>
                {pt.pendingUsd > 0 && <p>Pending SAFEs and notes {formatUsd(pt.pendingUsd)}</p>}
              </VizTooltip>
            );
          }}
        />
        {series.classes.map((c) => {
          const m = markStyle(c.color);
          return (
            <Bar
              key={c.key}
              dataKey={c.key}
              name={c.label}
              stackId="cap"
              fill={m.fill}
              stroke="var(--panel)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          );
        })}
        <Line
          dataKey={FOUNDERS_KEY}
          name="Founders"
          type="linear"
          stroke="var(--ink)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--panel)", stroke: "var(--ink)", strokeWidth: 2 }}
          isAnimationActive={false}
        >
          <LabelList
            dataKey={FOUNDERS_KEY}
            position="top"
            offset={8}
            formatter={(n: unknown) => formatPercent(Number(n))}
            fill="var(--ink)"
            fontSize={13}
            fontWeight={600}
          />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function WorkedExample({ result }: { result: ReturnType<typeof compute> | null }) {
  if (!result) return null;
  const { snapshots, engineSteps } = result;
  // Walk back to the last priced round: it shows conversion, price and dilution.
  let idx = -1;
  for (let i = engineSteps.length - 1; i >= 0; i--) {
    if (engineSteps[i]?.kind === "priced_round") {
      idx = i;
      break;
    }
  }
  const snap = idx >= 0 ? snapshots[idx + 1] : undefined;
  const before = idx >= 0 ? snapshots[idx] : undefined;
  const fin = snap?.financing;
  const round = idx >= 0 ? engineSteps[idx] : undefined;
  const preMoney = round?.kind === "priced_round" ? round.preMoney : 0;
  if (!snap || !before || !fin) {
    return (
      <p>
        Add a priced round to see a worked conversion. Until then, SAFEs and notes are pending and
        ownership is founders and the pool.
      </p>
    );
  }
  const founders = snap.holdings[FOUNDERS] ?? 0;
  return (
    <>
      <p className="font-medium text-ink">Worked example: the last priced round</p>
      <FormulaLine>
        Round price: {formatUsd(preMoney)} pre-money ÷{" "}
        {formatCount(fin.postConversionFD + fin.poolIncrease)} shares ={" "}
        {formatPricePerShare(fin.pricePerShare)}
      </FormulaLine>
      {fin.conversions.map((c) => (
        <FormulaLine key={c.holder}>
          {c.holder}: {formatUsd(c.amount)} ÷ {formatPricePerShare(c.price)} ={" "}
          {formatCount(c.shares)} shares ({c.method.replace("_", " ")})
        </FormulaLine>
      ))}
      <FormulaLine>
        New money: {formatCount(fin.newShares)} shares · pool top-up:{" "}
        {formatCount(fin.poolIncrease)} shares
      </FormulaLine>
      <FormulaLine>
        Founders: {formatCount(founders)} ÷ {formatCount(snap.totalFD)} ={" "}
        {formatPercent(founders / snap.totalFD)} (was {formatPercent(founders / before.totalFD)})
      </FormulaLine>
    </>
  );
}

/* ------------------------------------------------------------------- step cards */

function StepCard({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: StepDraft;
  index: number;
  onChange: (s: StepDraft) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-rule bg-panel-sunk p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">
          <span className="text-ink-2 tabular-nums">{index + 1}.</span> {STEP_LABEL[step.kind]}
        </h4>
        <Button type="button" variant="ghost" size="xs" onClick={onRemove}>
          Remove
          <span className="sr-only"> step {index + 1}</span>
        </Button>
      </div>
      {(step.kind === "ps" || step.kind === "rs") && (
        <>
          <NumberField
            label={`Amount, step ${index + 1}`}
            kind="usd"
            min={10_000}
            max={500_000_000}
            slider={false}
            value={step.amount}
            onChange={(amount) => onChange({ ...step, amount })}
          />
          <CapField step={step} index={index} onChange={onChange} />
          <DiscountField step={step} index={index} onChange={onChange} />
        </>
      )}
      {step.kind === "n" && (
        <>
          <NumberField
            label={`Principal, step ${index + 1}`}
            kind="usd"
            min={10_000}
            max={500_000_000}
            slider={false}
            value={step.principal}
            onChange={(principal) => onChange({ ...step, principal })}
          />
          <NumberField
            label={`Interest rate, step ${index + 1}`}
            kind="percent"
            min={0}
            max={0.25}
            slider={false}
            value={step.rate}
            onChange={(rate) => onChange({ ...step, rate })}
            hint="Simple annual interest, added to the principal when the note converts."
          />
          <NumberField
            label={`Months to conversion, step ${index + 1}`}
            kind="count"
            min={0}
            max={120}
            slider={false}
            value={step.months}
            onChange={(months) => onChange({ ...step, months })}
          />
          <CapField step={step} index={index} onChange={onChange} />
          <DiscountField step={step} index={index} onChange={onChange} />
        </>
      )}
      {step.kind === "t" && (
        <NumberField
          label={`Available pool target, step ${index + 1}`}
          kind="percent"
          min={0}
          max={0.4}
          slider={false}
          value={step.target}
          onChange={(target) => onChange({ ...step, target })}
          hint="Tops the unissued pool up to this share of fully diluted shares, outside a priced round."
        />
      )}
      {step.kind === "r" && (
        <>
          <NumberField
            label={`Pre-money, step ${index + 1}`}
            kind="usd"
            min={100_000}
            max={10_000_000_000}
            slider={false}
            value={step.pre}
            onChange={(pre) => onChange({ ...step, pre })}
            hint="Valuation before the new money, with SAFEs and notes converting inside it."
          />
          <NumberField
            label={`New investment, step ${index + 1}`}
            kind="usd"
            min={10_000}
            max={1_000_000_000}
            slider={false}
            value={step.inv}
            onChange={(inv) => onChange({ ...step, inv })}
          />
          <NumberField
            label={`Pool target after the round, step ${index + 1}`}
            kind="percent"
            min={0}
            max={0.4}
            slider={false}
            value={step.pool}
            onChange={(pool) => onChange({ ...step, pool })}
            hint="Zero means no top-up. Otherwise the pool is topped up before the round, in the pre-money."
          />
        </>
      )}
    </li>
  );
}

type Convertible = Extract<StepDraft, { cap: number | null; discount: number }>;

function CapField({
  step,
  index,
  onChange,
}: {
  step: Convertible;
  index: number;
  onChange: (s: StepDraft) => void;
}) {
  const noCap = step.cap === null;
  const isPost = step.kind === "ps";
  return (
    <div className="flex flex-col gap-1.5">
      {!noCap && (
        <NumberField
          label={`${isPost ? "Post-money" : "Pre-money"} cap, step ${index + 1}`}
          kind="usd"
          min={100_000}
          max={10_000_000_000}
          slider={false}
          value={step.cap as number}
          onChange={(cap) => onChange({ ...step, cap })}
        />
      )}
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={noCap}
          onChange={(e) => onChange({ ...step, cap: e.target.checked ? null : 10_000_000 })}
          className="accent-accent"
        />
        No valuation cap (step {index + 1})
      </label>
    </div>
  );
}

function DiscountField({
  step,
  index,
  onChange,
}: {
  step: Convertible;
  index: number;
  onChange: (s: StepDraft) => void;
}) {
  return (
    <NumberField
      label={`Discount, step ${index + 1}`}
      kind="percent"
      min={0}
      max={0.5}
      slider={false}
      value={step.discount}
      onChange={(discount) => onChange({ ...step, discount })}
      hint="Percent off the round price. The holder gets the lower of the cap price and the discounted price. Zero means no discount."
    />
  );
}
