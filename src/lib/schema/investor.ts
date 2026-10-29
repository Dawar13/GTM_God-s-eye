import { z } from "zod";
import {
  FitFlag,
  Freshness,
  InvestorFlag,
  InvestorStage,
  InvestorType,
  Maturity,
  Region,
  Sector,
} from "./enums";
import { FundId, InvestorId, RecordConfidence, Sources, Url, Usd } from "./common";

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

/** Points earned per fit component, out of that component's weight (PROJECT_CONTEXT §4). */
const FitPoints = z.number().min(0).max(100).nullable();

export const Fit = z
  .strictObject({
    total: z.number().min(0).max(100).describe("Fit score, 0–100"),
    components: z
      .strictObject({
        thesis: FitPoints,
        stage: FitPoints,
        check: FitPoints,
        portfolio_adjacency: FitPoints,
        geography: FitPoints,
        dry_powder: FitPoints,
      })
      .describe("Points earned per component; null where inputs were missing"),
    flags: z.array(FitFlag).describe("Shown next to the score, never scored"),
  })
  .describe("Fit score and its breakdown");
export type Fit = z.infer<typeof Fit>;

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
    industrial_affinity: z.number().min(0).max(1).nullable().describe("PROJECT_CONTEXT §4"),
    stage_earliness: z.number().min(0).max(1).nullable().describe("Mean of stage scores"),
    fit: Fit.nullable(),
  })
  .describe("Computed by the pipeline; all null until Phase 1");
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
    thesis_text: z.string().nullable().describe("Short, paraphrased thesis"),
    sector_weights: SectorWeights.nullable(),
    website: Url.nullable(),
    linkedin: Url.nullable(),
    funds: z.array(FundId).describe("Fund ids, any order"),
    sources: Sources,
    confidence: RecordConfidence,
    category: InvestorCategory,
    seed_list_count: z
      .number()
      .int()
      .nonnegative()
      .describe("How many user seed lists named this investor"),
    seed_source_ids: z.array(z.string()).describe("Seed lists that named this investor"),
    seed_hints: z.array(SeedHint),
    flags: z.array(InvestorFlag),
  })
  .refine(
    (i) =>
      i.check_min_usd === null || i.check_max_usd === null || i.check_min_usd <= i.check_max_usd,
    { message: "check_min_usd must not exceed check_max_usd", path: ["check_min_usd"] },
  )
  .describe("A firm, fund manager or individual that invests");
export type Investor = z.infer<typeof Investor>;
