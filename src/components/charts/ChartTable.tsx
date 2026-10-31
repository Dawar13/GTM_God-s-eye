import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TableColumn<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** Right-align numbers. */
  numeric?: boolean;
  /** Emphasise the column (used for founder ownership). */
  highlight?: boolean;
};

/** The accessible table behind a chart's "View as table" toggle. Numbers are tabular. */
export function ChartTable<T>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
}) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-panel-sunk text-left text-ink-2">
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={cn(
                  "p-2 font-medium",
                  c.numeric && "text-right",
                  c.highlight && "bg-accent-soft",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
    </div>
  );
}
