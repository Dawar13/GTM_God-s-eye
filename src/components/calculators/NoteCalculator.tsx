"use client";

import { useMemo } from "react";
import { parseAsFloat, parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  LabelList,
  ReferenceDot,
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
  Panel,
  Segmented,
  ShareBar,
  Stat,
  VizTooltip,
} from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { startingAmount } from "@/lib/round/seed";
import { useRound } from "@/lib/round/use-round";
import { NOTE_DEFAULTS as D } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS, matchesDefaults, numberParam } from "@/lib/calculators/url";
import { useLastValid } from "@/lib/calculators/useLastValid";
import { noteScenario, type Compounding } from "@/lib/finance";
import { formatCount, formatPercent, formatPricePerShare, formatUsd } from "@/lib/format";
import { CATEGORICAL, markStyle } from "@/lib/viz";
import {
  accruedSeries,
  noteOwnership,
  noteWhy,
  priceComparison,
  type AccruedPoint,
  type PriceBar,
} from "@/lib/viz/transforms/calcNote";

const parsers = {
  // No default: absent means "start from our raise" (src/lib/round/seed.ts).
  amt: parseAsFloat,
  rate: numberParam(D.rate),
  cmp: parseAsStringLiteral(["simple", "annual", "monthly"] as const).withDefault(D.cmp),
  mo: parseAsInteger.withDefault(D.mo),
  cap: numberParam(D.cap),
  nc: parseAsInteger.withDefault(D.nc),
  cb: parseAsStringLiteral(["pre", "post"] as const).withDefault(D.cb),
  disc: numberParam(D.disc),
  rpre: numberParam(D.rpre),
  rinv: numberParam(D.rinv),
  fd: numberParam(D.fd),
};

type Inputs = {
  amt: number;
  rate: number;
  cmp: Compounding;
  mo: number;
  cap: number;
  nc: number;
  cb: "pre" | "post";
  disc: number;
  rpre: number;
  rinv: number;
  fd: number;
};

function compute(i: Inputs) {
  const scenario = noteScenario({
    principal: i.amt,
    rate: i.rate,
    compounding: i.cmp,
    years: i.mo / 12,
    cap: i.nc ? null : i.cap,
    capBasis: i.cb === "pre" ? "pre_money" : "post_money",
    discount: i.disc || null,
    roundPreMoney: i.rpre,
    roundInvestment: i.rinv,
    capitalization: i.fd,
  });
  const series = accruedSeries({
    principal: i.amt,
    rate: i.rate,
    compounding: i.cmp,
    months: i.mo,
  });
  return { scenario, series, hasDiscount: i.disc > 0 };
}

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const LINE = markStyle(CATEGORICAL[0]);
const APPLIED = markStyle(CATEGORICAL[0]);
const OTHER = markStyle("#C4C9D1");
const METHOD_LABEL = {
  cap: "Valuation cap",
  discount: "Discount",
  round_price: "Round price",
} as const;

