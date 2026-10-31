"use client";

import { useMemo } from "react";
import { parseAsInteger, useQueryStates } from "nuqs";
import { ChartTable } from "@/components/charts/ChartTable";
import { MultipleHistogram } from "@/components/charts/MultipleHistogram";
import { Button } from "@/components/ui/button";
import {
  CalculatorLayout,
  ChartFrame,
  FormulaLine,
  Legend,
  NumberField,
  Stat,
} from "@/components/ui-atlas";
import { POWER_LAW_DEFAULTS as D } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS, matchesDefaults, numberParam } from "@/lib/calculators/url";
import { usePowerLawWorker } from "@/lib/calculators/usePowerLawWorker";
import { formatCount, formatMultiple, formatPercent } from "@/lib/format";
import { CATEGORICAL } from "@/lib/viz";
import type { PowerLawParams } from "@/lib/workers/powerLawProtocol";

const MAX_SEED = 4_294_967_295;

const parsers = {
  pn: parseAsInteger.withDefault(D.pn),
  loss: numberParam(D.loss),
  alpha: numberParam(D.alpha),
  xm: numberParam(D.xm),
  trials: parseAsInteger.withDefault(D.trials),
  seed: parseAsInteger.withDefault(D.seed),
};

export function PowerLawCalculator() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const params = useMemo<PowerLawParams>(
    () => ({ n: v.pn, lossRate: v.loss, alpha: v.alpha, xm: v.xm, trials: v.trials, seed: v.seed }),
    [v.pn, v.loss, v.alpha, v.xm, v.trials, v.seed],
  );
  const { series, running, error } = usePowerLawWorker(params);
  const newSeed = () => void setV({ seed: Math.floor(Math.random() * MAX_SEED) });

  return (
    <CalculatorLayout
      isExample={matchesDefaults(v, D)}
      onReset={() => void setV(null)}
      error={error}
      stale={error !== null && series !== null}
      inputs={
        <>
          <NumberField
            label="Companies in the portfolio"
            kind="count"
            min={1}
            max={200}
            step={1}
            value={v.pn}
            onChange={(pn) => void setV({ pn: Math.round(pn) })}
            hint="Each simulated fund holds this many companies with equal money in each."
          />
          <NumberField
            label="Companies that return nothing"
            kind="percent"
            min={0}
            max={0.95}
            step={0.01}
            value={v.loss}
            onChange={(loss) => void setV({ loss })}
            hint="Share of companies that return zero. The rest draw a multiple from the power-law curve."
          />
          <NumberField
            label="Tail exponent"
            kind="decimal"
            min={1.1}
            max={3}
            step={0.05}
            value={v.alpha}
            onChange={(alpha) => void setV({ alpha })}
            hint="Lower means a fatter tail: a few companies return far more than the rest. Your assumption, not a benchmark."
          />
          <NumberField
            label="Smallest return of a survivor"
            kind="decimal"
            min={0.5}
            max={5}
            step={0.1}
            value={v.xm}
            onChange={(xm) => void setV({ xm })}
            hint="Every company that does not fail returns at least this multiple of the money put in."
          />
          <NumberField
            label="Simulated funds (trials)"
            kind="count"
            min={1_000}
            max={200_000}
            slider="log"
            value={v.trials}
            onChange={(trials) => void setV({ trials: Math.round(trials) })}
            hint="More trials give a smoother histogram and steadier percentiles."
          />
          <div className="flex flex-col gap-1.5">
            <NumberField
              label="Random seed"
              kind="count"
              min={0}
              max={MAX_SEED}
              slider={false}
              value={v.seed}
              onChange={(seed) => void setV({ seed: Math.round(seed) })}
              hint="The same seed and inputs always give the same histogram, in the app and in the tests."
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={newSeed}
              className="self-start"
            >
              Draw a new seed
            </Button>
          </div>
        </>
      }
      how={
        <>
          <p>
            Each trial is one simulated fund. For every company the simulation first decides whether
            it fails (with the loss rate you set). A survivor draws its return from a Pareto curve:
            the multiple is the minimum divided by U to the power 1 over the tail exponent, where U
            is a uniform random number. A fund&apos;s multiple is the average of its companies&apos;
            multiples. The median and 90th percentile are read from all the trials.
          </p>
          <FormulaLine>
            company multiple = 0 with probability loss rate, otherwise minimum ÷ U^(1 ÷ exponent) ·
            fund multiple = average over companies
          </FormulaLine>
          <p>
            The random numbers come from a seeded generator (mulberry32), so a run can be repeated
            exactly from its seed. The run happens in a background worker so the page stays
            responsive; changing an input stops the old run and starts a new one. The inputs are
            your assumptions, not data from any fund. The histogram ends at the 99th percentile; the
            funds beyond it are counted below the chart, not drawn.
          </p>
        </>
      }
    >
      {series ? (
        <>
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-5">
            <Stat label="Median fund" value={formatMultiple(series.median)} />
            <Stat label="90th percentile" value={formatMultiple(series.p90)} />
            <Stat label="Mean fund" value={formatMultiple(series.mean)} />
            <Stat label="Funds at 1× or more" value={formatPercent(series.pAtLeast1x)} />
            <Stat label="Funds at 3× or more" value={formatPercent(series.pAtLeast3x)} />
          </div>
          <ChartFrame
            title="Spread of fund multiples"
            subtitle={`${formatCount(series.trials)} simulated funds, seed ${formatCount(v.seed)}${running ? ". Updating." : "."}`}
            legend={
              <Legend
                kind="categorical"
                items={[{ label: "Simulated funds per multiple range", color: CATEGORICAL[0] }]}
              />
            }
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            computed={`Computed from the inputs on the left, ${formatCount(series.trials)} trials, seed ${formatCount(v.seed)}. ${
              series.aboveCount > 0
                ? `${formatCount(series.aboveCount)} funds above ${formatMultiple(series.domainMax)} are not drawn (the largest is ${formatMultiple(series.max)}).`
                : "Every fund is drawn."
            } Example values are illustrative, not data.`}
            height={320}
            tableAlternative={
              <ChartTable
                caption="Simulated funds by multiple range"
                rows={series.bins}
                rowKey={(b) => String(b.from)}
                columns={[
                  {
                    header: "Fund multiple",
                    numeric: true,
                    cell: (b) => `${formatMultiple(b.from)} to ${formatMultiple(b.to)}`,
                  },
                  { header: "Funds", numeric: true, cell: (b) => formatCount(b.count) },
                  { header: "Share of trials", numeric: true, cell: (b) => formatPercent(b.share) },
                ]}
              />
            }
          >
            <MultipleHistogram series={series} />
          </ChartFrame>
        </>
      ) : (
        <p role="status" className="rounded-xl border border-rule bg-panel p-6 text-sm text-ink-2">
          Running {formatCount(v.trials)} simulated funds.
        </p>
      )}
    </CalculatorLayout>
  );
}
