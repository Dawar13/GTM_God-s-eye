"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { columnVisibilityFeature, tableFeatures, useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { ChevronDown, ChevronUp, Columns3, Download } from "lucide-react";
import { cn } from "cn";
import { Chip, Segmented, Skeleton } from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { loadDirectoryRows, useLoaded } from "@/lib/client-index";
import { rowsInArea, withRoundFit, type AreaCoords, type DirectoryRow } from "@/lib/data/directory";
import { useRound } from "@/lib/round/use-round";
import { DEFAULT_VISIBLE, DIRECTORY_COLUMNS } from "@/lib/directory/columns";
import { csvFilename, toCsv } from "@/lib/directory/csv";
import {
  DEFAULT_SORT,
  SORT_KEYS,
  SORT_PARAM,
  parseSortKey,
  sortKeyOf,
  sortRows,
  type SortColumn,
} from "@/lib/directory/sort";
import { applyFilters, facetCounts, summarizeStages } from "@/lib/filters";
import { AREA_LABELS, AREA_PARAM, parseAsArea } from "@/lib/filters/area";
import { useFilters } from "@/lib/filters/use-filters";
import { filterUrlOptions } from "@/lib/filters/url";
import { formatCount, formatUsd, UNKNOWN } from "@/lib/format";
import {
  FRESHNESS_LABELS,
  INVESTOR_TYPE_LABELS,
  REGION_LABELS,
  TIER_LABELS,
} from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import { CATEGORICAL, markerShapeFor, markStyle } from "@/lib/viz";

const features = tableFeatures({ columnVisibilityFeature });
const columns = DIRECTORY_COLUMNS.map((c) => ({
  id: c.id,
  header: c.header,
  accessorFn: (r: DirectoryRow) => r.id,
  enableHiding: !c.required,
}));
const META = new Map(DIRECTORY_COLUMNS.map((c) => [c.id, c]));

type Density = "comfortable" | "compact";
const ROW_HEIGHT: Record<Density, number> = { comfortable: 40, compact: 28 };
const DENSITY_KEY = "atlas.directory.density";
const COLUMNS_KEY = "atlas.directory.columns";

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

const FIT_FLAG_LABELS: Record<string, string> = { sparse: "Sparse", conflict: "Conflict" };
const FIT_FILL = markStyle(CATEGORICAL[0]);
const FIT_FILL_SPARSE = markStyle("#B9BFC9");

function formatCheck(row: DirectoryRow): string {
  const { checkMinUsd: min, checkMaxUsd: max } = row;
  if (min !== null && max !== null)
    return min === max ? formatUsd(min) : `${formatUsd(min)}–${formatUsd(max)}`;
  if (min !== null) return `from ${formatUsd(min)}`;
  if (max !== null) return `up to ${formatUsd(max)}`;
  return UNKNOWN;
}

function TypeMarker({ type }: { type: DirectoryRow["type"] }) {
  const square = markerShapeFor(type) === "square";
  return (
    <svg width="8" height="8" aria-hidden className="shrink-0">
      {square ? (
        <rect x="0.5" y="0.5" width="7" height="7" fill="var(--ink-2)" />
      ) : (
        <circle cx="4" cy="4" r="3.5" fill="none" stroke="var(--ink-2)" />
      )}
    </svg>
  );
}

