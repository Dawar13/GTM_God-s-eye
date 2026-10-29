import type { Company, Competitor, Fund, Investor, Round, Source } from "@/lib/schema";

export const source: Source = {
  url: "user_supplied:goldman_sub200m_funds",
  title: null,
  publisher: null,
  retrieved_at: "2026-10-29",
  kind: "user_supplied",
};

export function investor(overrides: Partial<Investor> = {}): Investor {
  return {
    id: "inv_root-ventures",
    name: "Root Ventures",
    aliases: [],
    parent_brand: null,
    type: "vc",
    region: "western",
    hq_country: null,
    hq_city: null,
    stages: [],
    check_min_usd: null,
    check_max_usd: null,
    leads: null,
    thesis_text: null,
    sector_weights: null,
    website: null,
    linkedin: null,
    application_url: null,
    accepts_cold_inbound: "unknown",
    invests_in_indian_founders: "unknown",
    requires_us_entity: "unknown",
    portfolio_count_reported: null,
    funds: ["fund_root-ventures_iv"],
    partners: [],
    sources: [source],
    field_sources: {},
    confidence: "medium",
    category: {
      freshness: null,
      maturity: null,
      is_early_stage: null,
      is_generalist: null,
      cluster_id: null,
      industrial_affinity: null,
      stage_earliness: null,
    },
    tier: null,
    tier_score: null,
    seed_list_count: 0,
    seed_source_ids: [],
    seed_hints: [],
    flags: [],
    ...overrides,
  };
}

export function fund(overrides: Partial<Fund> = {}): Fund {
  return {
    id: "fund_root-ventures_iv",
    investor_id: "inv_root-ventures",
    name: "Root Ventures",
    number: "IV",
    size_usd: 190_000_000,
    currency_original: "USD",
    size_original: 190_000_000,
    fx: null,
    close_date: "2025",
    close_date_precision: "year",
    vintage_year: 2025,
    location: "Bay Area",
    notes: null,
    sources: [source],
    field_sources: {},
    confidence: "medium",
    ...overrides,
  };
}

export function company(overrides: Partial<Company> = {}): Company {
  return {
    id: "co_machina-labs",
    name: "Machina Labs",
    website: null,
    hq_country: null,
    founded_year: null,
    sector: "robotics_physical_ai",
    sector_classified_by: "source",
    layer: null,
    description_short: null,
    total_raised_usd: null,
    is_competitor: false,
    sources: [source],
    field_sources: {},
    confidence: "low",
    ...overrides,
  };
}

export function competitor(overrides: Partial<Competitor> = {}): Competitor {
  return {
    id: "co_tandem",
    name: "Tandem",
    website: null,
    hq_country: null,
    founded_year: null,
    sector: null,
    sector_classified_by: null,
    description_short: null,
    total_raised_usd: null,
    is_competitor: true,
    category: "direct",
    layer: "design_intent",
    layer_detail: null,
    size_class: null,
    founders: [],
    named_customers: [],
    headcount_est: null,
    revenue_usd: null,
    revenue_basis: "none",
    product_summary: null,
    pricing: null,
    sources: [source],
    field_sources: {},
    confidence: "low",
    ...overrides,
  };
}

export function round(overrides: Partial<Round> = {}): Round {
  return {
    id: "rnd_machina-labs_2026_undisclosed",
    company_id: "co_machina-labs",
    date: "2026",
    date_precision: "year",
    stage: "undisclosed",
    stage_raw: null,
    amount_usd: 124_000_000,
    amount_original: null,
    currency_original: null,
    fx: null,
    valuation_post_usd: null,
    lead_investor_ids: [],
    participant_investor_ids: [],
    unspecified_investor_ids: ["inv_root-ventures"],
    contested: false,
    notes: null,
    sources: [source],
    field_sources: {},
    confidence: "low",
    ...overrides,
  };
}
