"use client";

import {
  cloneElement,
  Fragment,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FindBox, FindMark } from "@/components/ui-atlas/FindBox";
import { formatCount } from "@/lib/format";
import { useFindQuery } from "@/lib/search/find-state";
import { matchRecord, type Searchable } from "@/lib/search/match";
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

type Walkable = ReactElement<{ children?: ReactNode }>;
/** Host elements and fragments: their text children can be read and marked. */
const walkable = (node: ReactNode): node is Walkable =>
  isValidElement(node) && (typeof node.type === "string" || node.type === Fragment);

/** "Find in capital bubbles"; long captions read "Find in table". */
function defaultFindLabel(caption: string): string {
  if (caption.length > 40) return "Find in table";
  const lower = /^[A-Z][a-z]/.test(caption) ? caption[0]!.toLowerCase() + caption.slice(1) : caption;
  return `Find in ${lower}`;
}

/** The plain text a cell renders (host elements only; components contribute nothing). */
function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  return walkable(node) ? nodeText(node.props.children) : "";
}

/** The cell with the find query marked in its text, keeping its elements and handlers. */
function markNode(node: ReactNode, query: string): ReactNode {
  if (typeof node === "string") return <FindMark text={node} query={query} />;
  if (Array.isArray(node))
    return node.map((n, k) => <Fragment key={k}>{markNode(n, query)}</Fragment>);
  if (walkable(node) && node.props.children !== undefined)
    return cloneElement(node, undefined, markNode(node.props.children, query));
  return node;
}

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
  onRowClick,
  scrollClassName = "max-h-80",
  findLabel,
  findText,
}: {
  caption: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  initialSort?: Sort;
  limit?: number;
  /** Makes each row clickable (mouse); put a button in a cell too so keyboards can do the same. */
  onRowClick?: (row: T) => void;
  /** Height cap of the scrolling area. */
  scrollClassName?: string;
  /** Accessible name of the find box; defaults to "Find in <caption>" (short captions). */
  findLabel?: string;
  /**
   * What the find box matches per row (a name and aliases). By default the text of every
   * non-numeric column, the first one counting as the name.
   */
  findText?: (row: T) => Searchable;
}) {
  const [sort, setSort] = useState<Sort | null>(initialSort ?? null);
  const [showAll, setShowAll] = useState(false);
  const find = useFindQuery();
  const q = find.query.trim();
  const textCols = columns.filter((c) => !c.numeric);
  // A find box only where there is text to find in and more than one row.
  const findable = textCols.length > 0 && rows.length > 1;

  const found = useMemo(() => {
    if (!q) return rows;
    const text =
      findText ??
      ((r: T) => {
        const [name = "", ...rest] = textCols.map((c) => nodeText(c.cell(r)));
        return { name, aliases: rest };
      });
    return rows.filter((r) => matchRecord(q, text(r)) !== null);
    // textCols derives from columns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, q, findText]);

  const sorted = useMemo(() => {
    const col = sort ? columns.find((c) => c.header === sort.column) : undefined;
    if (!sort || !col?.sortValue) return found;
    const value = col.sortValue;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...found].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return c * sign;
    });
  }, [found, columns, sort]);

  const shown = limit !== undefined && !showAll ? sorted.slice(0, limit) : sorted;

  function toggle(c: TableColumn<T>) {
    setSort((s) =>
      s?.column === c.header
        ? { column: c.header, dir: s.dir === "asc" ? "desc" : "asc" }
        : { column: c.header, dir: c.numeric ? "desc" : "asc" },
    );
  }

  const table = (
    <div className={cn("overflow-auto", scrollClassName)}>
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
            <tr
              key={rowKey(r)}
              className={cn("border-t border-rule", onRowClick && "cursor-pointer hover:bg-panel-sunk")}
              onClick={
                onRowClick
                  ? (e) => {
                      // Buttons, links and disclosure widgets inside a row keep their own action.
                      if ((e.target as HTMLElement).closest("button, a, summary, details")) return;
                      onRowClick(r);
                    }
                  : undefined
              }
            >
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={cn(
                    "p-2",
                    c.numeric && "text-right font-condensed tabular-nums",
                    c.highlight && "bg-accent-soft font-semibold",
                  )}
                >
                  {q && !c.numeric ? markNode(c.cell(r), q) : c.cell(r)}
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
      {q && found.length === 0 && (
        <p className="p-3 text-sm text-ink-2">Nothing in this table matches “{q}”.</p>
      )}
    </div>
  );

  if (!findable) return table;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex justify-end">
        <FindBox
          label={findLabel ?? defaultFindLabel(caption)}
          value={find.input}
          onValueChange={find.setInput}
          matches={found.length}
          total={rows.length}
        />
      </div>
      {table}
    </div>
  );
}
