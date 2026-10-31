"use client";

import { useMemo } from "react";
import { parseAsFloat, parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs";
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
  Panel,
  Segmented,
  ShareBar,
  Stat,
  VizTooltip,
} from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { safeTabFor } from "@/lib/round";
import { startingAmount, startingSafeTab } from "@/lib/round/seed";
import { useRound } from "@/lib/round/use-round";
import { SAFE_DEFAULTS as D } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS, matchesDefaults, numberParam } from "@/lib/calculators/url";
import { useLastValid } from "@/lib/calculators/useLastValid";
import { CAP_TABLE_ROUNDING, compareSafes, type SafeScenario } from "@/lib/finance";
import {
  formatCount,
  formatPercent,
  formatPoints,
  formatPricePerShare,
  formatUsd,
} from "@/lib/format";
import { CATEGORICAL, markStyle } from "@/lib/viz";
import {
  conversionRow,
  dilutionWaterfall,
  safeOwnership,
  type WaterfallBar,
} from "@/lib/viz/transforms/calcSafe";

const parsers = {
  // No defaults for these two: absent means "start from our round" (src/lib/round/seed.ts).
  st: parseAsStringLiteral(["post", "pre", "both"] as const),
  amt: parseAsFloat,
  cap: numberParam(D.cap),
  nc: parseAsInteger.withDefault(D.nc),
  disc: numberParam(D.disc),
  rpre: numberParam(D.rpre),
  rinv: numberParam(D.rinv),
  fsh: numberParam(D.fsh),
  pool: numberParam(D.pool),
  ptgt: numberParam(D.ptgt),
};

type Inputs = {
  amt: number;
  cap: number;
  nc: number;
  disc: number;
  rpre: number;
  rinv: number;
  fsh: number;
  pool: number;
  ptgt: number;
};

function compute(i: Inputs) {
  return compareSafes({
    founderShares: i.fsh,
    existingPool: i.pool,
    safeAmount: i.amt,
    cap: i.nc ? null : i.cap,
    discount: i.disc || null,
    roundPreMoney: i.rpre,
    roundInvestment: i.rinv,
    poolTargetPostPct: i.ptgt || null,
    rounding: CAP_TABLE_ROUNDING,
  });
}

const TICK = { fontSize: 12, fill: "var(--muted)" } as const;
const TOTAL = markStyle(CATEGORICAL[0]);
const DROP = markStyle(CATEGORICAL[3]);

const KIND_LABEL = { post_money: "Post-money cap", pre_money: "Pre-money cap" } as const;

