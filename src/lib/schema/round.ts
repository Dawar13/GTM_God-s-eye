import { z } from "zod";
import { DatePrecision, RoundStage } from "./enums";
import {
  CompanyId,
  InvestorId,
  PartialDate,
  RecordConfidence,
  RoundId,
  Sources,
  Usd,
  partialDateMatchesPrecision,
} from "./common";

export const Round = z
  .strictObject({
    id: RoundId,
    company_id: CompanyId,
    date: PartialDate.nullable(),
    date_precision: DatePrecision.nullable(),
    stage: RoundStage,
    stage_raw: z.string().nullable().describe("Round label as the source gives it"),
    amount_usd: Usd.nullable(),
    valuation_post_usd: Usd.nullable(),
    lead_investor_ids: z.array(InvestorId),
    participant_investor_ids: z.array(InvestorId),
    unspecified_investor_ids: z
      .array(InvestorId)
      .describe("Investors the source names without saying whether they led"),
    notes: z.string().nullable(),
    sources: Sources,
    confidence: RecordConfidence,
  })
  .refine((r) => partialDateMatchesPrecision(r.date, r.date_precision), {
    message: "date length must match date_precision",
    path: ["date"],
  })
  .refine(
    (r) => {
      const all = [
        ...r.lead_investor_ids,
        ...r.participant_investor_ids,
        ...r.unspecified_investor_ids,
      ];
      return new Set(all).size === all.length;
    },
    { message: "an investor can hold only one role in a round", path: ["lead_investor_ids"] },
  )
  .describe("One financing round of one company");
export type Round = z.infer<typeof Round>;
