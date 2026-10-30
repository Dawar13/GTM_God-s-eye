import { z } from "zod";
import {
  BenchmarkMetric,
  BenchmarkUnit,
  FitFlag,
  Geography,
  Jurisdiction,
  LegalTopic,
  RoundStage,
} from "./enums";
import {
  FxUsed,
  InvestorId,
  IsoDate,
  PartialDate,
  RecordConfidence,
  Sources,
  Usd,
  derivedOf,
  idOf,
} from "./common";

export const Benchmark = z
  .strictObject({
    id: idOf("bm"),
    metric: BenchmarkMetric,
    stage: RoundStage.or(z.literal("all")).describe("Stage the figure covers"),
    instrument: z.string().nullable().describe("e.g. post-money SAFE, priced equity"),
    geography: Geography,
    period: z.string().describe("Period the figure covers, e.g. 2026-Q2 or 2025"),
    value: z.number(),
    unit: BenchmarkUnit,
    sample_size: z.number().int().positive().nullable(),
    publisher: z.string().describe("e.g. Carta, PitchBook-NVCA"),
    notes: z.string().nullable(),
    sources: Sources,
    confidence: RecordConfidence,
  })
  .describe("A published market figure our raise is compared against");
export type Benchmark = z.infer<typeof Benchmark>;

export const LEGAL_DISCLAIMER = "Not legal or tax advice — confirm with your CA / counsel.";

const MAX_SUMMARY_WORDS = 80;

export const LegalNote = z
  .strictObject({
    id: idOf("legal"),
    topic: LegalTopic,
    title: z.string().min(1),
    summary: z
      .string()
      .min(1)
      .refine((s) => s.trim().split(/\s+/).length <= MAX_SUMMARY_WORDS, {
        message: `summary must be ${MAX_SUMMARY_WORDS} words or fewer`,
      })
      .describe("Paraphrased, ≤ 80 words, facts only"),
    effective_date: PartialDate.nullable(),
    jurisdiction: Jurisdiction,
    last_verified: IsoDate,
    disclaimer: z.literal(LEGAL_DISCLAIMER),
    sources: Sources,
    confidence: RecordConfidence,
  })
  .describe("A sourced fact about entity structure or Indian investment rules");
export type LegalNote = z.infer<typeof LegalNote>;

export const AcceleratorProgram = z
  .strictObject({
    id: idOf("prog"),
    name: z.string().min(1),
    rank_in_list: z.number().int().positive().nullable().describe("Position in the source list"),
    investor_id: InvestorId.nullable().describe(
      "The firm that runs it, when its name matches one investor record exactly",
    ),
    terms_as_listed: z
      .string()
      .describe("Terms exactly as the source list states them; unverified"),
    headline_amount: z
      .number()
      .nonnegative()
      .nullable()
      .describe("Largest total the listed terms state, in `currency`"),
    currency: z.string().length(3).nullable(),
    headline_usd: Usd.nullable().describe("headline_amount in USD at the list year's rate"),
    upfront_amount: z.number().nonnegative().nullable().describe("First check, in `currency`"),
    upfront_equity_pct: z
      .number()
      .min(0)
      .max(100)
      .nullable()
      .describe("Equity the listed terms state for the first check"),
    equity_free: z.boolean().nullable().describe("True only when the list says equity-free"),
    fx: FxUsed.nullable(),
    sources: Sources,
    confidence: RecordConfidence,
  })
  .describe("An accelerator or residency programme and its terms as a source lists them");
export type AcceleratorProgram = z.infer<typeof AcceleratorProgram>;

const Feature = derivedOf(z.number().min(0).max(1)).nullable();

export const FitFeatures = z
  .strictObject({
    id: idOf("fit"),
    investor_id: InvestorId,
    features: z.strictObject({
      thesis: Feature,
      stage: Feature,
      check: Feature,
      adjacency: Feature,
      geography: Feature,
      dry_powder: Feature,
    }),
    flags: z.array(FitFlag),
    raise_size_usd: Usd.describe("Our round size the check feature used (an assumption)"),
  })
  .describe("Fit features, each 0–1; the weighted total is computed in the app");
export type FitFeatures = z.infer<typeof FitFeatures>;
