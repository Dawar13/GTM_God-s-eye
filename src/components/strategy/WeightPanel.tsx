"use client";

import { Button } from "@/components/ui/button";
import { NumberField, Panel } from "@/components/ui-atlas";
import { isDefaultWeights, WEIGHT_TOTAL } from "@/lib/fit/weights";
import type { FitWeights } from "@/lib/fit/score";
import { formatUsd } from "@/lib/format";
import { EXAMPLE_RAISE_USD } from "@/lib/calculators/examples";
import { RAISE_MAX_USD, RAISE_MIN_USD } from "@/lib/strategy/url";
import { FIT_FEATURE_LABELS } from "@/lib/viz/transforms/fitBreakdown";
import { fitFeatureColor } from "@/lib/viz/transforms/strategy";
import { FIT_FEATURE_ORDER } from "@/lib/viz/transforms/topByFit";
import { markStyle } from "@/lib/viz";

const FEATURE_HELP: Record<(typeof FIT_FEATURE_ORDER)[number], string> = {
  thesis: "Industrial affinity plus half the AI weight",
  stage: "How early they invest, against our pre-seed",
  check: "Whether our raise sits inside their check range; leads score higher",
  adjacency: "Portfolio companies in our layers or the ones next to them",
  geography: "Western, or backs Indian founders",
  dry_powder: "Fresh fund, sized for a pre-seed round",
};

/** The six fit weights (always summing to 100) and our raise size, which feeds the check feature. */
export function WeightPanel({
  weights,
  onWeight,
  onReset,
  raiseUsd,
  onRaise,
}: {
  weights: FitWeights;
  onWeight: (name: (typeof FIT_FEATURE_ORDER)[number], value: number) => void;
  onReset: () => void;
  raiseUsd: number;
  onRaise: (value: number) => void;
}) {
  const atDefaults = isDefaultWeights(weights) && raiseUsd === EXAMPLE_RAISE_USD;
  return (
    <Panel className="flex flex-col gap-4" aria-labelledby="weights-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="weights-title" className="text-lg font-semibold">
            Fit weights and our raise
          </h3>
          <p className="text-sm text-ink-2">
            Drag a weight and the others share what is left, so the six always add to{" "}
            <span className="tabular-nums">{WEIGHT_TOTAL}</span>. The ranking below updates as you
            drag, and the link keeps your weighting.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset} disabled={atDefaults}>
          Reset to defaults
        </Button>
      </header>
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {FIT_FEATURE_ORDER.map((n) => {
          const m = markStyle(fitFeatureColor(n));
          const id = `weight-${n}`;
          return (
            <div key={n} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
                  <svg width="10" height="10" aria-hidden>
                    <rect x="0.5" y="0.5" width="9" height="9" rx="2" fill={m.fill} stroke={m.stroke} />
                  </svg>
                  {FIT_FEATURE_LABELS[n]}
                </label>
                <output htmlFor={id} className="text-sm tabular-nums">
                  {weights[n]}
                </output>
              </div>
              <input
                id={id}
                type="range"
                min={0}
                max={WEIGHT_TOTAL}
                step={1}
                value={weights[n]}
                onChange={(e) => onWeight(n, Number(e.target.value))}
                aria-describedby={`${id}-help`}
                aria-valuetext={`${weights[n]} of ${WEIGHT_TOTAL}`}
                className="h-4 w-full cursor-pointer accent-accent"
              />
              <p id={`${id}-help`} className="text-xs text-muted">
                {FEATURE_HELP[n]}
              </p>
            </div>
          );
        })}
      </div>
      <div className="max-w-sm border-t border-rule pt-4">
        <NumberField
          label="Our raise"
          kind="usd"
          value={raiseUsd}
          onChange={onRaise}
          min={RAISE_MIN_USD}
          max={RAISE_MAX_USD}
          slider="log"
          hint={
            <>
              The check size fit compares this with each investor&apos;s check range. The pipeline
              assumed {formatUsd(EXAMPLE_RAISE_USD)} (a post-money SAFE); the other five features
              do not depend on it.
            </>
          }
        />
      </div>
    </Panel>
  );
}
