"use client";

import { useMemo } from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { cn } from "cn";
import type { DirectoryRow } from "@/lib/data/directory";
import { formatUsd, UNKNOWN } from "@/lib/format";
import { REGION_LABELS } from "@/lib/format/labels";
import { applyFilters } from "@/lib/filters";
import { useFilters } from "@/lib/filters/use-filters";
import { useInspector } from "@/lib/hooks/useInspector";

// Phase 0: proves the data path. Phase 2 replaces this with the full directory.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
});
const helper = createColumnHelper<typeof features, DirectoryRow>();

const columns = helper.columns([
  helper.accessor("name", { header: "Name", sortFn: "text" }),
  helper.accessor((r) => r.region ?? undefined, {
    id: "region",
    header: "Region",
    sortFn: "text",
    sortUndefined: "last",
    cell: (info) => {
      const region = info.getValue();
      return region ? REGION_LABELS[region] : UNKNOWN;
    },
  }),
  helper.accessor((r) => r.latestFundSizeUsd ?? undefined, {
    id: "latestFundSizeUsd",
    header: "Latest fund",
    sortFn: "basic",
    sortUndefined: "last",
    cell: (info) => formatUsd(info.getValue()),
  }),
  helper.accessor((r) => r.latestFundYear ?? undefined, {
    id: "latestFundYear",
    header: "Fund year",
    sortFn: "basic",
    sortUndefined: "last",
    cell: (info) => info.getValue() ?? UNKNOWN,
  }),
  helper.accessor("seedListCount", { header: "Seed lists", sortFn: "basic" }),
  // Phase 1 sanity columns (PHASE_1 §9.4); Phase 2 designs the real directory.
  helper.accessor((r) => r.tier ?? undefined, {
    id: "tier",
    header: "Tier",
    sortFn: "text",
    sortUndefined: "last",
    cell: (info) => info.getValue() ?? UNKNOWN,
  }),
  helper.accessor((r) => r.fit ?? undefined, {
    id: "fit",
    header: "Fit",
    sortFn: "basic",
    sortUndefined: "last",
    cell: (info) => {
      const row = info.row.original;
      if (row.fit === null) return UNKNOWN;
      const coverage =
        row.fitCoverage === null ? "" : ` (${Math.round(row.fitCoverage * 100)}% known)`;
      const flags = row.fitFlags.length ? ` · ${row.fitFlags.join(", ")}` : "";
      return `${row.fit.toFixed(1)}${coverage}${flags}`;
    },
  }),
  helper.accessor("sourceCount", { header: "Sources", sortFn: "basic" }),
  helper.accessor("confidence", { header: "Confidence", sortFn: "text" }),
]);

const NUMERIC = new Set([
  "latestFundSizeUsd",
  "latestFundYear",
  "seedListCount",
  "fit",
  "sourceCount",
]);

export function DirectoryTable({ rows }: { rows: DirectoryRow[] }) {
  // The same applyFilters the filter bar's chip counts use, so the two always agree.
  const { filters } = useFilters();
  const shown = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const table = useTable({ features, columns, data: shown });
  const { id: selectedId, open: openInspector } = useInspector();

  const open = (row: DirectoryRow) => openInspector(row.id);

  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-xs text-ink-2">
        <span className="num">{shown.length.toLocaleString("en-US")}</span> of{" "}
        <span className="num">{rows.length.toLocaleString("en-US")}</span> investors match the
        filters. Select a name to inspect it.
      </p>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-b border-rule text-left">
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                    }
                    className={cn(
                      "py-2 pr-4 font-medium text-ink-2",
                      NUMERIC.has(header.column.id) && "text-right",
                    )}
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="hover:text-ink"
                    >
                      <table.FlexRender header={header} />
                      {sorted ? (sorted === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => open(row.original)}
              className={cn(
                "cursor-pointer border-b border-rule/60 hover:bg-panel-sunk",
                row.original.id === selectedId && "bg-accent-soft",
              )}
            >
              {row.getAllCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn("py-1.5 pr-4", NUMERIC.has(cell.column.id) && "text-right num")}
                >
                  {cell.column.id === "name" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        open(row.original);
                      }}
                      className="text-left hover:underline"
                    >
                      {row.original.name}
                    </button>
                  ) : (
                    <table.FlexRender cell={cell} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
