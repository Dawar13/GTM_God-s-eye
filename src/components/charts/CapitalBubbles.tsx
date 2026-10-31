"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ChartFrame, Legend, Segmented, Skeleton } from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { loadFilterIndex, useLoaded } from "@/lib/client-index";
import { useFilters } from "@/lib/filters/use-filters";
import { formatMonthYear, formatUsd, UNKNOWN } from "@/lib/format";
import { INVESTOR_TYPE_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import {
  bubbleSizing,
  bubbleView,
  BUBBLE_FIELDS,
  sizeSamples,
  type BubbleData,
} from "@/lib/viz/transforms/capitalBubbles";
import type { ClusterInfo } from "@/lib/viz/transforms/thesisMap";
import type { CameraPreset } from "./Bubbles3D";
import { BubbleProjections } from "./BubbleProjections";
import { ChartTable } from "./ChartTable";

const HEIGHT = 560;
const NEUTRAL = "#8A919C";

// Plotly is large and needs WebGL: load it on this view only, in the browser only.
const Bubbles3D = dynamic(() => import("./Bubbles3D"), {
  ssr: false,
  loading: () => <Skeleton className="w-full" style={{ height: HEIGHT }} />,
});

type Mode = "3d" | "2d";
const CAMERA_BUTTONS: readonly { preset: CameraPreset; label: string; hint: string }[] = [
  { preset: "front", label: "Front", hint: "Check across, industrial affinity up" },
  { preset: "top", label: "Top", hint: "Check across, stage earliness up" },
  { preset: "side", label: "Side", hint: "Stage earliness across, industrial affinity up" },
  { preset: "reset", label: "Reset", hint: "Back to the starting angle" },
];

export function CapitalBubbles({
  data,
  clusters,
  computedAt,
}: {
  data: BubbleData;
  clusters: ClusterInfo[];
  /** When the pipeline computed layout_bubbles (ISO date-time). */
  computedAt: string;
}) {
  const { filters } = useFilters();
  const { id: selectedId, open } = useInspector();
  const universe = useLoaded("filter-index", loadFilterIndex);
  const [mode, setMode] = useState<Mode>("3d");
  const [camera, setCamera] = useState<{ preset: CameraPreset; n: number }>({
    preset: "reset",
    n: 0,
  });

  const view = useMemo(
    () => bubbleView(data, filters, universe.status === "ready" ? universe.data : null),
    [data, filters, universe],
  );
  const sizing = useMemo(() => bubbleSizing(data.maxFundUsd), [data.maxFundUsd]);
  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.index, c])), [clusters]);
  const computedLabel = formatMonthYear(computedAt);

  const samples = sizing ? sizeSamples(sizing.maxValue) : [];
  const maxSample = samples.length ? samples[samples.length - 1]! : 0;
  const legend = (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
      <Legend
        kind="categorical"
        className="max-w-3xl"
        items={[
          ...clusters.map((c) => ({ label: c.shortLabel, color: c.color })),
          { label: "Accelerator or incubator", color: NEUTRAL, shape: "square" as const },
          { label: "Fund size unknown (ring, not to scale)", color: NEUTRAL, hollow: true },
        ]}
      />
      {sizing && samples.length > 0 && (
        <div className="flex flex-col gap-1">
          <Legend
            kind="size"
            title="Latest fund size (bubble area)"
            samples={samples.map((v) => ({ value: v, label: formatUsd(v) }))}
            maxRadius={(sizing.maxDiameter / 2) * Math.sqrt(maxSample / sizing.maxValue)}
          />
          <p className="text-xs text-muted">
            Funds under {formatUsd(sizing.floorValue)} are drawn at the {sizing.minDiameter}px
            minimum.
          </p>
        </div>
      )}
    </div>
  );

  const subtitle =
    mode === "3d"
      ? "x = typical check (log scale), y = stage earliness, z = industrial affinity; bubble area = latest fund size. 3D distorts perceived position: use Show as 2D to read exact positions. Drag to rotate."
      : "The same investors in three flat projections, because 3D distorts perceived position. Hover a bubble to find it in all three.";

  return (
    <ChartFrame
      title="Capital bubbles"
      subtitle={subtitle}
      legend={legend}
      sources={view.sources}
      filteredOut={view.filteredOut}
      notShown={view.notShown ?? [{ field: BUBBLE_FIELDS.join(", "), count: null }]}
      state={
        view.points.length === 0
          ? {
              status: "empty",
              message:
                "No investor with a known check size, stage and thesis matches the current filters. Widen a filter to see bubbles.",
            }
          : { status: "ready" }
      }
      height={mode === "3d" ? HEIGHT : 380}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented
            label="Capital view"
            value={mode}
            onChange={setMode}
            options={[
              { value: "3d", label: "3D" },
              { value: "2d", label: "Show as 2D" },
            ]}
          />
          {mode === "3d" && (
            <div role="group" aria-label="Camera presets" className="flex gap-1">
              {CAMERA_BUTTONS.map((b) => (
                <Button
                  key={b.preset}
                  variant="outline"
                  size="sm"
                  title={b.hint}
                  aria-label={`${b.label} camera: ${b.hint}`}
                  onClick={() => setCamera((c) => ({ preset: b.preset, n: c.n + 1 }))}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      }
      tableAlternative={
        <ChartTable
          caption="Capital bubbles"
          rows={[...view.points].sort((a, b) => b.check - a.check || a.name.localeCompare(b.name))}
          rowKey={(p) => p.id}
          columns={[
            {
              header: "Investor",
              cell: (p) => (
                <button
                  type="button"
                  className="text-left text-accent hover:underline"
                  onClick={() => open(p.id)}
                >
                  {p.name}
                </button>
              ),
            },
            { header: "Typical check", numeric: true, cell: (p) => formatUsd(p.check) },
            { header: "Stage earliness", numeric: true, cell: (p) => p.earliness.toFixed(2) },
            { header: "Industrial affinity", numeric: true, cell: (p) => p.affinity.toFixed(2) },
            {
              header: "Latest fund",
              numeric: true,
              cell: (p) =>
                p.fundUsd === null
                  ? UNKNOWN
                  : `${formatUsd(p.fundUsd)}${p.fundPeriod ? ` (${p.fundPeriod})` : ""}`,
            },
            {
              header: "Cluster",
              cell: (p) =>
                p.cluster === null ? UNKNOWN : (clusterById.get(p.cluster)?.shortLabel ?? UNKNOWN),
            },
            { header: "Type", cell: (p) => (p.type ? INVESTOR_TYPE_LABELS[p.type] : UNKNOWN) },
          ]}
        />
      }
    >
      {mode === "3d" ? (
        <Bubbles3D
          points={view.points}
          clusterById={clusterById}
          sizing={sizing}
          checkExtent={data.checkExtent}
          selectedId={selectedId}
          camera={camera}
          onOpen={open}
          computedLabel={computedLabel}
          height={HEIGHT}
        />
      ) : (
        <BubbleProjections
          points={view.points}
          clusterById={clusterById}
          sizing={sizing}
          checkExtent={data.checkExtent}
          selectedId={selectedId}
          onOpen={open}
          computedLabel={computedLabel}
        />
      )}
    </ChartFrame>
  );
}
