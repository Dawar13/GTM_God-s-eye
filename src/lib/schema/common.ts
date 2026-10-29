import { z } from "zod";
import { Confidence, DatePrecision, SourceKind } from "./enums";

const SLUG = "[a-z0-9][a-z0-9_-]*";

/** Record ids are `<prefix>_<slug>`; see pipeline/atlas/ids.py for how they are built. */
export const idOf = (prefix: "inv" | "fund" | "co" | "rnd" | "anom" | "merge") =>
  z
    .string()
    .regex(new RegExp(`^${prefix}_${SLUG}$`))
    .describe(`Stable id, \`${prefix}_<slug>\``);

export const InvestorId = idOf("inv");
export const FundId = idOf("fund");
export const CompanyId = idOf("co");
export const RoundId = idOf("rnd");

export const IsoDate = z.iso.date().describe("ISO date, YYYY-MM-DD");

/** A date known to the year, month or day. Pair it with a DatePrecision field. */
export const PartialDate = z
  .string()
  .regex(/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/)
  .describe("YYYY, YYYY-MM or YYYY-MM-DD; precision is given alongside");

export const Url = z
  .string()
  .regex(/^https?:\/\/\S+$/)
  .describe("Absolute http(s) URL");

export const Usd = z.number().nonnegative().describe("US dollars (not millions)");

export const Year = z.number().int().min(1900).max(2100);

export const Source = z
  .strictObject({
    url: z
      .string()
      .regex(/^(https?:\/\/\S+|user_supplied:[a-z0-9_.-]+)$/)
      .describe(
        "Where the fact came from: an http(s) URL, or `user_supplied:<source_id>` for a user list with no link",
      ),
    title: z.string().nullable().describe("Page or document title, if known"),
    publisher: z.string().nullable().describe("Publisher or site, if known"),
    retrieved_at: IsoDate.describe("Date the source was read"),
    kind: SourceKind.describe("primary, secondary or user_supplied (PROJECT_CONTEXT §5)"),
  })
  .describe("Provenance for a record or a single fact");
export type Source = z.infer<typeof Source>;

/** Every record carries at least one source. */
export const Sources = z.array(Source).min(1).describe("At least one source; first is primary");

export const RecordConfidence = Confidence.describe(
  "high: primary source; medium: single secondary or user list with link; low: unverified lead",
);

/** Partial dates must be as long as their stated precision. */
export function partialDateMatchesPrecision(
  date: string | null,
  precision: z.infer<typeof DatePrecision> | null,
): boolean {
  if (date === null || precision === null) return date === null && precision === null;
  const expected = { year: 4, month: 7, day: 10 }[precision];
  return date.length === expected;
}
