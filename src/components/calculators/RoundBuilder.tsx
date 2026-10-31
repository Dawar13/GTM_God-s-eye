"use client";

import { useMemo } from "react";
import { parseAsStringLiteral, useQueryStates } from "nuqs";
import { ChartTable } from "@/components/charts/ChartTable";
import {
  CalculatorLayout,
  ChartFrame,
  FormulaLine,
  NumberField,
  Segmented,
  ShareBar,
  Stat,
} from "@/components/ui-atlas";
import { ROUND_BUILDER_DEFAULTS as D } from "@/lib/calculators/examples";
import { CALC_URL_OPTIONS, matchesDefaults, numberParam } from "@/lib/calculators/url";
import { useLastValid } from "@/lib/calculators/useLastValid";
import { CAP_TABLE_ROUNDING, pricedRound } from "@/lib/finance";
import { formatCount, formatPercent, formatPricePerShare, formatUsd } from "@/lib/format";
import { roundOwnership } from "@/lib/viz/transforms/calcOwnership";

const parsers = {
  mode: parseAsStringLiteral(["pre", "post"] as const).withDefault(D.mode),
  val: numberParam(D.val),
  inv: numberParam(D.inv),
  fd: numberParam(D.fd),
};

type Inputs = { mode: "pre" | "post"; val: number; inv: number; fd: number };

function compute(i: Inputs) {
  return pricedRound({
    ...(i.mode === "pre" ? { preMoney: i.val } : { postMoney: i.val }),
    investment: i.inv,
    preMoneyFDShares: i.fd,
    rounding: CAP_TABLE_ROUNDING,
  });
}

export function RoundBuilder() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const inputs = useMemo<Inputs>(
    () => ({ mode: v.mode, val: v.val, inv: v.inv, fd: v.fd }),
    [v.mode, v.val, v.inv, v.fd],
  );
  const { result, error, stale } = useLastValid(inputs, compute);
  const own = useMemo(() => (result ? roundOwnership(result) : null), [result]);

  /** Switching the toggle keeps the same round: the valuation field shows the other figure. */
  function switchMode(mode: "pre" | "post") {
    if (mode === v.mode) return;
    const converted = result ? (mode === "pre" ? result.preMoney : result.postMoney) : v.val;
    void setV({ mode, val: converted });
  }

  const valLabel = v.mode === "pre" ? "Pre-money valuation" : "Post-money valuation";

  return (
    <CalculatorLayout
      isExample={matchesDefaults(inputs, D)}
      onReset={() => void setV(null)}
      error={error}
      stale={stale}
      inputs={
        <>
          <div className="flex flex-col gap-1.5">
            <span id="valuation-basis" className="text-sm font-medium">
              Valuation basis
            </span>
            <Segmented
              label="Valuation basis"
              value={v.mode}
              onChange={switchMode}
              options={[
                { value: "pre", label: "Pre-money" },
                { value: "post", label: "Post-money" },
              ]}
            />
          </div>
          <NumberField
            label={valLabel}
            kind="usd"
            min={100_000}
            max={10_000_000_000}
            slider="log"
            value={v.val}
            onChange={(val) => void setV({ val })}
            hint="Pre-money is what the company is worth before the new money; post-money adds the new money. Switching the toggle converts the figure, so the round stays the same."
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
            label="Fully diluted shares before the round"
            kind="count"
            min={100_000}
            max={1_000_000_000}
            slider="log"
            value={v.fd}
            onChange={(fd) => void setV({ fd })}
            hint="Every share that exists today: common, issued options, the unissued pool and anything that converts. The round price is the pre-money divided by this."
          />
        </>
      }
      how={
        <>
          <p>
            Post-money is pre-money plus the new money. The price per share is the pre-money divided
            by the fully diluted shares before the round, rounded to four decimals as cap tables do.
            New investors buy investment ÷ price shares (whole shares, rounded down), and their
            ownership is those shares over all shares after the round.
          </p>
          <FormulaLine>
            post = pre + investment · price = pre ÷ shares before · new shares = investment ÷ price
          </FormulaLine>
          {result && (
            <>
              <p className="font-medium text-ink">Worked example with the current inputs</p>
              <FormulaLine>
                Post-money: {formatUsd(result.preMoney)} + {formatUsd(inputs.inv)} ={" "}
                {formatUsd(result.postMoney)}
              </FormulaLine>
              <FormulaLine>
                Price per share: {formatUsd(result.preMoney)} ÷ {formatCount(inputs.fd)} ={" "}
                {formatPricePerShare(result.pricePerShare)}
              </FormulaLine>
              <FormulaLine>
                New shares: {formatUsd(inputs.inv)} ÷ {formatPricePerShare(result.pricePerShare)} ={" "}
                {formatCount(result.newShares)}
              </FormulaLine>
              <FormulaLine>
                New investors own {formatCount(result.newShares)} ÷{" "}
                {formatCount(result.postMoneyFDShares)} ={" "}
                {formatPercent(result.ownership.newInvestors)}
              </FormulaLine>
            </>
          )}
        </>
      }
    >
      {result && own && (
        <>
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-4">
            <Stat label="Price per share" value={formatPricePerShare(result.pricePerShare)} />
            <Stat label="Pre-money" value={formatUsd(result.preMoney)} />
            <Stat label="Post-money" value={formatUsd(result.postMoney)} />
            <Stat label="New shares issued" value={formatCount(result.newShares)} />
          </div>
          <ChartFrame
            title="Ownership after the round"
            subtitle="One bar, 100% of the fully diluted shares after the round."
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
