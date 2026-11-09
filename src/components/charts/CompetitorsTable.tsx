"use client";

import { Panel } from "@/components/ui-atlas";
import {
  formatCount,
  formatCountry,
  formatPartialDate,
  formatUsd,
  orUnknown,
  UNKNOWN,
} from "@/lib/format";
import { COMPETITOR_CATEGORY_LABELS, LAYER_LABELS, ROUND_STAGE_LABELS } from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import { COMPETITOR_CATEGORIES } from "@/lib/schema/enums";
import { LAYER_BANDS, type CompetitorRow } from "@/lib/viz/transforms/competitors";
import { ChartTable, type TableColumn } from "./ChartTable";

/** Competitors have no aliases on record, so the find box matches names only. */
const findName = (r: CompetitorRow) => r.name;

/** The Competitors table (S8): every competitor, sortable, a row click opens the Inspector. */
export function CompetitorsTable({ rows, sources }: { rows: readonly CompetitorRow[]; sources: readonly string[] }) {
  const { open } = useInspector();
  const columns: TableColumn<CompetitorRow>[] = [
    {
      header: "Name",
      sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <button
          type="button"
          onClick={() => open(r.id)}
          className="text-left font-medium text-accent hover:underline"
        >
          {r.name}
        </button>
      ),
    },
    {
      header: "Category",
      sortValue: (r) => COMPETITOR_CATEGORIES.indexOf(r.category),
      cell: (r) => COMPETITOR_CATEGORY_LABELS[r.category],
    },
    {
      header: "Layer",
      sortValue: (r) => LAYER_BANDS.indexOf(r.layer),
      cell: (r) => LAYER_LABELS[r.layer],
    },
    {
      header: "Founded",
      numeric: true,
      sortValue: (r) => r.foundedYear,
      cell: (r) => orUnknown(r.foundedYear),
    },
    {
      header: "HQ",
      sortValue: (r) => (r.hqCountry ? formatCountry(r.hqCountry) : null),
      cell: (r) => formatCountry(r.hqCountry),
    },
    {
      header: "Total raised",
      numeric: true,
      sortValue: (r) => r.totalRaisedUsd,
      cell: (r) => formatUsd(r.totalRaisedUsd),
    },
    {
      header: "Last round",
      sortValue: (r) => r.lastRound?.x ?? null,
      cell: (r) => {
        const l = r.lastRound;
        if (!l) return UNKNOWN;
        return (
          <span className="flex min-w-56 flex-col">
            <span className="tabular-nums">
              {formatPartialDate(l.date)} · {ROUND_STAGE_LABELS[l.stage]} · {formatUsd(l.amountUsd)}
            </span>
            <span className="text-xs text-ink-2">
              Lead: {l.leads.length ? l.leads.map((n) => n.name).join(", ") : UNKNOWN}
            </span>
          </span>
        );
      },
    },
    {
      header: "Headcount (approx.)",
      numeric: true,
      sortValue: (r) => r.headcount,
      cell: (r) => (r.headcount === null ? UNKNOWN : `~${formatCount(r.headcount)}`),
    },
    {
      header: "Revenue (reported)",
      numeric: true,
      sortValue: (r) => r.revenueUsd,
      cell: (r) => formatUsd(r.revenueUsd),
    },
    {
      header: "Investors",
      numeric: true,
      sortValue: (r) => r.investors.length,
      cell: (r) =>
        r.investors.length === 0 ? (
          UNKNOWN
        ) : (
          <details className="text-left">
            <summary className="cursor-pointer text-right tabular-nums hover:text-accent">
              {formatCount(r.investors.length)}
            </summary>
            <ul className="mt-1 flex max-w-56 flex-col gap-0.5 font-sans text-xs">
              {r.investors.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => open(i.id)}
                    className="text-left hover:text-accent hover:underline"
                  >
                    {i.name}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ),
    },
  ];

  return (
    <Panel className="flex flex-col gap-3" aria-labelledby="competitors-table-title">
      <header>
        <h3 id="competitors-table-title" className="text-lg font-semibold">
          All {formatCount(rows.length)} competitors
        </h3>
        <p className="text-sm text-ink-2">
          Click a column to sort and a row to open it. Headcount is approximate as stored; revenue is
          shown only where it was publicly reported, and {UNKNOWN} means unknown. Open the investor count
          to see names.
        </p>
      </header>
      <ChartTable
        caption="Competitors"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        initialSort={{ column: "Total raised", dir: "desc" }}
        onRowClick={(r) => open(r.id)}
        scrollClassName="max-h-[34rem]"
        findLabel="Find competitors"
        findText={findName}
      />
      <footer className="border-t border-rule pt-2 text-xs text-muted">
        Sources: {sources.length ? sources.join(", ") : "none on record"}. Total raised is the stored total
        for each competitor; last round is the latest dated round. Shown as {UNKNOWN} for{" "}
        <span className="tabular-nums">
          {formatCount(rows.filter((r) => r.foundedYear === null).length)} founded year,{" "}
          {formatCount(rows.filter((r) => r.totalRaisedUsd === null).length)} total raised,{" "}
          {formatCount(rows.filter((r) => r.lastRound === null).length)} last round,{" "}
          {formatCount(rows.filter((r) => r.headcount === null).length)} headcount,{" "}
          {formatCount(rows.filter((r) => r.revenueUsd === null).length)} revenue.
        </span>
      </footer>
    </Panel>
  );
}
