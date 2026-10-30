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
  state = { status: "ready" },
  tableAlternative,
  action,
  height = 280,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  legend?: ReactNode;
  /** Source domains behind the marks. */
  sources: readonly string[];
  /** Records left out because a field is unknown. Pass 0 to say none were dropped. */
  notShown: { count: number; field: string };
  state?: ChartState;
  /** The same data as an accessible table; enables "View as table". */
  tableAlternative?: ReactNode;
  /** A link or button to the full view, shown at the top right. */
  action?: ReactNode;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");
  const showTable = view === "table" && tableAlternative !== undefined && state.status === "ready";

  return (
    <Panel className={cn("flex flex-col gap-3", className)}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-ink-2">{subtitle}</p>
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
        <span>Sources: {sources.length ? sources.join(", ") : "none on record"}.</span>{" "}
        <span className="tabular-nums">
          {formatCount(notShown.count)} not shown (missing {notShown.field}).
        </span>
      </footer>
    </Panel>
  );
}