function Cell({ id, row }: { id: SortColumn; row: DirectoryRow }) {
  switch (id) {
    case "name":
      return <span className="truncate font-medium">{row.name}</span>;
    case "type":
      return row.type ? (
        <span className="flex items-center gap-1.5 truncate">
          <TypeMarker type={row.type} />
          {INVESTOR_TYPE_LABELS[row.type]}
        </span>
      ) : (
        UNKNOWN
      );
    case "region":
      return row.region ? REGION_LABELS[row.region] : UNKNOWN;
    case "stages":
      return row.stages.length ? summarizeStages(row.stages) : UNKNOWN;
    case "check":
      return formatCheck(row);
    case "fund":
      return row.latestFundSizeUsd === null && row.latestFundYear === null ? (
        UNKNOWN
      ) : (
        <>
          {formatUsd(row.latestFundSizeUsd)}
          <span className="ml-1.5 text-ink-2">{row.latestFundYear ?? UNKNOWN}</span>
        </>
      );
    case "freshness":
      return row.freshness && row.freshness !== "unknown" ? (
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-xs",
            row.freshness === "fresh" ? "bg-accent-soft text-ink" : "bg-panel-sunk text-ink-2",
          )}
        >
          {FRESHNESS_LABELS[row.freshness]}
        </span>
      ) : (
        UNKNOWN
      );
    case "tier":
      return row.tier ? TIER_LABELS[row.tier] : UNKNOWN;
    case "fit": {
      if (row.fit === null) return UNKNOWN;
      const sparse = row.fitFlags.includes("sparse");
      const mark = sparse ? FIT_FILL_SPARSE : FIT_FILL;
      const coverage =
        row.fitCoverage === null
          ? ""
          : `Known for ${Math.round(row.fitCoverage * 100)}% of fit weight`;
      return (
        <span className="flex items-center justify-end gap-2" title={coverage}>
          {row.fitFlags.map((f) => (
            <span
              key={f}
              className="rounded-md border border-rule px-1 text-xs font-normal text-ink-2"
            >
              {FIT_FLAG_LABELS[f] ?? f}
            </span>
          ))}
          <span
            role="img"
            aria-label={`Fit ${row.fit.toFixed(1)} of 100`}
            className="h-1.5 w-14 shrink-0 overflow-hidden rounded-sm bg-panel-sunk"
          >
            <span
              className="block h-full"
              style={{
                width: `${Math.min(100, Math.max(0, row.fit))}%`,
                backgroundColor: mark.fill,
              }}
            />
          </span>
          <span className="w-9 text-right">{row.fit.toFixed(1)}</span>
        </span>
      );
    }
    case "sources":
      return formatCount(row.sourceCount);
    case "seedLists":
      return formatCount(row.seedListCount);
    case "confidence":
      return row.confidence;
  }
}

/**
 * Loads the rows from /api/directory-rows (they are not in the page HTML), holding the
 * table's footprint while they arrive so nothing below moves.
 */
export function DirectoryTable({ areaCoords }: { areaCoords: AreaCoords }) {
  const rows = useLoaded("directory-rows", loadDirectoryRows);
  if (rows.status === "ready") return <DirectoryView rows={rows.data} areaCoords={areaCoords} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-[30px] items-center">
        <p className="text-sm text-ink-2" role={rows.status === "error" ? "alert" : undefined}>
          {rows.status === "error"
            ? "The investor list could not load. Reload the page to try again."
            : "Loading investors"}
        </p>
      </div>
      <div
        aria-busy={rows.status === "loading"}
        className="h-[calc(100dvh-19.5rem)] min-h-80 rounded-xl border border-rule bg-panel p-3"
      >
        {rows.status === "loading" && <Skeleton className="h-full w-full" />}
      </div>
    </div>
  );
}

