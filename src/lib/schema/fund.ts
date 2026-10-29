import { z } from "zod";
import { DatePrecision } from "./enums";
import {
  FundId,
  InvestorId,
  PartialDate,
  RecordConfidence,
  Sources,
  Usd,
  Year,
  partialDateMatchesPrecision,
} from "./common";

export const Fund = z
  .strictObject({
    id: FundId,
    investor_id: InvestorId,
    name: z.string().min(1).describe("Fund name as the source gives it"),
    number: z
      .string()
      .regex(/^[IVXLC]+$/)
      .nullable()
      .describe("Fund number in Roman numerals: I, II, …"),
    size_usd: Usd.nullable(),
    currency_original: z.string().length(3).nullable().describe("ISO 4217 code as announced"),
    size_original: z.number().nonnegative().nullable().describe("Size in the announced currency"),
    close_date: PartialDate.nullable().describe("Announced or closed"),
    close_date_precision: DatePrecision.nullable(),
    vintage_year: Year.nullable(),
    location: z.string().nullable().describe("Location as the source gives it"),
    notes: z.string().nullable().describe("Source notes that are not a link"),
    sources: Sources,
    confidence: RecordConfidence,
  })
  .refine((f) => partialDateMatchesPrecision(f.close_date, f.close_date_precision), {
    message: "close_date length must match close_date_precision",
    path: ["close_date"],
  })
  .describe("One fund (vehicle) raised by an investor");
export type Fund = z.infer<typeof Fund>;
