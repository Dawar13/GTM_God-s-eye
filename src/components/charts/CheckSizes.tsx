"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChartFrame, Segmented, VizTooltip } from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { loadFilterIndex, useLoaded } from "@/lib/client-index";
import { useFilters } from "@/lib/filters/use-filters";
import { formatCount, formatUsd, UNKNOWN } from "@/lib/format";
import { useInspector } from "@/lib/hooks/useInspector";
import { cn } from "@/lib/utils";
import {
  checkDomain,
  checkPosition,
  checkTicks,
  checkView,
  rangeText,
  tickLabel,
  type BasisFilter,
  type CheckOrder,
  type CheckData,
  type CheckRow,
} from "@/lib/viz/transforms/checkSizes";
import { ChartTable } from "./ChartTable";

/** Rows drawn at first and per "Show more". */
const PAGE = 100;
/** Name, axis, fund columns; the same template draws the gridlines behind the rows. */
const COLUMNS =
  "grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_4rem] sm:grid-cols-[13rem_minmax(0,1fr)_5.5rem]";
const COLOR = { researched: "var(--viz-researched)", listed: "var(--viz-listed)" } as const;

const pct = (t: number) => `${t * 100}%`;

function Bar({ row, domain }: { row: CheckRow; domain: [number, number] }) {
  const color = COLOR[row.basis];
  const at = (v: number) => checkPosition(v, domain);
  const listed = row.basis === "listed";
  // Researched: a solid bar. As listed: an outlined bar with a light fill (not colour alone).
  const body: CSSProperties = listed
    ? { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)` }
    : { borderColor: color, backgroundColor: color };
  const dot = (v: number) => (
    <span
      className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
      style={{ left: pct(at(v)), ...body }}
    />
  );

  if (row.min !== null && row.max !== null) {
    const left = at(row.min);
    const width = at(row.max) - left;
    return (
      <>
        {width <= 0 ? (
          dot(row.min)
        ) : (
          <span
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full border"
            style={{ left: pct(left), width: pct(width), minWidth: 6, ...body }}
          />
        )}
        {row.p25 !== null && row.p75 !== null && (
          <span
            className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm"
            style={{
              left: pct(at(row.p25)),
              width: pct(Math.max(at(row.p75) - at(row.p25), 0)),
              minWidth: 4,
              backgroundColor: color,
            }}
          />
        )}
      </>
    );
  }
  // One bound: a dot there and a dashed line to the open end of the axis.
  const v = (row.min ?? row.max)!;
  const open = row.min !== null ? { left: pct(at(v)), right: 0 } : { left: 0, width: pct(at(v)) };
  return (
    <>
      <span
        className="absolute top-1/2 -translate-y-1/2 border-t-2 border-dashed"
        style={{ ...open, borderColor: color }}
      />
      {dot(v)}
    </>
  );
}

function RowTip({ row }: { row: CheckRow }) {
  return (
    <VizTooltip
      title={row.name}
      value={rangeText(row.min, row.max)}
      period={row.basis === "listed" ? row.list : "Researched check range"}
      confidence={row.confidence}
      sourceDomain={row.sourceDomain}
    >
      {row.firstCheck && <p>First checks, as the list states them.</p>}
      {row.p25 !== null && row.p75 !== null && (
        <p>Middle half of recent checks: {rangeText(row.p25, row.p75)}</p>
      )}
      <p>
        Latest fund:{" "}
        {row.fundUsd === null
          ? "not known"
          : `${formatUsd(row.fundUsd)}${row.fundListed ? " (as listed)" : ""}`}
      </p>
      {row.basis === "listed" && (
        <p className="mt-1 text-xs">
          {row.listedText ? `As listed: ${row.listedText}. ` : ""}Not verified.
        </p>
      )}
    </VizTooltip>
  );
}

function Swatch({ basis, label }: { basis: "researched" | "listed"; label: string }) {
  const color = COLOR[basis];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-2 w-7 rounded-full border"
        style={{
          borderColor: color,
          backgroundColor:
            basis === "listed" ? `color-mix(in srgb, ${color} 22%, transparent)` : color,
        }}
      />
      {label}
    </span>
  );
}

export function CheckSizes({ data }: { data: CheckData }) {
  const { filters } = useFilters();
  const { id: selectedId, open } = useInspector();
  const universe = useLoaded("filter-index", loadFilterIndex);
  const [basis, setBasis] = useState<BasisFilter>("all");
  const [order, setOrder] = useState<CheckOrder>("smallest");
  const [limit, setLimit] = useState(PAGE);
  const [tipId, setTipId] = useState<string | null>(null);

  const view = useMemo(
    () =>
      checkView(data, filters, basis, order, universe.status === "ready" ? universe.data : null),
    [data, filters, basis, order, universe],
  );
  const domain = useMemo(() => checkDomain(data.extent), [data.extent]);
  const ticks = useMemo(() => checkTicks(domain), [domain]);
  const shown = view.rows.slice(0, limit);

  const legend = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2">
      <Swatch basis="researched" label="Researched, with a cited source" />
      <Swatch basis="listed" label="As one of your lists states it (not verified)" />
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block h-3.5 w-3 rounded-sm"
          style={{ backgroundColor: COLOR.listed }}
        />
        Middle half of recent checks
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block w-7 border-t-2 border-dashed"
          style={{ borderColor: "var(--ink-2)" }}
        />
        Only one end known
      </span>
    </div>
  );

  const axis = (
    <div
      className={cn(
        COLUMNS,
        "sticky top-0 z-20 border-b border-rule bg-panel pb-1 text-xs text-muted",
      )}
    >
      <span className="self-end">Investor</span>
      <div className="relative h-8">
        <span className="absolute top-0 left-0 text-ink-2">Check size, US$ (log scale)</span>
        {ticks.map((t) => (
          <span
            key={t.value}
            className={cn(
              "absolute bottom-0 -translate-x-1/2 tabular-nums",
              !t.major && "hidden md:inline",
            )}
            style={{ left: pct(checkPosition(t.value, domain)) }}
          >
            {tickLabel(t.value)}
          </span>
        ))}
      </div>
      <span className="self-end text-right">Latest fund</span>
    </div>
  );

  return (
    <ChartFrame
      title="Check sizes"
      subtitle="One row per investor: its smallest to largest check on a log scale. Researched ranges are solid; ranges your lists state are outlined and not verified. Click a row to open the investor."
      legend={legend}
      sources={view.sources}
      filteredOut={view.filteredOut}
      notShown={{ count: view.notShown, field: "a check size" }}
      state={
        view.rows.length === 0
          ? {
              status: "empty",
              message:
                "No investor with a known check size matches the current filters. Widen a filter, or switch to all sources.",
            }
          : { status: "ready" }
      }
      height={320}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented
            label="Which check ranges"
            value={basis}
            onChange={(v) => {
              setBasis(v);
              setLimit(PAGE);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "researched", label: `Researched (${formatCount(view.counts.researched)})` },
              { value: "listed", label: `From lists (${formatCount(view.counts.listed)})` },
            ]}
          />
          <Segmented
            label="Order"
            value={order}
            onChange={setOrder}
            options={[
              { value: "smallest", label: "Smallest first" },
              { value: "largest", label: "Largest first" },
              { value: "name", label: "A to Z" },
            ]}
          />
        </div>
      }
      tableAlternative={
        <ChartTable
          caption="Check sizes"
          rows={view.rows}
          rowKey={(r) => r.id}
          limit={200}
          onRowClick={(r) => open(r.id)}
          columns={[
            {
              header: "Investor",
              cell: (r) => (
                <button
                  type="button"
                  className="text-left text-accent hover:underline"
                  onClick={() => open(r.id)}
                >
                  {r.name}
                </button>
              ),
            },
            {
              header: "Smallest check",
              numeric: true,
              cell: (r) => formatUsd(r.min),
              sortValue: (r) => r.min ?? -1,
            },
            {
              header: "Largest check",
              numeric: true,
              cell: (r) => formatUsd(r.max),
              sortValue: (r) => r.max ?? -1,
            },
            {
              header: "Middle half",
              numeric: true,
              cell: (r) => (r.p25 !== null && r.p75 !== null ? rangeText(r.p25, r.p75) : UNKNOWN),
            },
            {
              header: "Latest fund",
              numeric: true,
              cell: (r) =>
                r.fundUsd === null
                  ? UNKNOWN
                  : `${formatUsd(r.fundUsd)}${r.fundListed ? " (listed)" : ""}`,
              sortValue: (r) => r.fundUsd ?? -1,
            },
            {
              header: "Source",
              cell: (r) => (r.basis === "listed" ? `${r.list} (not verified)` : "Researched"),
            },
          ]}
        />
      }
    >
      <div className="relative">
        {axis}
        {/* Gridlines behind the rows, in the axis column. */}
        <div
          className={cn(COLUMNS, "pointer-events-none absolute inset-x-0 top-9 bottom-0")}
          aria-hidden
        >
          <span />
          <div className="relative">
            {ticks.map((t) => (
              <span
                key={t.value}
                className={cn(
                  "absolute inset-y-0 border-l",
                  t.major ? "border-rule" : "hidden border-rule/60 md:block",
                )}
                style={{ left: pct(checkPosition(t.value, domain)) }}
              />
            ))}
          </div>
        </div>
        <ul aria-label="Check sizes by investor">
          {shown.map((row) => {
            const selected = row.id === selectedId;
            return (
              <li
                key={row.id}
                className={cn(COLUMNS, "relative h-7 items-center", selected && "bg-accent-soft")}
                onMouseEnter={() => setTipId(row.id)}
                onMouseLeave={() => setTipId((id) => (id === row.id ? null : id))}
              >
                <button
                  type="button"
                  className="truncate pr-2 text-left text-sm hover:underline focus-visible:underline"
                  title={row.name}
                  onClick={() => open(row.id)}
                  onFocus={() => setTipId(row.id)}
                  onBlur={() => setTipId((id) => (id === row.id ? null : id))}
                  aria-label={`${row.name}: ${rangeText(row.min, row.max)}${row.basis === "listed" ? `, as ${row.list} states it` : ", researched"}. Open the investor.`}
                >
                  {row.name}
                </button>
                {/* The name button is the keyboard and screen-reader way in; the marks are
                    hidden from assistive tech, the tooltip is not. */}
                <div className="relative h-full cursor-pointer" onClick={() => open(row.id)}>
                  <span className="absolute inset-0" aria-hidden>
                    <Bar row={row} domain={domain} />
                  </span>
                  {tipId === row.id && (
                    <div
                      className="pointer-events-none absolute top-full z-30 mt-1"
                      style={{
                        left: pct(Math.min(checkPosition(row.min ?? row.max!, domain), 0.55)),
                      }}
                    >
                      <RowTip row={row} />
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "text-right text-sm tabular-nums",
                    row.fundListed ? "text-muted" : "text-ink-2",
                  )}
                >
                  {row.fundUsd === null ? UNKNOWN : formatUsd(row.fundUsd)}
                </span>
              </li>
            );
          })}
        </ul>
        {view.rows.length > shown.length && (
          <div className="flex items-center gap-3 border-t border-rule pt-3 text-sm text-ink-2">
            <span className="tabular-nums">
              Showing {formatCount(shown.length)} of {formatCount(view.rows.length)}.
            </span>
            <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
              Show {formatCount(Math.min(PAGE, view.rows.length - shown.length))} more
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLimit(view.rows.length)}>
              Show all
            </Button>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          Fund sizes in lighter text are as a list states them. Map of the Money&apos;s figures are
          first checks; the other lists give check sizes in general.
        </p>
      </div>
    </ChartFrame>
  );
}