function DirectoryView({
  rows: loadedRows,
  areaCoords,
}: {
  rows: DirectoryRow[];
  /** Thesis map positions, to resolve a region brushed on the map (`?area=`). */
  areaCoords: AreaCoords;
}) {
  // The same applyFilters the filter bar's chip counts use, so the two always agree.
  const { filters, toggle } = useFilters();
  // The fit column, its sort and the CSV all use the fit scored for our round (top bar).
  const { raise } = useRound();
  const rows = useMemo(() => loadedRows.map((r) => withRoundFit(r, raise)), [loadedRows, raise]);
  const [sort, setSort] = useQueryState(
    SORT_PARAM,
    parseAsStringLiteral(SORT_KEYS).withDefault(DEFAULT_SORT).withOptions(filterUrlOptions),
  );
  const [area, setArea] = useQueryState(AREA_PARAM, parseAsArea.withOptions(filterUrlOptions));
  const { id: selectedId, open: openInspector } = useInspector();

  const [density, setDensity] = useState<Density>("comfortable");
  const [visible, setVisible] = useState<SortColumn[]>(DEFAULT_VISIBLE);
  // Stored choices are read after mount so server and first client render agree.
  useEffect(() => {
    const d = readStored(DENSITY_KEY);
    if (d === "comfortable" || d === "compact") setDensity(d);
    const c = readStored(COLUMNS_KEY);
    if (c) {
      try {
        const ids = (JSON.parse(c) as unknown[]).filter((v): v is SortColumn =>
          META.has(v as SortColumn),
        );
        if (ids.length) setVisible(ids.includes("name") ? ids : ["name", ...ids]);
      } catch {
        /* ignore a corrupt value */
      }
    }
  }, []);

  // A brushed map region narrows the rows before the filters, so chip counts include it too.
  const inRegion = useMemo(() => rowsInArea(rows, areaCoords, area), [rows, areaCoords, area]);
  const shown = useMemo(
    () => sortRows(applyFilters(inRegion, filters), sort),
    [inRegion, filters, sort],
  );
  const counts = useMemo(() => facetCounts(inRegion, filters).type, [inRegion, filters]);

  const table = useTable({
    features,
    columns,
    data: shown,
    state: {
      columnVisibility: Object.fromEntries(
        DIRECTORY_COLUMNS.map((c) => [c.id, visible.includes(c.id)]),
      ),
    },
    onColumnVisibilityChange: () => undefined,
  });
  const leafColumns = table.getVisibleLeafColumns();
  const colIds = leafColumns.map((c) => c.id as SortColumn);
  const template = colIds.map((id) => `${META.get(id)?.width ?? 100}px`).join(" ");
  const totalWidth = colIds.reduce((a, id) => a + (META.get(id)?.width ?? 100), 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns unmemoisable functions; React Compiler skips this component, which is fine.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: shown.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT[density],
    getItemKey: (i) => shown[i]?.id ?? i,
    overscan: 12,
  });
  useEffect(() => {
    virtualizer.measure();
  }, [density, virtualizer]);

  const { column: sortColumn, dir: sortDir } = parseSortKey(sort);
  const onSort = (id: SortColumn) => {
    // First click sorts ascending (text) or descending (numbers), the second flips it.
    const numeric = META.get(id)?.numeric ?? false;
    const first = numeric ? "desc" : "asc";
    const next = sortColumn === id ? (sortDir === "asc" ? "desc" : "asc") : first;
    void setSort(sortKeyOf(id, next));
  };

  const toggleColumn = (id: SortColumn) => {
    const next = visible.includes(id) ? visible.filter((v) => v !== id) : [...visible, id];
    const ordered = DIRECTORY_COLUMNS.map((c) => c.id).filter((c) => next.includes(c));
    setVisible(ordered);
    writeStored(COLUMNS_KEY, JSON.stringify(ordered));
  };
  const changeDensity = (d: Density) => {
    setDensity(d);
    writeStored(DENSITY_KEY, d);
  };

  const exportCsv = useCallback(() => {
    const blob = new Blob([toCsv(shown, colIds)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [shown, colIds]);

  const focusRow = (index: number) => {
    virtualizer.scrollToIndex(index);
    window.setTimeout(() => {
      scrollRef.current?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)?.focus();
    }, 30);
  };
  const onRowKey = (e: KeyboardEvent<HTMLDivElement>, index: number, row: DirectoryRow) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openInspector(row.id);
    } else if (e.key === "ArrowDown" && index < shown.length - 1) {
      e.preventDefault();
      focusRow(index + 1);
    } else if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      focusRow(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusRow(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusRow(shown.length - 1);
    }
  };

  const typeChips = [
    { type: "accelerator", label: "Accelerators" },
    { type: "incubator", label: "Incubators" },
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-ink-2">
          <span className="num">{formatCount(shown.length)}</span> of{" "}
          <span className="num">{formatCount(rows.length)}</span> investors match the filters
          {area ? " and the map region" : ""}.
        </p>
        {area && (
          <Chip
            label={AREA_LABELS[area.layout]}
            count={shown.length}
            selected
            removable
            aria-label={`Remove the ${AREA_LABELS[area.layout].toLowerCase()} filter`}
            title="Brushed on the thesis map. Remove to list every investor again."
            onClick={() => void setArea(null)}
          />
        )}
        <div className="flex items-center gap-2" role="group" aria-label="Programme types">
          {typeChips.map((c) => (
            <Chip
              key={c.type}
              label={c.label}
              count={counts[c.type] ?? 0}
              selected={filters.type.includes(c.type)}
              onClick={() => toggle("type", c.type)}
            />
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            label="Row density"
            value={density}
            onChange={changeDensity}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 aria-hidden /> Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-2">
              <fieldset>
                <legend className="px-2 pb-1 text-sm text-ink-2">Show columns</legend>
                {DIRECTORY_COLUMNS.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-panel-sunk has-[:disabled]:cursor-default has-[:disabled]:text-muted"
                  >
                    <input
                      type="checkbox"
                      checked={visible.includes(c.id)}
                      disabled={c.required}
                      onChange={() => toggleColumn(c.id)}
                      className="accent-(--accent)"
                    />
                    {c.header}
                  </label>
                ))}
              </fieldset>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={shown.length === 0}>
            <Download aria-hidden /> Export CSV
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative h-[calc(100dvh-19.5rem)] min-h-80 overflow-auto rounded-xl border border-rule bg-panel"
      >
        <div
          role="table"
          aria-label="Investors"
          aria-rowcount={shown.length + 1}
          style={{ width: totalWidth, minWidth: "100%" }}
        >
          <div
            role="row"
            aria-rowindex={1}
            className="sticky top-0 z-10 grid border-b border-rule bg-panel-sunk text-sm text-ink-2"
            style={{ gridTemplateColumns: template }}
          >
            {colIds.map((id) => {
              const meta = META.get(id)!;
              const active = sortColumn === id;
              return (
                <div
                  key={id}
                  role="columnheader"
                  aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("flex min-w-0", meta.numeric && "justify-end")}
                >
                  <button
                    type="button"
                    onClick={() => onSort(id)}
                    className={cn(
                      "flex h-9 items-center gap-1 px-3 font-medium outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent",
                      active && "text-ink",
                    )}
                  >
                    {meta.header}
                    {active &&
                      (sortDir === "asc" ? (
                        <ChevronUp aria-hidden className="size-3.5" />
                      ) : (
                        <ChevronDown aria-hidden className="size-3.5" />
                      ))}
                  </button>
                </div>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <p className="p-6 text-sm text-ink-2">
              No investors match the current filters. Widen a filter to see more.
            </p>
          ) : (
            <div
              role="rowgroup"
              className="relative"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                const row = shown[item.index]!;
                return (
                  <div
                    key={row.id}
                    role="row"
                    tabIndex={0}
                    aria-rowindex={item.index + 2}
                    aria-selected={row.id === selectedId}
                    data-row-index={item.index}
                    onClick={() => openInspector(row.id)}
                    onKeyDown={(e) => onRowKey(e, item.index, row)}
                    className={cn(
                      "absolute left-0 grid w-full cursor-pointer items-center border-b border-rule/60 text-sm outline-none hover:bg-panel-sunk focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                      row.id === selectedId && "bg-accent-soft hover:bg-accent-soft",
                    )}
                    style={{
                      gridTemplateColumns: template,
                      height: item.size,
                      transform: `translateY(${item.start}px)`,
                    }}
                  >
                    {colIds.map((id) => (
                      <div
                        key={id}
                        role="cell"
                        className={cn(
                          "min-w-0 truncate px-3",
                          META.get(id)?.numeric && "text-right num",
                        )}
                      >
                        <Cell id={id} row={row} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
