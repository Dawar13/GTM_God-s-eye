"use client";

import { useMemo, useState } from "react";
import { ChartFrame, HoverTip, Legend, VizTooltip } from "@/components/ui-atlas";
import { formatCount, formatUsd, UNKNOWN } from "@/lib/format";
import { LAYER_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import { COMPANY_GREY, markStyle } from "@/lib/viz";
import type { CompetitorRow, LayerMapData } from "@/lib/viz/transforms/competitors";
import { ChartFind } from "./ChartFind";
import { ChartTable } from "./ChartTable";

const GREY = COMPANY_GREY.high;

/** Competitors placed in horizontal bands, design intent to full-stack factory (S8). */
export function LayerMap({ data, sources }: { data: LayerMapData; sources: readonly string[] }) {
  const { open } = useInspector();
  const rows = useMemo(() => data.bands.flatMap((b) => b.items), [data.bands]);
  const m = markStyle(GREY);
  // State, not a ref: the bands remount after "View as table", and the find box repaints them.
  const [root, setRoot] = useState<HTMLOListElement | null>(null);
  return (
    <ChartFrame
      title="Layer map"
      subtitle="Each competitor sits in the band for its layer, from design intent at the top to the full-stack factory at the bottom; the biggest raisers come first in a band."
      legend={
        <Legend
          kind="categorical"
          items={[{ label: "Competitor (one mark each; band = layer, click to open)", color: GREY, ring: "var(--accent)" }]}
        />
      }
      sources={sources}
      notShown={{ count: data.unplaced, field: "layer", noun: "competitors" }}
      state={rows.length === 0 ? { status: "empty", message: "No competitors are in the data yet. Run the pipeline to load them." } : { status: "ready" }}
      height={0}
      find={<ChartFind label="Find competitors in the layer map" entities={rows} root={root} />}
      tableAlternative={
        <ChartTable
          caption="Competitors by layer"
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { header: "Layer", cell: (r) => LAYER_LABELS[r.layer] },
            {
              header: "Competitor",
              cell: (r) => (
                <button type="button" className="text-accent hover:underline" onClick={() => open(r.id)}>
                  {r.name}
                </button>
              ),
            },
            { header: "Total raised", numeric: true, cell: (r) => formatUsd(r.totalRaisedUsd) },
          ]}
        />
      }
    >
      <ol ref={setRoot} aria-label="Layer bands" className="flex flex-col border-y border-rule">
        {data.bands.map((band, i) => (
          <li
            key={band.layer}
            className="grid grid-cols-[9rem_1fr] items-start gap-3 border-b border-rule py-2.5 last:border-b-0"
            style={{ background: i % 2 ? "transparent" : "var(--panel-sunk)" }}
          >
            <div className="px-2">
              <p className="text-sm font-medium">{LAYER_LABELS[band.layer]}</p>
              <p className="text-xs text-ink-2 tabular-nums">{formatCount(band.items.length)} competitors</p>
            </div>
            <ul className="flex flex-wrap gap-1.5 pr-2">
              {band.items.map((r) => (
                <li key={r.id} data-find-id={r.id}>
                  <HoverTip content={<ChipTip r={r} />}>
                    <button
                      type="button"
                      onClick={() => open(r.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-panel px-2.5 py-1 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <svg width="12" height="12" aria-hidden>
                        <circle cx="6" cy="6" r="4" fill={m.fill} stroke="var(--accent)" strokeWidth="2" />
                      </svg>
                      {r.name}
                    </button>
                  </HoverTip>
                </li>
              ))}
              {band.items.length === 0 && <li className="text-sm text-muted">No competitors in this layer.</li>}
            </ul>
          </li>
        ))}
      </ol>
    </ChartFrame>
  );
}

function ChipTip({ r }: { r: CompetitorRow }) {
  return (
    <VizTooltip
      title={r.name}
      value={r.totalRaisedUsd === null ? "Total raised unknown" : `${formatUsd(r.totalRaisedUsd)} raised`}
      period={r.foundedYear === null ? "Founded unknown" : `Founded ${r.foundedYear}`}
      confidence={r.confidence}
      sourceDomain={r.sourceDomain}
    >
      <p>{LAYER_LABELS[r.layer]}</p>
      <p className="tabular-nums">
        Headcount {r.headcount === null ? UNKNOWN : `~${formatCount(r.headcount)} (approx.)`}
      </p>
    </VizTooltip>
  );
}
