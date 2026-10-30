import { z } from "zod";

/**
 * Shared enums. The UI imports these directly; the Python pipeline reads them
 * from the generated JSON Schema (data/schemas/), so this file is the only
 * place a value is added or renamed.
 */

/** Sector taxonomy, PROJECT_CONTEXT §3. Change only via docs/DECISIONS.md. */
export const SECTORS = [
  "ai_infra",
  "ai_apps_agents",
  "industrial_manufacturing",
  "robotics_physical_ai",
  "defense_dual_use",
  "hardware_deeptech",
  "space",
  "climate_energy",
  "mobility_ev",
  "supply_chain_logistics",
  "enterprise_saas",
  "dev_tools",
  "fintech",
  "health_bio",
  "consumer",
  "crypto_web3",
] as const;
export const Sector = z.enum(SECTORS);
export type Sector = z.infer<typeof Sector>;

/** Stages an investor can write checks at (scored for stage earliness). */
export const INVESTOR_STAGES = [
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c_plus",
  "growth",
] as const;
export const InvestorStage = z.enum(INVESTOR_STAGES);
export type InvestorStage = z.infer<typeof InvestorStage>;

/** Round stages: investor stages plus rounds that don't fit the ladder. */
export const ROUND_STAGES = [...INVESTOR_STAGES, "strategic", "undisclosed"] as const;
export const RoundStage = z.enum(ROUND_STAGES);
export type RoundStage = z.infer<typeof RoundStage>;

export const INVESTOR_TYPES = [
  "vc",
  "cvc",
  "angel",
  "syndicate",
  "family_office",
  "sovereign",
  "asset_manager",
  "accelerator",
  "incubator",
  "strategic",
  "individual",
] as const;
export const InvestorType = z.enum(INVESTOR_TYPES);
export type InvestorType = z.infer<typeof InvestorType>;

export const REGIONS = ["western", "india", "other"] as const;
export const Region = z.enum(REGIONS);
export type Region = z.infer<typeof Region>;

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export const Confidence = z.enum(CONFIDENCE_LEVELS);
export type Confidence = z.infer<typeof Confidence>;

export const SOURCE_KINDS = ["primary", "secondary", "user_supplied"] as const;
export const SourceKind = z.enum(SOURCE_KINDS);
export type SourceKind = z.infer<typeof SourceKind>;

export const FRESHNESS = ["fresh", "older", "unknown"] as const;
export const Freshness = z.enum(FRESHNESS);
export type Freshness = z.infer<typeof Freshness>;

export const MATURITY = ["debut", "emerging", "established"] as const;
export const Maturity = z.enum(MATURITY);
export type Maturity = z.infer<typeof Maturity>;

export const DATE_PRECISION = ["day", "month", "quarter", "year"] as const;
export const DatePrecision = z.enum(DATE_PRECISION);
export type DatePrecision = z.infer<typeof DatePrecision>;

export const COMPETITOR_CATEGORIES = ["direct", "adjacent", "remote"] as const;
export const CompetitorCategory = z.enum(COMPETITOR_CATEGORIES);
export type CompetitorCategory = z.infer<typeof CompetitorCategory>;

/** Layer map, PROJECT_CONTEXT §2 tab 4. Finer detail goes in `layer_detail`. */
export const COMPETITOR_LAYERS = [
  "design_intent",
  "process_planning",
  "plant_ops",
  "quality_vision",
  "autonomy_tooling",
  "robotics",
  "full_stack_factory",
] as const;
export const CompetitorLayer = z.enum(COMPETITOR_LAYERS);
export type CompetitorLayer = z.infer<typeof CompetitorLayer>;

/** By total raised (PHASE_1 §6): <$5M, $5–25M, $25–100M, $100M–1B, >$1B. */
export const SIZE_CLASSES = [
  "under_5m",
  "from_5m_to_25m",
  "from_25m_to_100m",
  "from_100m_to_1b",
  "over_1b",
] as const;
export const SizeClass = z.enum(SIZE_CLASSES);
export type SizeClass = z.infer<typeof SizeClass>;

export const REVENUE_BASIS = ["reported", "none"] as const;
export const RevenueBasis = z.enum(REVENUE_BASIS);
export type RevenueBasis = z.infer<typeof RevenueBasis>;

/** Record-level flags set by the pipeline. */
export const INVESTOR_FLAGS = [
  "not_early_stage_target_by_default",
  // Research found no recent activity (e.g. venture pages gone, team left).
  "inactive",
] as const;
export const InvestorFlag = z.enum(INVESTOR_FLAGS);
export type InvestorFlag = z.infer<typeof InvestorFlag>;

/** Flags on the fit score; shown, never scored (PROJECT_CONTEXT §4). */
export const FIT_FLAGS = ["conflict", "sparse"] as const;
export const FitFlag = z.enum(FIT_FLAGS);
export type FitFlag = z.infer<typeof FitFlag>;

export const YES_NO_UNKNOWN = ["yes", "no", "unknown"] as const;
export const YesNoUnknown = z.enum(YES_NO_UNKNOWN);
export type YesNoUnknown = z.infer<typeof YesNoUnknown>;

export const RESEARCH_TIERS = ["A", "B", "C"] as const;
export const ResearchTier = z.enum(RESEARCH_TIERS);
export type ResearchTier = z.infer<typeof ResearchTier>;

export const SECTOR_CLASSIFIED_BY = ["source", "model"] as const;
export const SectorClassifiedBy = z.enum(SECTOR_CLASSIFIED_BY);
export type SectorClassifiedBy = z.infer<typeof SectorClassifiedBy>;

export const BENCHMARK_METRICS = [
  "median_round_size",
  "median_pre_money",
  "median_post_money",
  "median_dilution",
  "safe_cap_median",
  "safe_share_of_rounds",
  "note_share_of_rounds",
  "time_between_rounds",
  "deal_count",
  "capital_invested",
  "fund_count",
  "capital_raised_by_funds",
  "median_fund_size",
] as const;
export const BenchmarkMetric = z.enum(BENCHMARK_METRICS);
export type BenchmarkMetric = z.infer<typeof BenchmarkMetric>;

export const BENCHMARK_UNITS = ["usd", "fraction", "days", "months", "count"] as const;
export const BenchmarkUnit = z.enum(BENCHMARK_UNITS);

export const GEOGRAPHIES = ["us", "india", "europe", "global"] as const;
export const Geography = z.enum(GEOGRAPHIES);
export type Geography = z.infer<typeof Geography>;

export const LEGAL_TOPICS = [
  "india_flip",
  "reverse_flip",
  "fema_pricing",
  "angel_tax",
  "india_convertible_note",
  "isafe",
  "ccps",
  "delaware_requirement",
] as const;
export const LegalTopic = z.enum(LEGAL_TOPICS);
export type LegalTopic = z.infer<typeof LegalTopic>;

export const JURISDICTIONS = ["india", "us", "us_delaware"] as const;
export const Jurisdiction = z.enum(JURISDICTIONS);
