import { z } from "zod";
import {
  CompetitorCategory,
  CompetitorLayer,
  DatePrecision,
  InvestorStage,
  InvestorType,
  ResearchTier,
  RoundStage,
  Sector,
  SectorClassifiedBy,
  YesNoUnknown,
} from "./enums";
import { IsoDate, PartialDate, Url, partialDateMatchesPrecision } from "./common";

/**
 * Research cache files (data/research/cache/<key>.json), written by research
 * agents and merged into data/processed/ by the pipeline (atlas/enrich/research.py).
 * See data/research/README.md for the protocol. Confidence is not written here:
 * the pipeline derives it from the kinds of pages that support each fact.
 */

export const PAGE_KINDS = ["primary", "press", "database"] as const;

export const ResearchPage = z.strictObject({
  url: Url,
  title: z.string().nullable(),
  publisher: z.string().nullable(),
  retrieved_at: IsoDate,
  kind: z
    .enum(PAGE_KINDS)
    .describe(
      "primary: the entity's own site, fund announcement, SEC/regulator filing; press: reputable media; database: Crunchbase/Tracxn/PitchBook public pages (hints only)",
    ),
});

/** Every extracted value names the pages that support it and a ≤ 25-word snippet. */
function fact<T extends z.ZodType>(value: T) {
  return z.strictObject({
    value,
    pages: z.array(z.number().int().nonnegative()).min(1).describe("Indexes into pages"),
    snippet: z
      .string()
      .refine((s) => s.trim().split(/\s+/).length <= 25, "snippet must be ≤ 25 words")
      .describe("Supporting text from the page, ≤ 25 words, internal verification only"),
  });
}

const Money = z.number().nonnegative();

export const ResearchFund = z.strictObject({
  name: z.string().min(1),
  number: z
    .string()
    .regex(/^[IVXLC]+$/)
    .nullable(),
  size_original: Money.nullable(),
  currency_original: z.string().length(3).nullable(),
  close_date: PartialDate.nullable(),
  date_precision: DatePrecision.nullable(),
  pages: z.array(z.number().int().nonnegative()).min(1),
  snippet: z.string(),
});

export const ResearchPartner = z.strictObject({
  name: z.string().min(1),
  title: z.string().nullable(),
  focus_sectors: z.array(Sector),
  linkedin_url: Url.nullable().describe("Public profile URL as linked from the firm's site"),
  pages: z.array(z.number().int().nonnegative()).min(1),
});

export const ResearchCompany = z.strictObject({
  name: z.string().min(1),
  website: Url.nullable(),
  description: z.string().nullable().describe("Paraphrased, one line"),
  hq_country: z.string().length(2).nullable(),
  founded_year: z.number().int().nullable(),
  sector: Sector.nullable(),
  sector_classified_by: SectorClassifiedBy.nullable(),
  layer: CompetitorLayer.nullable().describe("Only for industrial / robotics / hardware tooling"),
});

export const ResearchRound = z
  .strictObject({
    company: ResearchCompany,
    stage: RoundStage,
    stage_raw: z.string().nullable(),
    date: PartialDate.nullable(),
    date_precision: DatePrecision.nullable(),
    amount_original: Money.nullable(),
    currency_original: z.string().length(3).nullable(),
    valuation_post_original: Money.nullable(),
    leads: z.array(z.string()).describe("Investor names as the source gives them"),
    participants: z.array(z.string()),
    unspecified: z.array(z.string()).describe("Named without a role"),
    pages: z.array(z.number().int().nonnegative()).min(1),
    snippet: z.string(),
  })
  .refine((r) => partialDateMatchesPrecision(r.date, r.date_precision), {
    message: "date must match date_precision",
  });

const Conflict = z.strictObject({
  field: z.string(),
  values: z.array(z.string()).min(2),
  chosen: z.string(),
  reason: z.string(),
});

