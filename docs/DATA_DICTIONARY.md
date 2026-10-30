# Data dictionary

Generated from the Zod schemas in `src/lib/schema/` by `pnpm gen:schema`. Do not edit by hand.

Every file in `data/processed/` is a dataset: `{ version, generated_at, records: [...] }`.
Current schema version: 2. Nullable fields are written as `null` when unknown; the UI shows "—".

## Investor

File: `data/processed/investors.json`. A firm, fund manager or individual that invests

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `inv_<slug>` |
| `name` | string | yes | Display name |
| `aliases` | array of string | yes | Other names seen for this investor, e.g. a16z |
| `parent_brand` | string \| null | yes | Shared brand across regional firms, e.g. Accel for Accel US and Accel India |
| `type` | `vc`, `cvc`, `angel`, `syndicate`, `family_office`, `sovereign`, `asset_manager`, `accelerator`, `strategic`, `individual` \| null | yes |  |
| `region` | `western`, `india`, `other` \| null | yes | western, india or other (PROJECT_CONTEXT §3) |
| `hq_country` | string \| null | yes | ISO 3166-1 alpha-2 |
| `hq_city` | string \| null | yes |  |
| `stages` | array of `pre_seed`, `seed`, `series_a`, `series_b`, `series_c_plus`, `growth` | yes | Stages they write checks at |
| `check_min_usd` | number \| null | yes | US dollars (not millions) |
| `check_max_usd` | number \| null | yes | US dollars (not millions) |
| `leads` | boolean \| null | yes | Whether they lead rounds |
| `thesis_text` | string \| null | yes | Paraphrased thesis (≤ 60 words) |
| `sector_weights` | [Investor.sector_weights](#investor-sector-weights) \| null | yes |  |
| `website` | string (pattern) \| null | yes | Absolute http(s) URL |
| `linkedin` | string (pattern) \| null | yes | Absolute http(s) URL |
| `application_url` | string (pattern) \| null | yes | Public pitch or application form |
| `accepts_cold_inbound` | `yes`, `no`, `unknown` | yes |  |
| `invests_in_indian_founders` | `yes`, `no`, `unknown` | yes |  |
| `requires_us_entity` | `yes`, `no`, `unknown` | yes |  |
| `portfolio_count_reported` | integer \| null | yes | Portfolio size as the firm reports it |
| `funds` | array of string (pattern) | yes | Fund ids, any order |
| `partners` | array of string (pattern) | yes | Partner ids |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `field_sources` | object | yes | Field name -> indexes into sources |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source or two independent secondaries agree; medium: one reputable secondary; low: user-supplied list or database page only |
| `category` | [InvestorCategory](#investorcategory) | yes | Computed by the pipeline (Phase 1 analytics) |
| `tier` | `A`, `B`, `C` \| null | yes | Research tier (PHASE_1 §4.2) |
| `tier_score` | number \| null | yes | Preliminary score used to set the tier |
| `seed_list_count` | integer | yes | How many user seed lists named this investor |
| `seed_source_ids` | array of string | yes | Seed lists that named this investor |
| `seed_hints` | array of [SeedHint](#seedhint) | yes |  |
| `flags` | array of `not_early_stage_target_by_default`, `inactive` | yes |  |

## Partner

File: `data/processed/partners.json`. A partner at an investor, public professional information only

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `ptr_<slug>` |
| `investor_id` | string (pattern) | yes | Stable id, `inv_<slug>` |
| `name` | string | yes |  |
| `title` | string \| null | yes |  |
| `focus_sectors` | array of `ai_infra`, `ai_apps_agents`, `industrial_manufacturing`, `robotics_physical_ai`, `defense_dual_use`, `hardware_deeptech`, `space`, `climate_energy`, `mobility_ev`, `supply_chain_logistics`, `enterprise_saas`, `dev_tools`, `fintech`, `health_bio`, `consumer`, `crypto_web3` | yes |  |
| `linkedin_url` | string (pattern) \| null | yes | Public profile URL only; no emails or phone numbers |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source or two independent secondaries agree; medium: one reputable secondary; low: user-supplied list or database page only |

## Fund

File: `data/processed/funds.json`. One fund (vehicle) raised by an investor

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `fund_<slug>` |
| `investor_id` | string (pattern) | yes | Stable id, `inv_<slug>` |
| `name` | string | yes | Fund name as the source gives it |
| `number` | string (pattern) \| null | yes | Fund number in Roman numerals: I, II, … |
| `size_usd` | number \| null | yes | US dollars (not millions) |
| `currency_original` | string \| null | yes | ISO 4217 code as announced |
| `size_original` | number \| null | yes | Size in the announced currency |
| `fx` | [Fund.fx](#fund-fx) \| null | yes | FX rate applied (pipeline/atlas/fx.py) |
| `close_date` | string (pattern) \| null | yes | Announced or closed |
| `close_date_precision` | `day`, `month`, `quarter`, `year` \| null | yes |  |
| `vintage_year` | integer \| null | yes |  |
| `location` | string \| null | yes | Location as the source gives it |
| `notes` | string \| null | yes | Source notes that are not a link |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `field_sources` | object | yes | Field name -> indexes into sources |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source or two independent secondaries agree; medium: one reputable secondary; low: user-supplied list or database page only |

## Company

File: `data/processed/companies.json`. A portfolio company that is not one of our competitors

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `co_<slug>` |
| `name` | string | yes |  |
| `website` | string (pattern) \| null | yes | Own site; companies are de-duplicated by its domain |
| `hq_country` | string \| null | yes | ISO 3166-1 alpha-2 |
| `founded_year` | integer \| null | yes |  |
| `sector` | `ai_infra`, `ai_apps_agents`, `industrial_manufacturing`, `robotics_physical_ai`, `defense_dual_use`, `hardware_deeptech`, `space`, `climate_energy`, `mobility_ev`, `supply_chain_logistics`, `enterprise_saas`, `dev_tools`, `fintech`, `health_bio`, `consumer`, `crypto_web3` \| null | yes |  |
| `sector_classified_by` | `source`, `model` \| null | yes | source: the company's own description says so; model: classified by the researcher |
| `layer` | `design_intent`, `process_planning`, `plant_ops`, `quality_vision`, `autonomy_tooling`, `robotics`, `full_stack_factory` \| null | yes | Only for companies in our space |
| `description_short` | string \| null | yes | One line, paraphrased |
| `total_raised_usd` | number \| null | yes | US dollars (not millions) |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `field_sources` | object | yes | Field name -> indexes into sources |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source or two independent secondaries agree; medium: one reputable secondary; low: user-supplied list or database page only |
| `is_competitor` | `false` | yes | Competitors live in competitors.json |

## Competitor

File: `data/processed/competitors.json`. A company we compete with or benchmark against

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `co_<slug>` |
| `name` | string | yes |  |
| `website` | string (pattern) \| null | yes | Own site; companies are de-duplicated by its domain |
| `hq_country` | string \| null | yes | ISO 3166-1 alpha-2 |
| `founded_year` | integer \| null | yes |  |
| `sector` | `ai_infra`, `ai_apps_agents`, `industrial_manufacturing`, `robotics_physical_ai`, `defense_dual_use`, `hardware_deeptech`, `space`, `climate_energy`, `mobility_ev`, `supply_chain_logistics`, `enterprise_saas`, `dev_tools`, `fintech`, `health_bio`, `consumer`, `crypto_web3` \| null | yes |  |
| `sector_classified_by` | `source`, `model` \| null | yes | source: the company's own description says so; model: classified by the researcher |
| `layer` | `design_intent`, `process_planning`, `plant_ops`, `quality_vision`, `autonomy_tooling`, `robotics`, `full_stack_factory` | yes | Position on the layer map (PROJECT_CONTEXT §2) |
| `description_short` | string \| null | yes | One line, paraphrased |
| `total_raised_usd` | number \| null | yes | US dollars (not millions) |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `field_sources` | object | yes | Field name -> indexes into sources |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source or two independent secondaries agree; medium: one reputable secondary; low: user-supplied list or database page only |
| `is_competitor` | `true` | yes |  |
| `category` | `direct`, `adjacent`, `remote` | yes |  |
| `layer_detail` | string \| null | yes | Finer layer, e.g. maintenance / condition monitoring |
| `size_class` | `under_5m`, `from_5m_to_25m`, `from_25m_to_100m`, `from_100m_to_1b`, `over_1b` \| null | yes | By total raised |
| `founders` | array of string | yes |  |
| `named_customers` | array of string | yes | Customers the company names publicly |
| `headcount_est` | [Competitor.headcount_est](#competitor-headcount-est) \| null | yes | Approximate headcount, only with a source (e.g. LinkedIn page) |
| `revenue_usd` | number \| null | yes | Only when publicly reported; never estimated |
| `revenue_basis` | `reported`, `none` | yes |  |
| `product_summary` | string \| null | yes | ≤ 50 words |
| `pricing` | string \| null | yes | Public pricing, as stated |

## Round

File: `data/processed/rounds.json`. One financing round of one company

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `rnd_<slug>` |
| `company_id` | string (pattern) | yes | Stable id, `co_<slug>` |
| `date` | string (pattern) \| null | yes | YYYY, YYYY-Qn, YYYY-MM or YYYY-MM-DD; precision is given alongside |
| `date_precision` | `day`, `month`, `quarter`, `year` \| null | yes |  |
| `stage` | `pre_seed`, `seed`, `series_a`, `series_b`, `series_c_plus`, `growth`, `strategic`, `undisclosed` | yes |  |
| `stage_raw` | string \| null | yes | Round label as the source gives it |
| `amount_usd` | number \| null | yes | US dollars (not millions) |
| `amount_original` | number \| null | yes | Amount in announced currency |
| `currency_original` | string \| null | yes |  |
| `fx` | [Round.fx](#round-fx) \| null | yes | FX rate applied (pipeline/atlas/fx.py) |
| `valuation_post_usd` | number \| null | yes | US dollars (not millions) |
| `lead_investor_ids` | array of string (pattern) | yes |  |
| `participant_investor_ids` | array of string (pattern) | yes |  |
| `unspecified_investor_ids` | array of string (pattern) | yes | Investors the source names without saying whether they led |
| `contested` | boolean | yes | Sources disagree on amount, date, stage or investors |
| `notes` | string \| null | yes |  |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `field_sources` | object | yes | Field name -> indexes into sources |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source or two independent secondaries agree; medium: one reputable secondary; low: user-supplied list or database page only |

## Benchmark

File: `data/processed/benchmarks.json`. A published market figure our raise is compared against

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `bm_<slug>` |
| `metric` | `median_round_size`, `median_pre_money`, `median_post_money`, `median_dilution`, `safe_cap_median`, `safe_share_of_rounds`, `note_share_of_rounds`, `time_between_rounds`, `deal_count`, `capital_invested`, `fund_count`, `capital_raised_by_funds`, `median_fund_size` | yes |  |
| `stage` | `pre_seed`, `seed`, `series_a`, `series_b`, `series_c_plus`, `growth`, `strategic`, `undisclosed` \| `"all"` | yes | Stage the figure covers |
| `instrument` | string \| null | yes | e.g. post-money SAFE, priced equity |
| `geography` | `us`, `india`, `europe`, `global` | yes |  |
| `period` | string | yes | Period the figure covers, e.g. 2026-Q2 or 2025 |
| `value` | number | yes |  |
| `unit` | `usd`, `fraction`, `days`, `months`, `count` | yes |  |
| `sample_size` | integer \| null | yes |  |
| `publisher` | string | yes | e.g. Carta, PitchBook-NVCA |
| `notes` | string \| null | yes |  |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source or two independent secondaries agree; medium: one reputable secondary; low: user-supplied list or database page only |

## LegalNote

File: `data/processed/legal_notes.json`. A sourced fact about entity structure or Indian investment rules

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `legal_<slug>` |
| `topic` | `india_flip`, `reverse_flip`, `fema_pricing`, `angel_tax`, `india_convertible_note`, `isafe`, `ccps`, `delaware_requirement` | yes |  |
| `title` | string | yes |  |
| `summary` | string | yes | Paraphrased, ≤ 80 words, facts only |
| `effective_date` | string (pattern) \| null | yes | YYYY, YYYY-Qn, YYYY-MM or YYYY-MM-DD; precision is given alongside |
| `jurisdiction` | `india`, `us`, `us_delaware` | yes |  |
| `last_verified` | string (date) | yes | ISO date, YYYY-MM-DD |
| `disclaimer` | `"Not legal or tax advice — confirm with your CA / counsel."` | yes |  |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source or two independent secondaries agree; medium: one reputable secondary; low: user-supplied list or database page only |

## FitFeatures

File: `data/processed/fit_features.json`. Fit features, each 0–1; the weighted total is computed in the app

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `fit_<slug>` |
| `investor_id` | string (pattern) | yes | Stable id, `inv_<slug>` |
| `features` | [FitFeatures.features](#fitfeatures-features) | yes |  |
| `flags` | array of `conflict`, `sparse` | yes |  |
| `raise_size_usd` | number | yes | Our round size the check feature used (an assumption) |

## Anomaly

File: `data/processed/anomalies.json`. Flagged problem in a source; for human review

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `anom_<slug>` |
| `source_id` | string | yes | Source list, e.g. goldman_sub200m_funds |
| `row_ref` | string | yes | Row index or name in the source |
| `field` | string | yes | Column the problem is in |
| `raw_value` | string \| null | yes |  |
| `reason` | string | yes | What looks wrong |
| `resolution` | string \| null | yes | What the pipeline did instead, if anything |

## Merge

File: `data/processed/merges.json`. Name merge; every one is logged for review

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `merge_<slug>` |
| `investor_id` | string (pattern) | yes | Stable id, `inv_<slug>` |
| `kept_name` | string | yes |  |
| `merged_name` | string | yes |  |
| `method` | `normalised_name`, `fuzzy`, `alias` | yes |  |
| `score` | number \| null | yes | rapidfuzz score for fuzzy merges |
| `source_ids` | array of string | yes | Lists the merged name came from |

## Investor.sector_weights



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | map of Sector → number | yes | Thesis vector over the sector taxonomy; weights sum to 1 |
| `method` | string | yes | How it was computed, e.g. stated_and_portfolio |
| `inputs` | array of string | yes | Which inputs existed, e.g. thesis_text, 12 rounds |

## Source

Provenance for a record or a single fact

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string (pattern) | yes | Where the fact came from: an http(s) URL, or `user_supplied:<source_id>` for a user list with no link |
| `title` | string \| null | yes | Page or document title, if known |
| `publisher` | string \| null | yes | Publisher or site, if known |
| `retrieved_at` | string (date) | yes | Date the source was read |
| `kind` | `primary`, `secondary`, `user_supplied` | yes | primary, secondary or user_supplied (PROJECT_CONTEXT §5) |

## InvestorCategory

Computed by the pipeline (Phase 1 analytics)

| Field | Type | Required | Description |
|---|---|---|---|
| `freshness` | `fresh`, `older`, `unknown` \| null | yes | fresh if latest fund closed on/after the cutoff |
| `maturity` | `debut`, `emerging`, `established` \| null | yes | debut = Fund I, emerging = II–III, established = IV+ |
| `is_early_stage` | boolean \| null | yes | Stages include pre-seed, seed or Series A |
| `is_generalist` | boolean \| null | yes | Normalised entropy of sector_weights ≥ 0.85, or stated sector-agnostic |
| `cluster_id` | integer \| null | yes | k-means cluster |
| `industrial_affinity` | [InvestorCategory.industrial_affinity](#investorcategory-industrial-affinity) \| null | yes | PROJECT_CONTEXT §4 |
| `stage_earliness` | [InvestorCategory.stage_earliness](#investorcategory-stage-earliness) \| null | yes | Mean of stage scores |

## SeedHint

What a user-supplied list claims; Phase 1 verifies before it becomes a fact

| Field | Type | Required | Description |
|---|---|---|---|
| `source_id` | string | yes | User list the hint came from (PROJECT_CONTEXT §6) |
| `listed_focus` | string \| null | yes | Focus as the list states it; unverified |
| `listed_check_or_fund` | string \| null | yes | Check or fund size as listed; unverified |
| `notes` | string \| null | yes |  |

## Fund.fx

FX rate applied (pipeline/atlas/fx.py)

| Field | Type | Required | Description |
|---|---|---|---|
| `rate_to_usd` | number | yes | USD per unit of the original currency |
| `rate_period` | string | yes | Year or date the rate is for |
| `source_url` | string (pattern) | yes | Absolute http(s) URL |

## Competitor.headcount_est



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | integer | yes |  |
| `source` | [Source](#source) | yes | Provenance for a record or a single fact |

## Round.fx

FX rate applied (pipeline/atlas/fx.py)

| Field | Type | Required | Description |
|---|---|---|---|
| `rate_to_usd` | number | yes | USD per unit of the original currency |
| `rate_period` | string | yes | Year or date the rate is for |
| `source_url` | string (pattern) | yes | Absolute http(s) URL |

## FitFeatures.features



| Field | Type | Required | Description |
|---|---|---|---|
| `thesis` | [FitFeatures.features.thesis](#fitfeatures-features-thesis) \| null | yes |  |
| `stage` | [FitFeatures.features.stage](#fitfeatures-features-stage) \| null | yes |  |
| `check` | [FitFeatures.features.check](#fitfeatures-features-check) \| null | yes |  |
| `adjacency` | [FitFeatures.features.adjacency](#fitfeatures-features-adjacency) \| null | yes |  |
| `geography` | [FitFeatures.features.geography](#fitfeatures-features-geography) \| null | yes |  |
| `dry_powder` | [FitFeatures.features.dry_powder](#fitfeatures-features-dry-powder) \| null | yes |  |

## InvestorCategory.industrial_affinity



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | number | yes |  |
| `method` | string | yes | How it was computed, e.g. stated_and_portfolio |
| `inputs` | array of string | yes | Which inputs existed, e.g. thesis_text, 12 rounds |

## InvestorCategory.stage_earliness



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | number | yes |  |
| `method` | string | yes | How it was computed, e.g. stated_and_portfolio |
| `inputs` | array of string | yes | Which inputs existed, e.g. thesis_text, 12 rounds |

## FitFeatures.features.thesis



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | number | yes |  |
| `method` | string | yes | How it was computed, e.g. stated_and_portfolio |
| `inputs` | array of string | yes | Which inputs existed, e.g. thesis_text, 12 rounds |

## FitFeatures.features.stage



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | number | yes |  |
| `method` | string | yes | How it was computed, e.g. stated_and_portfolio |
| `inputs` | array of string | yes | Which inputs existed, e.g. thesis_text, 12 rounds |

## FitFeatures.features.check



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | number | yes |  |
| `method` | string | yes | How it was computed, e.g. stated_and_portfolio |
| `inputs` | array of string | yes | Which inputs existed, e.g. thesis_text, 12 rounds |

## FitFeatures.features.adjacency



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | number | yes |  |
| `method` | string | yes | How it was computed, e.g. stated_and_portfolio |
| `inputs` | array of string | yes | Which inputs existed, e.g. thesis_text, 12 rounds |

## FitFeatures.features.geography



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | number | yes |  |
| `method` | string | yes | How it was computed, e.g. stated_and_portfolio |
| `inputs` | array of string | yes | Which inputs existed, e.g. thesis_text, 12 rounds |

## FitFeatures.features.dry_powder



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | number | yes |  |
| `method` | string | yes | How it was computed, e.g. stated_and_portfolio |
| `inputs` | array of string | yes | Which inputs existed, e.g. thesis_text, 12 rounds |

## Enums

- **Sector**: `ai_infra`, `ai_apps_agents`, `industrial_manufacturing`, `robotics_physical_ai`, `defense_dual_use`, `hardware_deeptech`, `space`, `climate_energy`, `mobility_ev`, `supply_chain_logistics`, `enterprise_saas`, `dev_tools`, `fintech`, `health_bio`, `consumer`, `crypto_web3`
- **InvestorStage**: `pre_seed`, `seed`, `series_a`, `series_b`, `series_c_plus`, `growth`
- **RoundStage**: `pre_seed`, `seed`, `series_a`, `series_b`, `series_c_plus`, `growth`, `strategic`, `undisclosed`
- **InvestorType**: `vc`, `cvc`, `angel`, `syndicate`, `family_office`, `sovereign`, `asset_manager`, `accelerator`, `strategic`, `individual`
- **Region**: `western`, `india`, `other`
- **Confidence**: `high`, `medium`, `low`
- **SourceKind**: `primary`, `secondary`, `user_supplied`
- **Freshness**: `fresh`, `older`, `unknown`
- **Maturity**: `debut`, `emerging`, `established`
- **DatePrecision**: `day`, `month`, `quarter`, `year`
- **CompetitorCategory**: `direct`, `adjacent`, `remote`
- **CompetitorLayer**: `design_intent`, `process_planning`, `plant_ops`, `quality_vision`, `autonomy_tooling`, `robotics`, `full_stack_factory`
- **SizeClass**: `under_5m`, `from_5m_to_25m`, `from_25m_to_100m`, `from_100m_to_1b`, `over_1b`
- **RevenueBasis**: `reported`, `none`
- **InvestorFlag**: `not_early_stage_target_by_default`, `inactive`
- **FitFlag**: `conflict`, `sparse`
- **YesNoUnknown**: `yes`, `no`, `unknown`
- **ResearchTier**: `A`, `B`, `C`
- **SectorClassifiedBy**: `source`, `model`
- **BenchmarkMetric**: `median_round_size`, `median_pre_money`, `median_post_money`, `median_dilution`, `safe_cap_median`, `safe_share_of_rounds`, `note_share_of_rounds`, `time_between_rounds`, `deal_count`, `capital_invested`, `fund_count`, `capital_raised_by_funds`, `median_fund_size`
- **BenchmarkUnit**: `usd`, `fraction`, `days`, `months`, `count`
- **Geography**: `us`, `india`, `europe`, `global`
- **LegalTopic**: `india_flip`, `reverse_flip`, `fema_pricing`, `angel_tax`, `india_convertible_note`, `isafe`, `ccps`, `delaware_requirement`
- **Jurisdiction**: `india`, `us`, `us_delaware`
