/**
 * CSV export of the Directory's current view (RFC 4180): UTF-8 with a byte-order mark so
 * Excel reads it, CRLF between records, fields quoted when they hold a comma, quote or line
 * break, and quotes doubled. Unknown values are empty cells. A text cell that starts with
 * = + - @ (or a tab or CR) gets a leading apostrophe so a spreadsheet does not run it as a
 * formula; numbers are never touched.
 */
import type { DirectoryRow } from "@/lib/data/directory";
import { DIRECTORY_COLUMNS, type DirectoryColumn } from "./columns";
import type { SortColumn } from "./sort";

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Rows as CSV text: a header line, then one line per row, for the visible columns in table order. */
export function toCsv(
  rows: readonly DirectoryRow[],
  visible: readonly SortColumn[],
  columns: readonly DirectoryColumn[] = DIRECTORY_COLUMNS,
): string {
  const fields = columns.filter((c) => visible.includes(c.id)).flatMap((c) => c.csv);
  const lines = [
    fields.map((f) => csvCell(f.header)).join(","),
    ...rows.map((r) => fields.map((f) => csvCell(f.value(r))).join(",")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** A header and rows as CSV text, same rules as `toCsv` (BOM, CRLF, quoting, formula guard). */
export function buildCsv(
  header: readonly string[],
  rows: readonly (string | number | null)[][],
): string {
  const lines = [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** capital-atlas-targets-2026-10-31.csv */
export function targetsFilename(date: Date = new Date()): string {
  return `capital-atlas-targets-${date.toISOString().slice(0, 10)}.csv`;
}

/** capital-atlas-investors-2026-10-31.csv */
export function csvFilename(date: Date = new Date()): string {
  return `capital-atlas-investors-${date.toISOString().slice(0, 10)}.csv`;
}
