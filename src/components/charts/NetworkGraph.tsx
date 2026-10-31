"use client";

import dynamic from "next/dynamic";
import { useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";
import {
  ChartFrame,
  Chip,
  Legend,
  SearchBox,
  Segmented,
  Skeleton,
  VizTooltip,
  type SearchItem,
} from "@/components/ui-atlas";
import { Slider } from "@/components/ui/slider";
import { loadFilterIndex, loadGraph, useLoaded } from "@/lib/client-index";
import { useFilters } from "@/lib/filters/use-filters";
import { formatCount, formatPartialDate, formatUsd, UNKNOWN } from "@/lib/format";
import { INVESTOR_TYPE_LABELS, LAYER_LABELS, ROUND_STAGE_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useThemeColors } from "@/lib/hooks/useThemeColors";
import {
  LABEL_LEVELS,
  MAX_LABEL_LEVEL,
  networkParsers,
  networkUrlOptions,
} from "@/lib/network/url";
import { ROUND_STAGES } from "@/lib/schema/enums";
import { cn } from "@/lib/utils";
import { COMPANY_GREY } from "@/lib/viz/palette";
import {
  capitalGrey,
  investorPassMask,
  investorsWithoutRounds,
  networkRows,
  networkView,
  NO_GROUP_COLOR,
  nodeColours,
  nodeRadius,
  searchNodes,
  stageCounts,
  typeColours,
  viewSources,
  type GraphData,
  type GraphNode,
  type NetworkMode,
  type NetworkRow,
  type NetworkView,
  type RoundFilter,
} from "@/lib/viz/transforms/networkGraph";
import { toGraphData } from "@/lib/viz/transforms/networkGraph";
import type { ClusterInfo } from "@/lib/viz/transforms/thesisMap";
import { ChartTable } from "./ChartTable";
import type { CanvasHandle } from "./NetworkCanvas";

const HEIGHT = 620;
const NEUTRAL = "#8A919C";

// Sigma, graphology and WebGL: load them on this view only, in the browser only.
const NetworkCanvas = dynamic(() => import("./NetworkCanvas"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const plural = (n: number, one: string, many = `${one}s`) =>
  `${formatCount(n)} ${n === 1 ? one : many}`;
const decimal = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function NetworkGraph({ clusters }: { clusters: ClusterInfo[] }) {
  const { filters } = useFilters();
  const { id: selectedId, open } = useInspector();
  const [params, setParams] = useQueryStates(networkParsers, networkUrlOptions);
  const graph = useLoaded("graph", loadGraph);
  const universe = useLoaded("filter-index", loadFilterIndex);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const theme = useThemeColors();
  const canvas = useRef<CanvasHandle | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [locked, setLocked] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const data = useMemo(() => (graph.status === "ready" ? toGraphData(graph.data) : null), [graph]);
  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.index, c])), [clusters]);
  const universeRows = universe.status === "ready" ? universe.data : null;
  const investorPass = useMemo(
    () => (data ? investorPassMask(data, filters, universeRows) : null),
    [data, filters, universeRows],
  );
  const selected = data && selectedId ? (data.index.get(selectedId) ?? null) : null;
  const rounds = useMemo<RoundFilter>(
    () => ({ years: params.years, stages: params.rstage }),
    [params.years, params.rstage],
  );
  const labelLevel = Math.min(Math.max(params.labels, 0), MAX_LABEL_LEVEL);
  const { mode, hops } = params;

  const view = useMemo(
    () =>
      data && investorPass
        ? networkView(data, { mode, investorPass, rounds, centre: selected, hops })
        : null,
    [data, investorPass, mode, rounds, selected, hops],
  );
  const colours = useMemo(
    () => (data ? nodeColours(data, params.colour) : []),
    [data, params.colour],
  );
  const stages = useMemo(
    () => (data && investorPass ? stageCounts(data, investorPass, params.years) : null),
    [data, investorPass, params.years],
  );
  const lockedShown = view && locked !== null && view.node[locked] ? locked : null;

  const select = useCallback(
    (i: number) => {
      const v = data?.nodes[i];
      if (!v) return;
      setLocked(i);
      open(v.id);
    },
    [data, open],
  );
  const unlock = useCallback(() => setLocked(null), []);

  // Esc unlocks a locked highlight first; the next Esc reaches the Inspector and closes it.
  // A filled search box takes Esc first, to clear itself.
  useEffect(() => {
    if (lockedShown === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("textarea, select, [role=dialog]")) return;
      // A text field with something in it (or an open list) uses this Esc itself.
      if (
        t instanceof HTMLInputElement &&
        (t.value || t.getAttribute("aria-expanded") === "true")
      ) {
        return;
      }
      e.preventDefault();
      setLocked(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lockedShown]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const search = useCallback(
    (q: string): SearchItem[] =>
      data && view
        ? searchNodes(data, view, q).map((v) => ({ id: v.id, label: v.label, hint: kindLabel(v) }))
        : [],
    [data, view],
  );
  const focusNode = (item: SearchItem) => {
    const i = data?.index.get(item.id);
    if (i === undefined) return;
    canvas.current?.focus(i);
    select(i);
  };

  const renderTooltip = useCallback(
    (i: number) =>
      data && view ? (
        <NodeTooltip node={data.nodes[i]!} view={view} clusterById={clusterById} />
      ) : null,
    [data, view, clusterById],
  );

  const notShown =
    data && universeRows
      ? [
          {
            noun: "investors",
            field: "a round in our data",
            count: investorsWithoutRounds(data, filters, universeRows),
          },
          { noun: "companies", field: "a round in our data", count: data.companiesWithoutRounds },
        ]
      : [{ noun: "investors", field: "a round in our data", count: null }];

  const state =
    graph.status === "error"
      ? ({ status: "error", message: "The graph could not load. Reload the page." } as const)
      : universe.status === "error"
        ? ({
            status: "error",
            message: "The filter index could not load. Reload the page.",
          } as const)
        : !view
          ? ({ status: "loading" } as const)
          : view.node.some(Boolean)
            ? ({ status: "ready" } as const)
            : ({
                status: "empty",
                message:
                  mode === "coinvest"
                    ? "No two investors share two or more rounds under these filters. Widen a filter or the date range."
                    : "No investor with a round in our data matches these filters. Widen a filter or the date range.",
              } as const);

  const extent = data?.yearExtent ?? null;
  const yearValue: [number, number] | null = extent
    ? [params.years?.[0] ?? extent[0], params.years?.[1] ?? extent[1]]
    : null;
  const status = data && view ? statusLine(data, view, mode, hops, selectedId) : "";

  return (
    <ChartFrame
      title="Network"
      subtitle={SUBTITLES[mode]}
      legend={
        data && view ? (
          <NetworkLegend
            data={data}
            view={view}
            clusters={clusters}
            colourBy={params.colour}
            accent={theme.accent}
            ink2={theme.ink2}
            muted={theme.muted}
          />
        ) : undefined
      }
      legendPosition="side"
      sources={data && view ? viewSources(data, view) : []}
      filteredOut={view?.counts.hiddenByFilters}
      notShown={notShown}
      state={state}
      height={HEIGHT}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented
            label="Graph mode"
            value={mode}
            onChange={(next) => void setParams({ mode: next })}
            options={MODE_OPTIONS}
          />
          <Segmented
            label="Colour investors by"
            value={params.colour}
            onChange={(colour) => void setParams({ colour })}
            options={[
              { value: "cluster", label: "By cluster" },
              { value: "type", label: "By type" },
            ]}
          />
        </div>
      }
      tableAlternative={
        data && view ? (
          <NetworkTable data={data} view={view} clusterById={clusterById} onSelect={select} />
        ) : undefined
      }
    >
      {data && view && (
        <div
          ref={frameRef}
          className={cn("flex flex-col gap-3", fullscreen && "h-full overflow-auto bg-panel p-4")}
        >
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <SearchBox
              label="Find a node"
              placeholder="Find an investor or company"
              search={search}
              onSelect={focusNode}
              emptyText="No shown node matches. Widen the filters or switch mode."
              className="w-72"
            />
            {extent && yearValue && (
              <div className="flex w-64 flex-col gap-1.5">
                <span className="flex justify-between text-xs text-ink-2">
                  <span>Round dates</span>
                  <span className="tabular-nums">
                    {params.years ? `${yearValue[0]} to ${yearValue[1]}` : "All, undated included"}
                  </span>
                </span>
                <Slider
                  min={extent[0]}
                  max={extent[1]}
                  step={1}
                  value={yearValue}
                  thumbLabels={["Rounds from year", "Rounds to year"]}
                  onValueChange={(v) => {
                    const [a = extent[0], b = extent[1]] = v;
                    void setParams({
                      years: a === extent[0] && b === extent[1] ? null : [a, b],
                    });
                  }}
                />
              </div>
            )}
            <div className="flex w-52 flex-col gap-1.5">
              <span className="flex justify-between gap-2 text-xs text-ink-2">
                <span>Labels</span>
                <span>{LABEL_LEVELS[labelLevel]?.name}</span>
              </span>
              <Slider
                min={0}
                max={MAX_LABEL_LEVEL}
                step={1}
                value={[labelLevel]}
                thumbLabels={["Label density"]}
                thumbValueTexts={[LABEL_LEVELS[labelLevel]?.name ?? ""]}
                onValueChange={(v) => void setParams({ labels: v[0] ?? null })}
              />
            </div>
            {mode === "ego" && (
              <Segmented
                label="Ego network depth"
                value={hops === 2 ? "2" : "1"}
                onChange={(h) => void setParams({ hops: h === "2" ? 2 : 1 })}
                options={[
                  { value: "1", label: "1 hop" },
                  { value: "2", label: "2 hops" },
                ]}
              />
            )}
          </div>
          {stages && (
            <div
              role="group"
              aria-label="Round stage"
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className="mr-1 text-xs text-ink-2">Round stage</span>
              <Chip
                label="All stages"
                selected={params.rstage.length === 0}
                onClick={() => void setParams({ rstage: [] })}
              />
              {ROUND_STAGES.map((s) => (
                <Chip
                  key={s}
                  label={ROUND_STAGE_LABELS[s]}
                  count={stages[s]}
                  selected={params.rstage.includes(s)}
                  onClick={() =>
                    void setParams({
                      rstage: params.rstage.includes(s)
                        ? params.rstage.filter((x) => x !== s)
                        : [...params.rstage, s],
                    })
                  }
                />
              ))}
            </div>
          )}
          <p className="text-sm text-ink-2" aria-live="polite">
            {status}
            {view.counts.undatedHidden > 0 &&
              ` ${plural(view.counts.undatedHidden, "undated round")} left out by the date range.`}
          </p>
          <div
            className={cn(
              "relative overflow-hidden rounded-md border border-rule",
              fullscreen && "min-h-[480px] flex-1",
            )}
            style={fullscreen ? undefined : { height: HEIGHT }}
          >
            <div
              role="img"
              aria-label={`Network graph. ${status} Use View as table for a keyboard-friendly list.`}
              className="absolute inset-0"
            >
              <NetworkCanvas
                ref={canvas}
                data={data}
                view={view}
                colours={colours}
                theme={theme}
                selected={selected}
                locked={lockedShown}
                onSelect={select}
                onUnlock={unlock}
                labelLevel={labelLevel}
                reduced={reduced}
                renderTooltip={renderTooltip}
                className="relative h-full w-full"
              />
            </div>
            <div className="absolute top-2 right-2">
              <CanvasButton
                label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                onClick={toggleFullscreen}
              >
                {fullscreen ? (
                  <Minimize2 aria-hidden className="size-4" />
                ) : (
                  <Maximize2 aria-hidden className="size-4" />
                )}
              </CanvasButton>
            </div>
            <div className="absolute right-2 bottom-2 flex flex-col gap-1">
              <CanvasButton label="Zoom in" onClick={() => canvas.current?.zoomIn()}>
                <Plus aria-hidden className="size-4" />
              </CanvasButton>
              <CanvasButton label="Zoom out" onClick={() => canvas.current?.zoomOut()}>
                <Minus aria-hidden className="size-4" />
              </CanvasButton>
              <CanvasButton label="Reset view" onClick={() => canvas.current?.reset()}>
                <RotateCcw aria-hidden className="size-4" />
              </CanvasButton>
            </div>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}

const MODE_OPTIONS = [
  { value: "full", label: "Full graph" },
  { value: "ego", label: "Ego network" },
  { value: "coinvest", label: "Co-investors" },
  { value: "competitors", label: "Competitor lens" },
] as const satisfies readonly { value: NetworkMode; label: string }[];

const HOW_TO =
  "Hover to highlight neighbours; click to open the Inspector and lock the highlight (Esc or a background click unlocks). Scroll to zoom, drag to pan.";

const SUBTITLES: Record<NetworkMode, string> = {
  full: `Investors joined to the companies they backed; node area = weighted degree. ${HOW_TO}`,
  ego: `The selected node and everything within one or two links of it. ${HOW_TO}`,
  coinvest: `Investors joined when they share two or more rounds; line width = shared rounds. ${HOW_TO}`,
  competitors: `Our competitors, the investors that backed them and those investors' other deals. ${HOW_TO}`,
};

function statusLine(
  data: GraphData,
  view: NetworkView,
  mode: NetworkMode,
  hops: 1 | 2,
  selectedId: string | null,
): string {
  const c = view.counts;
  const nodes = `${plural(c.investors, "investor")}, ${plural(c.companies, "company", "companies")} (${plural(c.competitors, "competitor")})`;
  if (mode === "coinvest") {
    return `${plural(c.investors, "investor")} sharing two or more rounds; ${plural(c.edges, "co-investment link")}.`;
  }
  if (mode === "ego") {
    if (view.centre === null) {
      return selectedId
        ? "The selected record has no round in our data, so it has no ego network. Showing the full graph."
        : "Click a node or find one to see its ego network. Showing the full graph until then.";
    }
    const name = data.nodes[view.centre]!.label;
    return `Ego network of ${name}, ${hops === 1 ? "1 hop" : "2 hops"}: ${nodes} and ${plural(c.edges, "link")}.`;
  }
  return `Showing ${nodes} and ${plural(c.edges, "link")}.`;
}

function CanvasButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md border border-rule bg-panel text-ink-2 shadow-float hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

function NetworkLegend({
  data,
  view,
  clusters,
  colourBy,
  accent,
  ink2,
  muted,
}: {
  data: GraphData;
  view: NetworkView;
  clusters: ClusterInfo[];
  colourBy: "cluster" | "type";
  accent: string;
  ink2: string;
  muted: string;
}) {
  const types = typeColours(data.typesPresent);
  const groups =
    colourBy === "cluster"
      ? clusters.map((c) => ({ label: c.shortLabel, color: c.color }))
      : data.typesPresent.map((t) => ({ label: INVESTOR_TYPE_LABELS[t], color: types.get(t)! }));
  const missing = colourBy === "cluster" ? view.counts.noCluster : view.counts.noType;
  const samples = [1, 10, 50];
  const coinvest = view.mode === "coinvest";
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4 xl:flex-col xl:flex-nowrap">
      <Legend
        kind="categorical"
        title={colourBy === "cluster" ? "Investors by thesis cluster" : "Investors by type"}
        className="gap-x-3"
        items={[
          ...groups,
          {
            label: `No ${colourBy === "cluster" ? "cluster" : "type"} on record (${formatCount(missing)} shown)`,
            color: NO_GROUP_COLOR,
          },
          { label: "Accelerator or incubator", color: NEUTRAL, shape: "square" as const },
        ]}
      />
      {!coinvest && (
        <Legend
          kind="categorical"
          title="Companies by capital raised (reported total, else the sum of known rounds)"
          className="gap-x-3"
          items={[
            { label: "Under $10M", color: capitalGrey(0) },
            { label: "$10M to $100M", color: capitalGrey(1) },
            { label: "$100M to $1B", color: capitalGrey(2) },
            { label: "$1B or more", color: capitalGrey(3) },
            {
              label: `Unknown (${formatCount(view.counts.unknownCapital)} shown)`,
              color: COMPANY_GREY.low,
            },
            { label: "Competitor (accent ring)", color: capitalGrey(1), ring: accent },
          ]}
        />
      )}
      <Legend
        kind="categorical"
        title="Links"
        items={
          coinvest
            ? [
                {
                  label: "Shared rounds (2 or more; wider = more)",
                  color: ink2,
                  shape: "line" as const,
                  lineWidth: 2,
                },
              ]
            : [
                { label: "Led a round", color: ink2, shape: "line" as const, lineWidth: 2 },
                {
                  label: "Participated, or role not stated",
                  color: muted,
                  shape: "line" as const,
                  lineWidth: 1.2,
                },
              ]
        }
      />
      <Legend
        kind="size"
        title="Weighted degree (rounds; a lead counts 1.5)"
        samples={samples.map((v) => ({ value: v, label: String(v) }))}
        maxRadius={nodeRadius(samples[samples.length - 1]!)}
      />
    </div>
  );
}

function kindLabel(v: GraphNode): string {
  if (v.kind === "competitor") return "Competitor";
  if (v.kind === "company") return "Company";
  return v.type ? `Investor · ${INVESTOR_TYPE_LABELS[v.type]}` : "Investor · type unknown";
}

function NodeTooltip({
  node,
  view,
  clusterById,
}: {
  node: GraphNode;
  view: NetworkView;
  clusterById: Map<number, ClusterInfo>;
}) {
  const rounds = view.roundsInView[node.i]!;
  const degree = view.degree[node.i]!;
  const span =
    node.firstDate && node.lastDate
      ? node.firstDate === node.lastDate
        ? formatPartialDate(node.firstDate)
        : `${formatPartialDate(node.firstDate)} to ${formatPartialDate(node.lastDate)}`
      : null;
  if (node.kind === "investor") {
    const cluster = node.cluster === null ? undefined : clusterById.get(node.cluster);
    return (
      <VizTooltip
        title={node.label}
        value={`${plural(rounds, "round")} in view`}
        period={span ? `Rounds in our data: ${span}` : "Round dates unknown"}
        confidence={node.confidence}
        sourceDomain={node.sourceDomain}
      >
        <p className="tabular-nums">
          Weighted degree {decimal(node.wd)} (node area; a lead counts 1.5)
        </p>
        <p className="tabular-nums">
          {view.mode === "coinvest"
            ? `${plural(degree, "co-investor")} with 2 or more shared rounds`
            : `${plural(degree, "company", "companies")} in view`}
        </p>
        <p>{kindLabel(node)}</p>
        <p>{cluster ? cluster.label : "No thesis cluster"}</p>
      </VizTooltip>
    );
  }
  return (
    <VizTooltip
      title={node.label}
      value={node.raised === null ? "Capital raised unknown" : `${formatUsd(node.raised)} raised`}
      period={
        node.lastDate ? `Latest round ${formatPartialDate(node.lastDate)}` : "Round dates unknown"
      }
      confidence={node.confidence}
      sourceDomain={node.sourceDomain}
    >
      {node.raised !== null && (
        <p>
          {node.basis === "reported" ? "Reported total" : "Sum of known rounds (a lower bound)"}
        </p>
      )}
      <p className="tabular-nums">
        {plural(rounds, "round")} and {plural(degree, "investor")} in view
      </p>
      <p>
        {kindLabel(node)}
        {node.layer ? ` · ${LAYER_LABELS[node.layer]}` : ""}
      </p>
    </VizTooltip>
  );
}

function NetworkTable({
  data,
  view,
  clusterById,
  onSelect,
}: {
  data: GraphData;
  view: NetworkView;
  clusterById: Map<number, ClusterInfo>;
  onSelect: (i: number) => void;
}) {
  const rows = useMemo(() => networkRows(data, view), [data, view]);
  const linksHeader = view.mode === "coinvest" ? "Co-investors in view" : "Links in view";
  return (
    <ChartTable<NetworkRow>
      caption="Network nodes in the current view"
      rows={rows}
      rowKey={(r) => r.id}
      initialSort={{ column: "Weighted degree", dir: "desc" }}
      limit={200}
      columns={[
        {
          header: "Name",
          sortValue: (r) => r.label,
          cell: (r) => (
            <button
              type="button"
              className="text-left text-accent hover:underline"
              onClick={() => onSelect(r.i)}
            >
              {r.label}
            </button>
          ),
        },
        { header: "Type", sortValue: (r) => kindLabel(r), cell: (r) => kindLabel(r) },
        {
          header: "Cluster",
          sortValue: (r) =>
            r.cluster === null ? null : (clusterById.get(r.cluster)?.shortLabel ?? null),
          cell: (r) =>
            r.cluster === null ? UNKNOWN : (clusterById.get(r.cluster)?.shortLabel ?? UNKNOWN),
        },
        {
          header: "Weighted degree",
          numeric: true,
          sortValue: (r) => r.wd,
          cell: (r) => decimal(r.wd),
        },
        {
          header: linksHeader,
          numeric: true,
          sortValue: (r) => r.degree,
          cell: (r) => formatCount(r.degree),
        },
        {
          header: "Rounds in view",
          numeric: true,
          sortValue: (r) => r.roundsInView,
          cell: (r) => formatCount(r.roundsInView),
        },
        {
          header: "Capital raised",
          numeric: true,
          sortValue: (r) => r.raised,
          cell: (r) => (r.kind === "investor" ? "" : formatUsd(r.raised)),
        },
      ]}
    />
  );
}