export function SafeCalculator() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const round = useRound();
  const st = startingSafeTab(v.st, round.inst);
  const amt = startingAmount(v.amt, round.raise);
  const ourTab = safeTabFor(round.inst);
  const inputs = useMemo<Inputs>(
    () => ({
      amt,
      cap: v.cap,
      nc: v.nc,
      disc: v.disc,
      rpre: v.rpre,
      rinv: v.rinv,
      fsh: v.fsh,
      pool: v.pool,
      ptgt: v.ptgt,
    }),
    [amt, v.cap, v.nc, v.disc, v.rpre, v.rinv, v.fsh, v.pool, v.ptgt],
  );
  const { result, error, stale } = useLastValid(inputs, compute);

  const scenarios: SafeScenario[] = result
    ? st === "both"
      ? [result.post, result.pre]
      : [st === "post" ? result.post : result.pre]
    : [];
  const main = scenarios[0];

  const conversionTable = (
    <ChartTable
      caption="SAFE conversion at the priced round"
      rows={scenarios.map(conversionRow)}
      rowKey={(r) => r.kind}
      columns={[
        { header: "Cap type", cell: (r) => KIND_LABEL[r.kind] },
        { header: "Amount", numeric: true, cell: (r) => formatUsd(r.amount) },
        { header: "Converts at", numeric: true, cell: (r) => formatPricePerShare(r.price) },
        { header: "Basis", cell: (r) => r.method },
        { header: "Shares", numeric: true, cell: (r) => formatCount(r.shares) },
        { header: "Ownership", numeric: true, cell: (r) => formatPercent(r.ownership) },
      ]}
    />
  );

  return (
    <CalculatorLayout
      isExample={matchesDefaults({ ...inputs, st }, D)}
      onReset={() =>
        void setV({
          cap: null,
          nc: null,
          disc: null,
          rpre: null,
          rinv: null,
          fsh: null,
          pool: null,
          ptgt: null,
          // Written explicitly, so the example stays the example whatever our round is.
          st: D.st,
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
            onClick={() => void setV({ amt: round.raise, ...(ourTab ? { st: ourTab } : {}) })}
            disabled={amt === round.raise && (ourTab === null || st === ourTab)}
          >
            Use our round
          </Button>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">SAFE type</span>
            <Segmented
              label="SAFE type"
              value={st}
              onChange={(st) => void setV({ st })}
              options={[
                { value: "post", label: "Post-money" },
                { value: "pre", label: "Pre-money" },
                { value: "both", label: "Compare both" },
              ]}
            />
          </div>
          <NumberField
            label="SAFE amount"
            kind="usd"
            min={10_000}
            max={100_000_000}
            slider="log"
            value={amt}
            onChange={(amt) => void setV({ amt })}
            hint="Money the SAFE holder pays now. Without an amount in the link this starts from our round (top bar); the example is $1.0M."
          />
          {!v.nc && (
            <NumberField
              label="Valuation cap"
              kind="usd"
              min={100_000}
              max={10_000_000_000}
              slider="log"
              value={v.cap}
              onChange={(cap) => void setV({ cap })}
              hint="Read as a post-money cap on the post-money tab and a pre-money cap on the pre-money tab; compare both reads the same number each way."
            />
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
            label="Pool target after the round"
            kind="percent"
            min={0}
            max={0.4}
            step={0.005}
            value={v.ptgt}
            onChange={(ptgt) => void setV({ ptgt })}
            hint="Zero means no pool top-up. Otherwise the pool is topped up in the pre-money, which also dilutes the SAFE on a pre-money cap."
          />
          <NumberField
            label="Founder shares"
            kind="count"
            min={100_000}
            max={1_000_000_000}
            slider="log"
            value={v.fsh}
            onChange={(fsh) => void setV({ fsh })}
          />
          <NumberField
            label="Existing unissued pool"
            kind="count"
            min={0}
            max={500_000_000}
            step={10_000}
            value={v.pool}
            onChange={(pool) => void setV({ pool })}
          />
        </>
      }
      how={
        <>
          <p>
            A post-money SAFE owns amount ÷ cap of the company capitalization, which already
            includes every SAFE, so the holder&apos;s stake is fixed whatever else converts. A
            pre-money SAFE sets its price against the shares before the SAFEs and the new money, so
            other SAFEs and the pool top-up dilute it too. The holder takes the lower of the cap
            price and the discounted round price. Prices round to four decimals, shares down to
            whole shares.
          </p>
          <FormulaLine>
            post-money: price = cap ÷ company capitalization · pre-money: price = cap ÷ (shares
            before + pool top-up) · shares = amount ÷ price
          </FormulaLine>
          {result &&
            scenarios.map((s) => (
              <div key={s.kind} className="flex flex-col gap-2">
                <p className="font-medium text-ink">
                  Worked example, {KIND_LABEL[s.kind].toLowerCase()}, with the current inputs
                </p>
                <FormulaLine>
                  SAFE price: {formatPricePerShare(s.conversion.price)} (
                  {conversionRow(s).method.toLowerCase()}) · round price:{" "}
                  {formatPricePerShare(s.financing.pricePerShare)}
                </FormulaLine>
                <FormulaLine>
                  SAFE shares: {formatUsd(s.conversion.amount)} ÷{" "}
                  {formatPricePerShare(s.conversion.price)} = {formatCount(s.conversion.shares)}
                </FormulaLine>
                <FormulaLine>
                  SAFE ownership: {formatCount(s.conversion.shares)} ÷{" "}
                  {formatCount(s.financing.totalFD)} = {formatPercent(s.ownership.safe)}
                </FormulaLine>
                <FormulaLine>
                  Founders: {formatPercent(s.dilution.start)} before,{" "}
                  {formatPercent(s.dilution.afterSafe)} after the SAFE,{" "}
                  {formatPercent(s.dilution.afterPool)} after the pool,{" "}
                  {formatPercent(s.dilution.afterNewMoney)} after new money
                </FormulaLine>
              </div>
            ))}
        </>
      }
    >
      {result && main && (
        <>
          {st !== "both" ? (
            <>
              <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-4">
                <Stat label="SAFE converts at" value={formatPricePerShare(main.conversion.price)} />
                <Stat label="SAFE holder owns" value={formatPercent(main.ownership.safe)} />
                <Stat label="Founders own" value={formatPercent(main.ownership.founders)} />
                <Stat
                  label="Round price"
                  value={formatPricePerShare(main.financing.pricePerShare)}
                />
              </div>
              <ChartFrame
                title="Ownership after the round"
                subtitle={`${KIND_LABEL[main.kind]}: one bar, 100% of fully diluted shares.`}
                sources={[]}
                notShown={{ count: 0, field: "none" }}
                computed="Computed from the inputs on the left. Example values are illustrative, not data."
                height={120}
                tableAlternative={conversionTable}
              >
                <ShareBar
                  segments={safeOwnership(main)}
                  ariaLabel={`Ownership after the round, ${KIND_LABEL[main.kind].toLowerCase()}`}
                />
              </ChartFrame>
              <Waterfall scenario={main} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-4">
                <Stat
                  label="Founders, post-money cap"
                  value={formatPercent(result.post.ownership.founders)}
                />
                <Stat
                  label="Founders, pre-money cap"
                  value={formatPercent(result.pre.ownership.founders)}
                />
                <Stat
                  label="Founders, post minus pre"
                  value={formatPoints(result.difference.founders)}
                />
                <Stat
                  label="SAFE holder, post minus pre"
                  value={formatPoints(result.difference.safe)}
                />
              </div>
              <ChartFrame
                title="Same terms, read both ways"
                subtitle="Each bar is 100% of fully diluted shares after the round."
                sources={[]}
                notShown={{ count: 0, field: "none" }}
                computed="Computed from the inputs on the left. Example values are illustrative, not data."
                height={240}
                tableAlternative={conversionTable}
              >
                <div className="flex flex-col gap-5">
                  {[result.post, result.pre].map((s) => (
                    <div key={s.kind}>
                      <p className="mb-1 text-sm font-medium">{KIND_LABEL[s.kind]}</p>
                      <ShareBar
                        segments={safeOwnership(s)}
                        ariaLabel={`Ownership after the round, ${KIND_LABEL[s.kind].toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
              </ChartFrame>
              <Waterfall scenario={result.post} />
              <Waterfall scenario={result.pre} />
            </>
          )}
          <Panel className="flex flex-col gap-3">
            <div>
              <h3 className="text-lg font-semibold">Conversion table</h3>
              <p className="text-sm text-ink-2">What the SAFE turns into at the priced round.</p>
            </div>
            {conversionTable}
          </Panel>
        </>
      )}
    </CalculatorLayout>
  );
}

function Waterfall({ scenario }: { scenario: SafeScenario }) {
  const bars = useMemo(() => dilutionWaterfall(scenario.dilution), [scenario.dilution]);
  const label = KIND_LABEL[scenario.kind];
  return (
    <ChartFrame
      title={`Founder dilution, ${label.toLowerCase()}`}
      subtitle="Founder ownership at the start, each drop, and the end. Drops float between two totals."
      legend={
        <Legend
          kind="categorical"
          items={[
            { label: "Founder ownership", color: CATEGORICAL[0] },
            { label: "Drop from the step", color: CATEGORICAL[3] },
          ]}
        />
      }
      sources={[]}
      notShown={{ count: 0, field: "none" }}
      computed="Computed from the inputs on the left. Example values are illustrative, not data."
      height={260}
      tableAlternative={
        <ChartTable
          caption={`Founder dilution, ${label.toLowerCase()}`}
          rows={bars}
          rowKey={(b) => b.key}
          columns={[
            { header: "Step", cell: (b) => b.label },
            {
              header: "Change",
              numeric: true,
              cell: (b) => (b.change === null ? "—" : formatPoints(b.change)),
            },
            { header: "Founders after", numeric: true, cell: (b) => formatPercent(b.after) },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={bars} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
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
              const b = p.active
                ? (p.payload?.[0]?.payload as WaterfallBar | undefined)
                : undefined;
              if (!b) return null;
              return (
                <VizTooltip
                  title={b.label}
                  value={b.change === null ? formatPercent(b.after) : formatPoints(b.change)}
                  confidence={null}
                  sourceDomain={null}
                  computed
                >
                  <p className="tabular-nums">Founders after: {formatPercent(b.after)}</p>
                </VizTooltip>
              );
            }}
          />
          <Bar
            dataKey="base"
            stackId="w"
            fill="transparent"
            stroke="none"
            isAnimationActive={false}
          />
          <Bar dataKey="value" stackId="w" isAnimationActive={false}>
            {bars.map((b) => {
              const m = b.kind === "total" ? TOTAL : DROP;
              return <Cell key={b.key} fill={m.fill} stroke={m.stroke} />;
            })}
            <LabelList
              dataKey="label"
              position="top"
              content={(p) => {
                const { x, y, width, value } = p as unknown as {
                  x: number;
                  y: number;
                  width: number;
                  value: string;
                };
                // Look the bar up by label: Recharts skips zero-height bars, so an index would drift.
                const b = bars.find((bar) => bar.label === value);
                if (!b) return null;
                const text = b.change === null ? formatPercent(b.after) : formatPoints(b.change);
                return (
                  <text
                    x={x + width / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={13}
                    fill="var(--ink)"
                    className="tabular-nums"
                  >
                    {text}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
