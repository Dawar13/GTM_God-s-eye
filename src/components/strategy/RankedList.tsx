"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { ChartTable } from "@/components/charts/ChartTable";
import { ChartFrame, ContributionBar, HoverTip, Legend, VizTooltip } from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import type { FitWeights } from "@/lib/fit/score";
import { formatCount, formatPercent } from "@/lib/format";
import { FIT_FEATURE_LABELS } from "@/lib/viz/transforms/fitBreakdown";
import {
  breakdownOf,
  effectiveTier,
  fitFeatureColor,
  type OutreachTier,
  type Ranked,
  type TierOverrides,
} from "@/lib/viz/transforms/strategy";
import { FIT_FEATURE_ORDER } from "@/lib/viz/transforms/topByFit";
import { useInspector } from "@/lib/hooks/useInspector";
import { cn } from "@/lib/utils";

const PAGE = 50;

export function FlagChips({
  row,
}: {
  row: Ranked["row"];
}) {
  return (
    <>
      {row.flags.includes("conflict") && (
        <span className="rounded-md bg-negative/10 px-1.5 py-0.5 text-xs text-negative">
          Conflict
        </span>
      )}
      {row.flags.includes("sparse") && (
        <span className="rounded-md bg-panel-sunk px-1.5 py-0.5 text-xs text-ink-2">Sparse</span>
      )}
      {row.freshness === "fresh" && (
        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs text-ink">Fresh fund</span>
      )}
    </>
  );
}

export function TierChip({ tier, manual }: { tier: OutreachTier; manual: boolean }) {
  return (
    <span className="rounded-md border border-rule px-1.5 py-0.5 text-xs text-ink-2">
      Tier {tier}
      {manual && <span className="ml-1 text-ink">manual</span>}
    </span>
  );
}

/**
 * The ranked target list: best fit first, reliable scores before sparse ones (the Directory's
 * order). Rows reorder with a 220 ms layout animation (instant under reduced motion, via the
 * app's MotionConfig). Each row's bar is the fit score split by feature, on one 0-100 scale.
 */
