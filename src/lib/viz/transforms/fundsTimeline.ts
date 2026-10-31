import type { Confidence, Fund } from "@/lib/schema";
import { provenanceOf } from "./common";

export type FundPoint = {
  id: string;
  name: string;
  /** Close date as stored (year, month or day precision), else the vintage year. */
  date: string;
  /** True when `date` is the vintage year because no close date is on record. */
  dateIsVintage: boolean;
  sizeUsd: number;
  sourceDomain: string | null;
  confidence: Confidence | null;
};

export type FundNotPlotted = {
  id: string;
  name: string;
  /** What is missing. */
  missing: "size" | "date" | "size and date";
  sizeUsd: number | null;
  date: string | null;
};

export type FundsTimeline = {
  /** Oldest first. Only funds with both a size and a date. */
  points: FundPoint[];
  notPlotted: FundNotPlotted[];
  sources: string[];
};

/**
 * One investor's funds as bars of size over close date, oldest first. A fund with no size or
 * no date is listed in `notPlotted` with what is missing; it is never drawn as a zero.
 * The x position is the close date as stored, falling back to the vintage year.
 */
export function fundsTimeline(funds: readonly Fund[]): FundsTimeline {
  const points: FundPoint[] = [];
  const notPlotted: FundNotPlotted[] = [];
  for (const f of funds) {
    const date = f.close_date ?? (f.vintage_year === null ? null : String(f.vintage_year));
    if (f.size_usd !== null && date !== null) {
      points.push({
        id: f.id,
        name: f.name,
        date,
        dateIsVintage: f.close_date === null,
        sizeUsd: f.size_usd,
        ...provenanceOf([f]),
      });
    } else {
      notPlotted.push({
        id: f.id,
        name: f.name,
        missing: f.size_usd === null ? (date === null ? "size and date" : "size") : "date",
        sizeUsd: f.size_usd,
        date,
      });
    }
  }
  points.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  notPlotted.sort((a, b) => a.name.localeCompare(b.name));
  const sources = [
    ...new Set(
      funds
        .filter((f) => points.some((p) => p.id === f.id))
        .map((f) => provenanceOf([f]).sourceDomain?.split(" +")[0])
        .filter((d): d is string => !!d),
    ),
  ];
  return { points, notPlotted, sources };
}
