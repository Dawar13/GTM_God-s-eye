import type {
  CompetitorCategory,
  CompetitorLayer,
  Freshness,
  InvestorStage,
  InvestorType,
  LegalTopic,
  Maturity,
  Region,
  ResearchTier,
  RoundStage,
  Sector,
} from "@/lib/schema/enums";
import type { LegalNote } from "@/lib/schema";

export const SECTOR_LABELS: Record<Sector, string> = {
  ai_infra: "AI infrastructure",
  ai_apps_agents: "AI apps and agents",
  industrial_manufacturing: "Industrial and manufacturing",
  robotics_physical_ai: "Robotics and physical AI",
  defense_dual_use: "Defence and dual use",
  hardware_deeptech: "Hardware and deep tech",
  space: "Space",
  climate_energy: "Climate and energy",
  mobility_ev: "Mobility and EV",
  supply_chain_logistics: "Supply chain and logistics",
  enterprise_saas: "Enterprise SaaS",
  dev_tools: "Developer tools",
  fintech: "Fintech",
  health_bio: "Health and bio",
  consumer: "Consumer",
  crypto_web3: "Crypto and web3",
};

export const ROUND_STAGE_LABELS: Record<RoundStage, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c_plus: "Series C+",
  growth: "Growth",
  strategic: "Strategic",
  undisclosed: "Undisclosed",
};

export const INVESTOR_STAGE_LABELS: Record<InvestorStage, string> = ROUND_STAGE_LABELS;

export const INVESTOR_TYPE_LABELS: Record<InvestorType, string> = {
  vc: "VC",
  cvc: "Corporate VC",
  angel: "Angel",
  syndicate: "Syndicate",
  family_office: "Family office",
  sovereign: "Sovereign",
  asset_manager: "Asset manager",
  accelerator: "Accelerator",
  incubator: "Incubator",
  strategic: "Strategic",
  individual: "Individual",
};

export const REGION_LABELS: Record<Region, string> = {
  western: "Western",
  india: "India",
  other: "Other",
};

export const FRESHNESS_LABELS: Record<Freshness, string> = {
  fresh: "Fresh fund",
  older: "Older fund",
  unknown: "Unknown",
};

export const MATURITY_LABELS: Record<Maturity, string> = {
  debut: "Debut fund",
  emerging: "Emerging",
  established: "Established",
};

/** Research tiers (PHASE_1 §4.2): A is the deepest profile. */
export const TIER_LABELS: Record<ResearchTier, string> = {
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
};

export const LAYER_LABELS: Record<CompetitorLayer, string> = {
  design_intent: "Design intent",
  process_planning: "Process planning",
  plant_ops: "Plant ops",
  quality_vision: "Quality vision",
  autonomy_tooling: "Autonomy tooling",
  robotics: "Robotics",
  full_stack_factory: "Full-stack factory",
};

export const COMPETITOR_CATEGORY_LABELS: Record<CompetitorCategory, string> = {
  direct: "Direct",
  adjacent: "Adjacent",
  remote: "Remote",
};

export const LEGAL_TOPIC_LABELS: Record<LegalTopic, string> = {
  ccps: "CCPS (compulsorily convertible preference shares)",
  isafe: "iSAFE",
  india_convertible_note: "Convertible notes in India",
  fema_pricing: "FEMA pricing rules",
  angel_tax: "Angel tax",
  india_flip: "India flip",
  reverse_flip: "Reverse flip",
  delaware_requirement: "Delaware requirement",
};

export const JURISDICTION_LABELS: Record<LegalNote["jurisdiction"], string> = {
  india: "India",
  us: "United States",
  us_delaware: "Delaware, United States",
};