export function NoteCalculator() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const round = useRound();
  const amt = startingAmount(v.amt, round.raise);
  const inputs = useMemo<Inputs>(
    () => ({
      amt,
      rate: v.rate,
      cmp: v.cmp,
      mo: v.mo,
      cap: v.cap,
      nc: v.nc,
      cb: v.cb,
      disc: v.disc,
      rpre: v.rpre,
      rinv: v.rinv,
      fd: v.fd,
    }),
    [amt, v.rate, v.cmp, v.mo, v.cap, v.nc, v.cb, v.disc, v.rpre, v.rinv, v.fd],
  );
  const { result, error, stale } = useLastValid(inputs, compute);
  const s = result?.scenario;
  const bars = useMemo(
    () => (result ? priceComparison(result.scenario, result.hasDiscount) : []),
    [result],
  );

  return (
    <CalculatorLayout
      isExample={matchesDefaults(inputs, D)}
      onReset={() =>
        void setV({
          rate: null,
          cmp: null,
          mo: null,
          cap: null,
          nc: null,
          cb: null,
          disc: null,
          rpre: null,
          rinv: null,
          fd: null,
          // Written explicitly, so the example stays the example whatever our round is.
          amt: D.amt,
        })
      }
      error={error}
      stale={stale}
      inputs={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => void setV({ amt: round.raise })}
            disabled={amt === round.raise}
          >
            Use our round
          </Button>
          <NumberField
            label="Note amount"
            kind="usd"
            min={10_000}
            max={50_000_000}
            slider="log"
            value={amt}
            onChange={(amt) => void setV({ amt })}
            hint="The principal the note holder lent. Interest accrues on this until the note converts. Without an amount in the link this starts from our raise (top bar); the example is $500K."
          />
          <NumberField
            label="Interest rate"
            kind="percent"
            min={0}
            max={0.3}
            step={0.005}
            value={v.rate}
            onChange={(rate) => void setV({ rate })}
            hint="Annual rate. Many notes use 2% to 8%; the example is an assumption, not data."
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Interest type</span>
            <Segmented
              label="Interest type"
              value={v.cmp}
              onChange={(cmp) => void setV({ cmp })}
              options={[
                { value: "simple", label: "Simple" },
                { value: "annual", label: "Yearly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
          </div>
          <NumberField
            label="Months until the round"
            kind="count"
            min={0}
            max={60}
            step={1}
            value={v.mo}
            onChange={(mo) => void setV({ mo: Math.round(mo) })}
            hint="Time from signing the note to the priced round that converts it. Interest runs on a 30/360 year."
          />
          {!v.nc && (
            <>
              <NumberField
                label="Valuation cap"
                kind="usd"
                min={100_000}
                max={10_000_000_000}
                slider="log"
                value={v.cap}
                onChange={(cap) => void setV({ cap })}
                hint="The highest valuation the note converts at. A lower cap gives the holder a lower price."
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Cap type</span>
                <Segmented
                  label="Cap type"
                  value={v.cb}
                  onChange={(cb) => void setV({ cb })}
                  options={[
                    { value: "pre", label: "Pre-money" },
                    { value: "post", label: "Post-money" },
                  ]}
                />
              </div>
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={v.nc === 1}
              onChange={(e) => void setV({ nc: e.target.checked ? 1 : 0 })}
              className="accent-accent"
            />
            No valuation cap
          </label>
          <NumberField
            label="Discount"
            kind="percent"
            min={0}
            max={0.5}
            step={0.005}
            value={v.disc}
            onChange={(disc) => void setV({ disc })}
            hint="Percent off the round price. The holder gets the lower of the cap price and the discounted price. Zero means no discount."
          />
          <h3 className="pt-2 text-sm font-semibold">Priced round that converts it</h3>
          <NumberField
            label="Round pre-money"
            kind="usd"
            min={100_000}
            max={10_000_000_000}
            slider="log"
            value={v.rpre}
            onChange={(rpre) => void setV({ rpre })}
          />
          <NumberField
            label="Round investment"
            kind="usd"
            min={10_000}
            max={1_000_000_000}
            slider="log"
            value={v.rinv}
            onChange={(rinv) => void setV({ rinv })}
          />
          <NumberField
            label="Shares before the round"
            kind="count"
            min={100_000}
            max={1_000_000_000}
            slider="log"
            value={v.fd}
            onChange={(fd) => void setV({ fd })}
            hint="Fully diluted shares before the note converts. The round price is the pre-money divided by this."
          />
        </>
      }
      how={
        <>
          <p>
            The note is a loan that turns into shares. Its value grows with interest until the
            priced round, then the whole amount (principal plus interest) converts at the lower of
            two prices: the cap price, the pre-money cap divided by the shares before the round (a
            post-money cap is the stake accrued ÷ cap of the shares after conversion), and the round
            price less the discount. Interest here is simple by default, which is how most notes are
            written; yearly and monthly compounding are there to compare. The note is converted on
            top of the pre-money shares, so it dilutes the new investors too.
          </p>
          <FormulaLine>
            simple: value = principal × (1 + rate × years) · yearly: principal × (1 + rate)^years ·
            monthly: principal × (1 + rate ÷ 12)^(12 × years)
          </FormulaLine>
          <FormulaLine>
            price = lower of (cap ÷ shares before) and (round price × (1 − discount)) · shares =
            accrued value ÷ price
          </FormulaLine>
          {result && s && (
            <div className="flex flex-col gap-2">
              <p className="font-medium text-ink">Worked example, with the current inputs</p>
              <FormulaLine>
                Accrued value: {formatUsd(amt)} + {formatUsd(s.interest)} interest ={" "}
                {formatUsd(s.accrued)} after {v.mo} months
              </FormulaLine>
              <FormulaLine>
                Round price: {formatUsd(v.rpre)} ÷ {formatCount(v.fd)} shares ={" "}
                {formatPricePerShare(s.roundPrice)}
              </FormulaLine>
              <FormulaLine>
                Converts at {formatPricePerShare(s.conversion.conversionPrice)} (
                {METHOD_LABEL[s.conversion.method].toLowerCase()}): {formatUsd(s.accrued)} ÷{" "}
                {formatPricePerShare(s.conversion.conversionPrice)} ={" "}
                {formatCount(s.conversion.shares)} shares
              </FormulaLine>
              <FormulaLine>
                Note holder: {formatCount(s.conversion.shares)} ÷ {formatCount(s.totalShares)} ={" "}
                {formatPercent(s.ownership.note)} of the company after the round
              </FormulaLine>
            </div>
          )}
        </>
      }
    >
      {result && s && (
        <>
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-4">
            <Stat label="Converts at" value={formatPricePerShare(s.conversion.conversionPrice)} />
            <Stat label="Applied" value={METHOD_LABEL[s.conversion.method]} />
            <Stat label="Value at conversion" value={formatUsd(s.accrued)} />
            <Stat label="Note holder owns" value={formatPercent(s.ownership.note)} />
          </div>
          <Accrual series={result.series} rate={v.rate} cmp={v.cmp} />
          <ChartFrame
            title="Which price applies"
            subtitle="Price per share the note could convert at. It takes the lowest bar; the filled bar wins."
            legend={
              <Legend
                kind="categorical"
                items={[
                  { label: "Price the note converts at", color: CATEGORICAL[0] },
                  { label: "Other prices", color: "#C4C9D1" },
                ]}
              />
            }
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            computed="Computed from the inputs on the left. Example values are illustrative, not data."
            height={240}
            tableAlternative={
              <ChartTable
                caption="Conversion prices"
                rows={bars}
                rowKey={(b) => b.key}
                columns={[
                  { header: "Price", cell: (b) => b.label },
                  { header: "Per share", numeric: true, cell: (b) => formatPricePerShare(b.price) },
                  { header: "Applies", cell: (b) => (b.applies ? "Yes" : "No") },
                ]}
              />
            }
          >
            <div className="flex flex-col gap-2">
              <PriceBars bars={bars} />
              <p className="text-sm text-ink">{noteWhy(s, result.hasDiscount)}</p>
              {v.nc === 1 && (
                <p className="text-sm text-ink-2">No cap is set, so there is no cap bar.</p>
              )}
            </div>
          </ChartFrame>
          <ChartFrame
            title="Ownership after the round"
            subtitle="One bar, 100% of fully diluted shares after the note converts and the new money comes in."
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            computed="Computed from the inputs on the left. Example values are illustrative, not data."
            height={120}
            tableAlternative={
              <ChartTable
                caption="Ownership after the round"
                rows={noteOwnership(s)}
                rowKey={(r) => r.key}
                columns={[
                  { header: "Holder", cell: (r) => r.label },
                  { header: "Ownership", numeric: true, cell: (r) => formatPercent(r.fraction) },
                ]}
              />
            }
          >
            <ShareBar segments={noteOwnership(s)} ariaLabel="Ownership after the round" />
          </ChartFrame>
          <Panel className="text-sm text-ink-2">
            Interest here is{" "}
            {v.cmp === "simple"
              ? "simple"
              : v.cmp === "annual"
                ? "compounded yearly"
                : "compounded monthly"}
            . Real notes differ, and some pay the interest in cash instead of converting it, so
            check the note.
          </Panel>
        </>
      )}
    </CalculatorLayout>
  );
}

function Accrual({
  series,
  rate,
  cmp,
}: {
  series: AccruedPoint[];
  rate: number;
  cmp: Compounding;
}) {
  const first = series[0] as AccruedPoint;
  const last = series[series.length - 1] as AccruedPoint;
  return (
    <ChartFrame
      title="Note value over time"
      subtitle="Principal plus accrued interest each month. The vertical axis starts at the principal, not zero, so the growth is visible."
      legend={
        <Legend
          kind="categorical"
          items={[{ label: `Note value at ${formatPercent(rate)} ${cmp}`, color: CATEGORICAL[0] }]}
        />
      }
      sources={[]}
      notShown={{ count: 0, field: "none" }}
      computed="Computed from the inputs on the left. Example values are illustrative, not data."
      height={280}
      tableAlternative={
        <ChartTable
          caption="Note value by month"
          rows={series}
          rowKey={(p) => String(p.month)}
          columns={[
            { header: "Month", numeric: true, cell: (p) => String(p.month) },
            { header: "Interest so far", numeric: true, cell: (p) => formatUsd(p.interest) },
            { header: "Note value", numeric: true, cell: (p) => formatUsd(p.value) },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={series} margin={{ top: 28, right: 24, bottom: 24, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rule)" />
          <XAxis
            dataKey="month"
            type="number"
            domain={[0, Math.max(1, last.month)]}
            allowDecimals={false}
            tick={TICK}
            axisLine={{ stroke: "var(--rule)" }}
            tickLine={false}
            label={{
              value: "Months since signing",
              position: "insideBottom",
              offset: -12,
              fontSize: 12,
              fill: "var(--ink-2)",
            }}
          />
          <YAxis
            domain={[first.value, (max: number) => (max <= first.value ? first.value * 1.05 : max)]}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(n: number) => formatUsd(n)}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
            content={(p) => {
              const pt = p.active
                ? (p.payload?.[0]?.payload as AccruedPoint | undefined)
                : undefined;
              if (!pt) return null;
              return (
                <VizTooltip
                  title={`Month ${pt.month}`}
                  value={formatUsd(pt.value)}
                  confidence={null}
                  sourceDomain={null}
                  computed
                >
                  <p className="tabular-nums">Interest so far: {formatUsd(pt.interest)}</p>
                </VizTooltip>
              );
            }}
          />
          <ReferenceLine
            x={last.month}
            stroke="var(--muted)"
            strokeDasharray="4 3"
            label={{
              value: "Converts at the round",
              position: "top",
              fontSize: 12,
              fill: "var(--ink-2)",
            }}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke={LINE.stroke}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={last.month}
            y={last.value}
            r={5}
            fill={LINE.fill}
            stroke={LINE.stroke}
            label={{
              value: formatUsd(last.value),
              position: "left",
              fontSize: 13,
              fill: "var(--ink)",
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function PriceBars({ bars }: { bars: PriceBar[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--rule)" />
        <XAxis
          type="number"
          domain={[0, "auto"]}
          tick={TICK}
          axisLine={{ stroke: "var(--rule)" }}
          tickLine={false}
          tickFormatter={(n: number) => formatPricePerShare(n)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 13, fill: "var(--ink)" }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip
          cursor={{ fill: "var(--accent-soft)" }}
          content={(p) => {
            const b = p.active ? (p.payload?.[0]?.payload as PriceBar | undefined) : undefined;
            if (!b) return null;
            return (
              <VizTooltip
                title={b.label}
                value={formatPricePerShare(b.price)}
                confidence={null}
                sourceDomain={null}
                computed
              >
                <p>{b.applies ? "The note converts at this price." : "Not the lowest price."}</p>
              </VizTooltip>
            );
          }}
        />
        <Bar dataKey="price" isAnimationActive={false} barSize={26}>
          {bars.map((b) => {
            const m = b.applies ? APPLIED : OTHER;
            return <Cell key={b.key} fill={m.fill} stroke={m.stroke} />;
          })}
          <LabelList
            dataKey="price"
            position="right"
            formatter={(n: unknown) => formatPricePerShare(Number(n))}
            style={{ fontSize: 13, fill: "var(--ink)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
