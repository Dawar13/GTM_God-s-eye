"use client";

import { useState, type ReactNode } from "react";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";
import { Segmented } from "./Segmented";
import { Skeleton } from "./Skeleton";

export type ChartState =
  | { status: "ready" }
  | { status: "loading" }
  | { status: "empty"; message?: string; action?: ReactNode }
  | { status: "error"; message?: string; action?: ReactNode };

type View = "chart" | "table";

/** Records left out because a field is unknown. A null count is still being computed. */
export type NotShown = { count: number | null; field: string };

const isList = (n: NotShown | readonly NotShown[]): n is readonly NotShown[] => Array.isArray(n);

/**
 * Every chart sits in this frame (PHASE_2 §2.8): title, one-line subtitle, legend,
 * footnote with sources and the not-shown count, state handling, and a table alternative.
 */
export function ChartFrame({
  title,
  subtitle,
  legend,
  sources,
  notShown,
  filteredOut,
  state = { status: "ready" },
  tableAlternative,
  action,
  computed,
  height = 280,
  compact = false,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  legend?: ReactNode;
  /** Source domains behind the marks. */
  sources: readonly string[];
  /**
   * Records left out because a field is unknown. Pass 0 to say none were dropped. A list
   * counts each record once, under its first missing field.
   */
  notShown: NotShown | readonly NotShown[];
  /** Marks that exist but are hidden by the URL filters; counted apart from missing fields. */
  filteredOut?: number;
  state?: ChartState;
  /** The same data as an accessible table; enables "View as table". */
  tableAlternative?: ReactNode;
  /** A link or button to the full view, shown at the top right. */
  action?: ReactNode;
  /**
   * For calculator visuals: the marks come from the inputs, not from records, so the footnote
   * says that (this text) instead of listing sources and a not-shown count.
   */
  computed?: string;
  height?: number;
  /** For narrow hosts such as the Inspector: no panel border or padding, smaller title. */
  compact?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");
  const Wrapper = compact ? "section" : Panel;
  const showTable = view === "table" && tableAlternative !== undefined && state.status === "ready";

  return (
    <Wrapper className={cn("flex flex-col gap-3", className)}>
      <header className="flex items-start justify-between gap-4">
        <div>
          {compact ? (
            <h4 className="text-sm font-medium">{title}</h4>
          ) : (
            <h3 className="text-lg font-semibold">{title}</h3>
          )}
          <p className={cn("text-ink-2", compact ? "text-xs" : "text-sm")}>{subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {action}
          {tableAlternative !== undefined && state.status === "ready" && (
            <Segmented
              label={`${title} view`}
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Chart" },
                { value: "table", label: "View as table" },
              ]}
            />
          )}
        </div>
      </header>

      {legend && !showTable && <div>{legend}</div>}

      <div style={{ minHeight: height }} aria-busy={state.status === "loading"}>
        {state.status === "loading" && <Skeleton className="w-full" style={{ height }} />}
        {state.status === "empty" && (
          <EmptyState title="Nothing to show" action={state.action}>
            {state.message ?? "No records match the current filters. Widen a filter to see data."}
          </EmptyState>
        )}
        {state.status === "error" && (
          <EmptyState tone="error" title="This chart could not load" action={state.action}>
            {state.message ??
              "Reload the page. If it keeps failing, check the data validation output."}
          </EmptyState>
        )}
        {state.status === "ready" && (showTable ? tableAlternative : children)}
      </div>

      <footer className="border-t border-rule pt-2 text-xs text-muted">
        {computed !== undefined ? (
          <span>{computed}</span>
        ) : (
          <>
            <span>Sources: {sources.length ? sources.join(", ") : "none on record"}.</span>{" "}
            {filteredOut !== undefined && (
              <span className="tabular-nums">{formatCount(filteredOut)} hidden by filters. </span>
            )}
            {(isList(notShown) ? notShown : [notShown]).map((n) => (
              <span key={n.field} className="tabular-nums">
                {n.count === null
                  ? `Counting records missing ${n.field}. `
                  : `${formatCount(n.count)} not shown (missing ${n.field}). `}
              </span>
            ))}
          </>
        )}
      </footer>
    </Wrapper>
  );
}