const base = {
  key: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .describe("Queue key; file is cache/<key>.json"),
  researched_at: IsoDate,
  identity_check: z
    .string()
    .min(1)
    .describe("How the entity was confirmed: domain + description, and what it is not"),
  pages: z.array(ResearchPage).min(1),
  conflicts: z.array(Conflict),
  open_items: z.array(z.string()).describe("What could not be found"),
};

export const InvestorResearch = z.strictObject({
  ...base,
  entity_type: z.literal("investor"),
  tier: ResearchTier,
  name: z.string().min(1).describe("Official name as the firm writes it"),
  status: z.enum(["active", "inactive", "not_found", "not_an_investor"]),
  facts: z.strictObject({
    aliases: fact(z.array(z.string())).optional(),
    type: fact(InvestorType).optional(),
    website: fact(Url).optional(),
    linkedin: fact(Url).optional(),
    hq_city: fact(z.string()).optional(),
    hq_country: fact(z.string().length(2)).optional(),
    stages: fact(z.array(InvestorStage)).optional(),
    check_min_usd: fact(Money).optional(),
    check_max_usd: fact(Money).optional(),
    check_range: fact(
      z.strictObject({
        min: Money.nullable(),
        max: Money.nullable(),
        currency: z.string().length(3),
      }),
    )
      .optional()
      .describe(
        "Check size in the currency the firm states it in (e.g. INR); converted by the pipeline",
      ),
    leads: fact(z.boolean()).optional(),
    thesis_text: fact(z.string()).optional(),
    stated_sectors: fact(z.array(Sector)).optional(),
    application_url: fact(Url).optional(),
    accepts_cold_inbound: fact(YesNoUnknown).optional(),
    invests_in_indian_founders: fact(YesNoUnknown).optional(),
    requires_us_entity: fact(YesNoUnknown).optional(),
    portfolio_count_reported: fact(z.number().int().nonnegative()).optional(),
  }),
  funds: z.array(ResearchFund),
  partners: z.array(ResearchPartner),
  rounds: z.array(ResearchRound),
});
export type InvestorResearch = z.infer<typeof InvestorResearch>;

export const CompetitorResearch = z.strictObject({
  ...base,
  entity_type: z.literal("competitor"),
  company: ResearchCompany,
  category: CompetitorCategory,
  layer: CompetitorLayer,
  layer_detail: z.string().nullable(),
  founders: z.array(z.string()),
  named_customers: z.array(z.string()),
  product_summary: z.string().nullable(),
  pricing: z.string().nullable(),
  headcount_est: fact(z.number().int().positive()).nullable(),
  revenue_reported_usd: fact(Money).nullable(),
  rounds: z.array(ResearchRound),
});
export type CompetitorResearch = z.infer<typeof CompetitorResearch>;

/** Verification of one Phase 0 seed round (seed_rounds.csv). */
export const RoundResearch = z.strictObject({
  ...base,
  entity_type: z.literal("round"),
  seed_company: z.string().describe("Company name as in seed_rounds.csv"),
  verdict: z.enum(["confirmed", "corrected", "contested", "not_found"]),
  round: ResearchRound.nullable(),
});
export type RoundResearch = z.infer<typeof RoundResearch>;

export const QUEUE_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;

export const QueueEntry = z.strictObject({
  key: z.string(),
  entity_type: z.enum(["investor", "competitor", "round", "benchmark", "legal"]),
  name: z.string(),
  investor_id: z.string().nullable().describe("Phase 0 id when the entity already existed"),
  tier: ResearchTier.nullable(),
  score: z.number().nullable(),
  status: z.enum(QUEUE_STATUSES),
  blocked_reason: z.string().nullable(),
  last_touched: IsoDate.nullable(),
});
export const ResearchQueue = z.strictObject({
  updated_at: IsoDate,
  entries: z.array(QueueEntry),
});
export type QueueEntry = z.infer<typeof QueueEntry>;