export function RankedList({
  ranked,
  weights,
  raiseUsd,
  overrides,
  sources,
  unscored,
  filteredOut,
  onExport,
  loading = false,
}: {
  ranked: readonly Ranked[];
  weights: FitWeights;
  raiseUsd: number;
  overrides: TierOverrides;
  sources: readonly string[];
  /** Investors passing the filters that have no fit record. */
  unscored: number;
  filteredOut: number;
  onExport: () => void;
  /** The rows are still loading: the frame, legend and note show, the list is a placeholder. */
  loading?: boolean;
}) {
  const { open } = useInspector();
  const [limit, setLimit] = useState(PAGE);
  const visible = ranked.slice(0, limit);
  const reliable = ranked.filter((r) => r.reliable).length;

  return (
    <ChartFrame
      title="Ranked targets"
      subtitle="Best fit first. Each bar is the fit score split by feature, on one 0 to 100 scale."
      legend={
        <div className="flex flex-col gap-2">
          <Legend
            kind="categorical"
            items={FIT_FEATURE_ORDER.map((n) => ({
              label: FIT_FEATURE_LABELS[n],
              color: fitFeatureColor(n),
              shape: "square" as const,
            }))}
          />
          <p className="max-w-[90ch] text-xs text-muted">
            Conflict: backed a direct competitor in the last 24 months. Sparse: more than 40% of
            the six features are unknown, so the score is rescaled over a few and ranks after the{" "}
            {!loading && <span className="tabular-nums">{formatCount(reliable)} </span>}reliable
            ones. Fresh fund:
            latest fund closed on or after Oct 29, 2024.
          </p>
        </div>
      }
      sources={sources}
      filteredOut={loading ? undefined : filteredOut}
      notShown={{ count: loading ? null : unscored, field: "fit features", noun: "investors" }}
      // While loading, hold about the list's first screen so nothing below moves in view.
      height={loading ? 640 : 160}
      action={
        <Button variant="outline" size="sm" onClick={onExport} disabled={ranked.length === 0}>
          <Download aria-hidden /> Export target list (CSV)
        </Button>
      }
      state={
        loading
          ? { status: "loading" }
          : ranked.length === 0
          ? { status: "empty", message: "No investor with fit data matches the current filters. Widen a filter to rank more investors." }
          : { status: "ready" }
      }
      tableAlternative={
        <ChartTable
          caption="Ranked targets with fit points by feature"
          rows={ranked}
          rowKey={(r) => r.row.id}
          limit={PAGE}
          scrollClassName="max-h-[32rem]"
          columns={[
            { header: "Rank", numeric: true, cell: (r) => String(r.rank) },
            {
              header: "Investor",
              cell: (r) => (
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => open(r.row.id)}
                >
                  {r.row.name}
                </button>
              ),
            },
            ...FIT_FEATURE_ORDER.map((n) => ({
              header: FIT_FEATURE_LABELS[n],
              numeric: true,
              cell: (r: Ranked) => {
                const p = r.score.contributions[n];
                return p === null ? "unknown" : p.toFixed(1);
              },
            })),
            { header: "Total", numeric: true, cell: (r: Ranked) => r.score.total.toFixed(1) },
            { header: "Known", numeric: true, cell: (r: Ranked) => formatPercent(r.score.coverage) },
            {
              header: "Flags",
              cell: (r: Ranked) => r.row.flags.join(", ") || "none",
            },
            {
              header: "Outreach tier",
              cell: (r: Ranked) =>
                `${effectiveTier(r, overrides)}${overrides[r.row.id] ? " (manual)" : ""}`,
            },
          ]}
        />
      }
    >
      <ol className="flex flex-col" aria-label="Ranked investors">
        {visible.map((r) => {
          const b = breakdownOf(r, weights, raiseUsd);
          const tier = effectiveTier(r, overrides);
          return (
            <motion.li
              key={r.row.id}
              layout="position"
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => open(r.row.id)}
              className={cn(
                "grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1 border-t border-rule px-1 py-2 first:border-t-0 hover:bg-panel-sunk md:grid-cols-[2.25rem_minmax(0,1.3fr)_minmax(10rem,1fr)_3.5rem]",
                !r.reliable && "text-ink-2",
              )}
            >
              <span className="col-start-1 row-start-1 text-right text-sm text-ink-2 tabular-nums">
                {r.rank}
              </span>
              <div className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  className="max-w-full truncate rounded-sm text-left text-sm font-medium text-ink hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    open(r.row.id);
                  }}
                >
                  {r.row.name}
                </button>
                <FlagChips row={r.row} />
                <TierChip tier={tier} manual={overrides[r.row.id] !== undefined} />
              </div>
              <span className="col-start-3 row-start-1 text-right text-sm font-semibold tabular-nums md:col-start-4">
                {r.score.total.toFixed(1)}
              </span>
              <div className="col-span-2 col-start-2 row-start-2 md:col-span-1 md:col-start-3 md:row-start-1">
                {b && (
                  <HoverTip
                    className="block w-full"
                    content={
                      <VizTooltip
                        title={r.row.name}
                        value={`${r.score.total.toFixed(1)} of 100`}
                        period={`${formatPercent(r.score.coverage)} of weight known`}
                        confidence={null}
                        sourceDomain={null}
                        computed
                      >
                        {b.segments.map((s) => (
                          <p key={s.feature} className="flex justify-between gap-3 tabular-nums">
                            <span>{s.label}</span>
                            <span>{s.points.toFixed(1)}</span>
                          </p>
                        ))}
                        {b.unknown.length > 0 && (
                          <p className="mt-1 text-xs">
                            Unknown, not scored: {b.unknown.map((u) => u.label).join(", ")}
                          </p>
                        )}
                      </VizTooltip>
                    }
                  >
                    <ContributionBar
                      ariaLabel={`${r.row.name} fit ${r.score.total.toFixed(1)} of 100`}
                      segments={b.segments.map((s) => ({
                        key: s.feature,
                        label: s.label,
                        points: s.points,
                        color: fitFeatureColor(s.feature),
                      }))}
                    />
                  </HoverTip>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-2">
        <span className="tabular-nums" role="status">
          Showing {formatCount(visible.length)} of {formatCount(ranked.length)}
        </span>
        {visible.length < ranked.length && (
          <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            Show {formatCount(Math.min(PAGE, ranked.length - visible.length))} more
          </Button>
        )}
      </div>
    </ChartFrame>
  );
}
