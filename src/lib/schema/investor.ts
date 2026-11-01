import { z } from "zod";
import {
  Freshness,
  InvestorFlag,
  InvestorStage,
  InvestorType,
  Maturity,
  Region,
  ResearchTier,
  Sector,
  YesNoUnknown,
} from "./enums";
import {
  FieldSources,
  FundId,
  InvestorId,
  PartnerId,
  RecordConfidence,
  Sources,
  Url,
  Usd,
  derivedOf,
} from "./common";

const SUM_TOLERANCE = 1e-6;

export const SectorWeights = z
  .partialRecord(Sector, z.number().min(0).max(1))
  .refine(
    (w) => {
      const values = Object.values(w);
      return values.length === 0 || Math.abs(values.reduce((a, b) => a + b, 0) - 1) < SUM_TOLERANCE;
    },
    { message: "sector_weights must sum to 1" },
  )
  .describe("Thesis vector over the sector taxonomy; weights sum to 1");

const Unit = z.number().min(0).max(1);

export const InvestorCategory = z
  .strictObject({
    freshness: Freshness.nullable().describe("fresh if latest fund closed on/after the cutoff"),
    maturity: Maturity.nullable().describe("debut = Fund I, emerging = II–III, established = IV+"),
    is_early_stage: z.boolean().nullable().describe("Stages include pre-seed, seed or Series A"),
    is_generalist: z
      .boolean()
      .nullable()
      .describe("Normalised entropy of sector_weights ≥ 0.85, or stated sector-agnostic"),
    cluster_id: z.number().int().nonnegative().nullable().describe("k-means cluster"),
    industrial_affinity: derivedOf(Unit).nullable().describe("PROJECT_CONTEXT §4"),
    stage_earliness: derivedOf(Unit).nullable().describe("Mean of stage scores"),
  })
  .describe("Computed by the pipeline (Phase 1 analytics)");
export type InvestorCategory = z.infer<typeof InvestorCategory>;

export const SeedHint = z
  .strictObject({
    source_id: z.string().describe("User list the hint came from (PROJECT_CONTEXT §6)"),
    listed_focus: z.string().nullable().describe("Focus as the list states it; unverified"),
    listed_check_or_fund: z
      .string()
      .nullable()
      .describe("Check or fund size as listed; unverified"),
    notes: z.string().nullable(),
  })
  .describe("What a user-supplied list claims; Phase 1 verifies before it becomes a fact");
export type SeedHint = z.infer<typeof SeedHint>;

export const Investor = z
  .strictObject({
    id: InvestorId,
    name: z.string().min(1).describe("Display name"),
    aliases: z.array(z.string()).describe("Other names seen for this investor, e.g. a16z"),
    parent_brand: z
      .string()
      .nullable()
      .describe("Shared brand across regional firms, e.g. Accel for Accel US and Accel India"),
    type: InvestorType.nullable(),
    region: Region.nullable().describe("western, india or other (PROJECT_CONTEXT §3)"),
    hq_country: z.string().nullable().describe("ISO 3166-1 alpha-2"),
    hq_city: z.string().nullable(),
    stages: z.array(InvestorStage).describe("Stages they write checks at"),
    check_min_usd: Usd.nullable(),
    check_max_usd: Usd.nullable(),
    leads: z.boolean().nullable().describe("Whether they lead rounds"),
    thesis_text: z.string().nullable().describe("Paraphrased thesis (≤ 60 words)"),
    sector_weights: derivedOf(SectorWeights).nullable(),
    website: Url.nullable(),
    linkedin: Url.nullable(),
    application_url: Url.nullable().describe("Public pitch or application form"),
    accepts_cold_inbound: YesNoUnknown,
    invests_in_indian_founders: YesNoUnknown,
    requires_us_entity: YesNoUnknown,
    portfolio_count_reported: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe("Portfolio size as the firm reports it"),
    funds: z.array(FundId).describe("Fund ids, any order"),
    partners: z.array(PartnerId).describe("Partner ids"),
    sources: Sources,
    field_sources: FieldSources,
    confidence: RecordConfidence,
    category: InvestorCategory,
    tier: ResearchTier.nullable().describe("Research tier (PHASE_1 §4.2)"),
    tier_score: z.number().nullable().describe("Preliminary score used to set the tier"),
    seed_list_count: z
      .number()
      .int()
      .nonnegative()
      .describe("How many user seed lists named this investor"),
    seed_source_ids: z.array(z.string()).describe("Seed lists that named this investor"),
    seed_hints: z.array(SeedHint),
    user_tags: z
      .array(z.string())
      .optional()
      .describe("Short sentence-case tags from the user's own lists, e.g. a list's group; filterable"),
    flags: z.array(InvestorFlag),
  })
  .refine(
    (i) =>
      i.check_min_usd === null || i.check_max_usd === null || i.check_min_usd <= i.check_max_usd,
    { message: "check_min_usd must not exceed check_max_usd", path: ["check_min_usd"] },
  )
  .describe("A firm, fund manager or individual that invests");
export type Investor = z.infer<typeof Investor>;

export const Partner = z
  .strictObject({
    id: PartnerId,
    investor_id: InvestorId,
    name: z.string().min(1),
    title: z.string().nullable(),
    focus_sectors: z.array(Sector),
    linkedin_url: Url.nullable().describe("Public profile URL only; no emails or phone numbers"),
    sources: Sources,
    confidence: RecordConfidence,
  })
  .describe("A partner at an investor, public professional information only");
export type Partner = z.infer<typeof Partner>;
