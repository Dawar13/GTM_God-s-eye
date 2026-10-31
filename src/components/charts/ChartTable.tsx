"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TableColumn<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** Right-align numbers. */
  numeric?: boolean;
  /** Emphasise the column (used for founder ownership). */
  highlight?: boolean;
  /** Makes the column sortable by this value; null sorts last in both directions. */
  sortValue?: (row: T) => number | string | null;
};

type Sort = { column: string; dir: "asc" | "desc" };

/**
 * The accessible table behind a chart's "View as table" toggle. Numbers are tabular.
 * Columns with a `sortValue` get a sort button in their header (`aria-sort` on the header
 * cell); `limit` shows the first rows with a button for the rest, for very long tables.
 */
export function ChartTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  initialSort,
  limit,
}: {
  caption: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  initialSort?: Sort;
  limit?: number;
}) {
  const [sort, setSort] = useState<Sort | null>(initialSort ?? null);
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const col = sort ? columns.find((c) => c.header === sort.column) : undefined;
    if (!sort || !col?.sortValue) return rows;
    const value = col.sortValue;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return c * sign;
    });
  }, [rows, columns, sort]);

  const shown = limit !== undefined && !showAll ? sorted.slice(0, limit) : sorted;

  function toggle(c: TableColumn<T>) {
    setSort((s) =>
      s?.column === c.header
        ? { column: c.header, dir: s.dir === "asc" ? "desc" : "asc" }
        : { column: c.header, dir: c.numeric ? "desc" : "asc" },
    );
  }

  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-panel-sunk text-left text-ink-2">
          <tr>
            {columns.map((c) => {
              const active = sort?.column === c.header;
              return (
                <th
                  key={c.header}
                  scope="col"
                  aria-sort={
                    c.sortValue
                      ? active
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={cn(
                    "p-2 font-medium",
                    c.numeric && "text-right",
                    c.highlight && "bg-accent-soft",
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm hover:text-ink",
                        active && "text-ink",
                      )}
                    >
                      {c.header}
                      {active &&
                        (sort.dir === "asc" ? (
                          <ChevronUp aria-hidden className="size-3.5" />
                        ) : (
                          <ChevronDown aria-hidden className="size-3.5" />
                        ))}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={rowKey(r)} className="border-t border-rule">
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={cn(
                    "p-2",
                    c.numeric && "text-right font-condensed tabular-nums",
                    c.highlight && "bg-accent-soft font-semibold",
                  )}
                >
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length < sorted.length && (
        <button
          type="button"
          className="m-2 text-sm text-accent hover:underline"
          onClick={() => setShowAll(true)}
        >
          Show all <span className="tabular-nums">{formatCount(sorted.length)}</span> rows
        </button>
      )}
    </div>
  );
}
