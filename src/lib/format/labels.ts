import type {
  CompetitorCategory,
  CompetitorLayer,
  CustomerArea,
  CustomerList,
  CustomerRevenueBand,
  CustomerSector,
  CustomerTeamBand,
  Freshness,
  Geography,
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

export const GEOGRAPHY_LABELS: Record<Geography, string> = {
  us: "United States",
  india: "India",
  europe: "Europe",
  global: "Global",
};

export const CUSTOMER_LIST_LABELS: Record<CustomerList, string> = {
  mumbai_pune: "Mumbai–Pune",
  bengaluru: "Bengaluru",
};

/** Tiers as the lists define them (the Bengaluru list's notes; the Mumbai–Pune list uses the same tiers). */
export const CUSTOMER_TIER_LABELS = {
  "1": "Tier 1",
  "2": "Tier 2",
  "3": "Tier 3",
} as const;
export const CUSTOMER_TIER_NOTES = {
  "1": "Most feasible: startups and promoter-led mid-size firms",
  "2": "Larger companies, longer sales cycles",
  "3": "OEMs, MNCs and PSUs",
} as const;

/** ₹ crore a year, as the lists give the bands. */
export const CUSTOMER_REVENUE_LABELS: Record<CustomerRevenueBand, string> = {
  lt_100: "<100",
  "100_500": "100–500",
  "500_2000": "500–2,000",
  "2000_10000": "2,000–10,000",
  "10000_50000": "10,000–50,000",
  gt_50000: ">50,000",
};

/** Employees, as the lists give the bands. */
export const CUSTOMER_TEAM_LABELS: Record<CustomerTeamBand, string> = {
  lt_500: "<500",
  "500_2000": "500–2,000",
  "2000_10000": "2,000–10,000",
  "10000_50000": "10,000–50,000",
  gt_50000: ">50,000",
};

export const CUSTOMER_SECTOR_LABELS: Record<CustomerSector, string> = {
  defence_aerospace: "Defence and aerospace",
  automotive: "Automotive",
  ev_batteries: "EV and batteries",
  metals_machining: "Metals and machining",
  machinery: "Machinery",
  electrical_electronics: "Electrical and electronics",
  appliances_durables: "Appliances and durables",
  chemicals: "Chemicals",
  pharma_life_sciences: "Pharma and life sciences",
  packaging_plastics: "Packaging and plastics",
  food_fmcg: "Food and FMCG",
  textiles: "Textiles and apparel",
  power_utilities: "Power and utilities",
  contract_manufacturing: "Contract manufacturing",
};

export const CUSTOMER_AREA_LABELS: Record<CustomerArea, string> = {
  mumbai: "Mumbai",
  navi_mumbai: "Navi Mumbai",
  thane: "Thane",
  palghar: "Palghar",
  raigad: "Raigad",
  pune: "Pune",
  satara: "Satara",
  nashik: "Nashik",
  ahmednagar: "Ahmednagar",
  aurangabad: "Aurangabad",
  kolhapur: "Kolhapur",
  sangli: "Sangli",
  solapur: "Solapur",
  ratnagiri: "Ratnagiri",
  bengaluru_metro: "Bengaluru metro",
  tumakuru: "Tumakuru",
  mysuru: "Mysuru",
  hassan: "Hassan",
  kolar: "Kolar (KGF)",
  hosur: "Hosur",
  krishnagiri: "Krishnagiri",
  gujarat: "Gujarat",
};

/** The state each area is in, for grouping the area filter. */
export const CUSTOMER_AREA_STATE: Record<CustomerArea, string> = {
  mumbai: "Maharashtra",
  navi_mumbai: "Maharashtra",
  thane: "Maharashtra",
  palghar: "Maharashtra",
  raigad: "Maharashtra",
  pune: "Maharashtra",
  satara: "Maharashtra",
  nashik: "Maharashtra",
  ahmednagar: "Maharashtra",
  aurangabad: "Maharashtra",
  kolhapur: "Maharashtra",
  sangli: "Maharashtra",
  solapur: "Maharashtra",
  ratnagiri: "Maharashtra",
  bengaluru_metro: "Karnataka",
  tumakuru: "Karnataka",
  mysuru: "Karnataka",
  hassan: "Karnataka",
  kolar: "Karnataka",
  hosur: "Tamil Nadu",
  krishnagiri: "Tamil Nadu",
  gujarat: "Gujarat",
};
