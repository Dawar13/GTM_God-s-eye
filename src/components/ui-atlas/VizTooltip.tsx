import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SourceBadge, type ConfidenceLevel } from "./SourceBadge";

/**
 * Tooltip body for every mark (PHASE_2 §2.5): exact value with units, date or period,
 * confidence and source domain. Charts position it; this only renders the content.
 */
export function VizTooltip({
  title,
  value,
  period,
  confidence,
  sourceDomain,
  children,
  className,
}: {
  title: string;
  /** Exact value, already formatted with units (src/lib/format). */
  value: string;
  /** "Mar 2026", "FY2025" or a range. */
  period?: string | null;
  confidence: ConfidenceLevel | null | undefined;
  sourceDomain: string | null | undefined;
  /** Extra rows, such as the size encoding. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tooltip"
      className={cn(
        "max-w-64 min-w-44 rounded-md border border-rule bg-panel p-3 text-sm shadow-float",
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {period && <p className="text-ink-2 tabular-nums">{period}</p>}
      {children && <div className="mt-1 text-ink-2">{children}</div>}
      <div className="mt-2 border-t border-rule pt-2">
        {sourceDomain ? (
          <SourceBadge domain={sourceDomain} confidence={confidence} />
        ) : (
          <span className="text-xs text-muted">No source on record</span>
        )}
      </div>
    </div>
  );
}
