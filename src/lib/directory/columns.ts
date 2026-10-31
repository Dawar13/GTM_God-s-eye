/**
 * Directory column catalogue: ids, headers, widths, default visibility and the CSV
 * value(s) of each column. Pure, so the export is tested without a browser.
 */
import type { DirectoryRow } from "@/lib/data/directory";
import {
  FRESHNESS_LABELS,
  INVESTOR_STAGE_LABELS,
  INVESTOR_TYPE_LABELS,
  REGION_LABELS,
  TIER_LABELS,
} from "@/lib/format/labels";
import type { SortColumn } from "./sort";

export type CsvField = {
  header: string;
  /** Raw value; null = unknown, written as an empty cell (never "0" or "—"). */
  value: (row: DirectoryRow) => string | number | null;
};

export type DirectoryColumn = {
  id: SortColumn;
  header: string;
  /** Pixel width; the table scrolls sideways when the visible columns exceed the pane. */
  width: number;
  numeric?: boolean;
  defaultVisible: boolean;
  csv: readonly CsvField[];
  /** Name cannot be hidden: it is the row's label. */
  required?: boolean;
};

const roundFit = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export const DIRECTORY_COLUMNS: readonly DirectoryColumn[] = [
  {
    id: "name",
    header: "Name",
    width: 190,
    defaultVisible: true,
    required: true,
    csv: [{ header: "Name", value: (r) => r.name }],
  },
  {
    id: "type",
    header: "Type",
    width: 105,
    defaultVisible: true,
    csv: [{ header: "Type", value: (r) => (r.type ? INVESTOR_TYPE_LABELS[r.type] : null) }],
  },
  {
    id: "region",
    header: "Region",
    width: 75,
    defaultVisible: true,
    csv: [{ header: "Region", value: (r) => (r.region ? REGION_LABELS[r.region] : null) }],
  },
  {
    id: "stages",
    header: "Stages",
    width: 115,
    defaultVisible: true,
    csv: [
      {
        header: "Stages",
        value: (r) =>
          r.stages.length ? r.stages.map((s) => INVESTOR_STAGE_LABELS[s]).join("; ") : null,
      },
    ],
  },
  {
    id: "check",
    header: "Check range",
    width: 115,
    numeric: true,
    defaultVisible: true,
    csv: [
      { header: "Check min (USD)", value: (r) => r.checkMinUsd },
      { header: "Check max (USD)", value: (r) => r.checkMaxUsd },
    ],
  },
  {
    id: "fund",
    header: "Latest fund",
    width: 115,
    numeric: true,
    defaultVisible: true,
    csv: [
      { header: "Latest fund size (USD)", value: (r) => r.latestFundSizeUsd },
      { header: "Latest fund year", value: (r) => r.latestFundYear },
    ],
  },
  {
    id: "freshness",
    header: "Fund age",
    width: 95,
    defaultVisible: true,
    csv: [
      { header: "Fund age", value: (r) => (r.freshness ? FRESHNESS_LABELS[r.freshness] : null) },
    ],
  },
  {
    id: "tier",
    header: "Tier",
    width: 60,
    defaultVisible: true,
    csv: [{ header: "Tier", value: (r) => (r.tier ? TIER_LABELS[r.tier] : null) }],
  },
  {
    id: "fit",
    header: "Fit",
    width: 175,
    numeric: true,
    defaultVisible: true,
    csv: [
      { header: "Fit score (0-100)", value: (r) => roundFit(r.fit) },
      {
        header: "Fit coverage (%)",
        value: (r) => (r.fitCoverage === null ? null : Math.round(r.fitCoverage * 100)),
      },
      { header: "Fit flags", value: (r) => (r.fitFlags.length ? r.fitFlags.join("; ") : null) },
    ],
  },
  {
    id: "sources",
    header: "Sources",
    width: 70,
    numeric: true,
    defaultVisible: true,
    csv: [{ header: "Sources", value: (r) => r.sourceCount }],
  },
  {
    id: "seedLists",
    header: "Seed lists",
    width: 80,
    numeric: true,
    defaultVisible: false,
    csv: [{ header: "Seed lists", value: (r) => r.seedListCount }],
  },
  {
    id: "confidence",
    header: "Confidence",
    width: 90,
    defaultVisible: false,
    csv: [{ header: "Confidence", value: (r) => r.confidence }],
  },
];

export const DEFAULT_VISIBLE: SortColumn[] = DIRECTORY_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.id,
);
