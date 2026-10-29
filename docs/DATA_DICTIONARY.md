# Data dictionary

Generated from the Zod schemas in `src/lib/schema/` by `pnpm gen:schema`. Do not edit by hand.

Every file in `data/processed/` is a dataset: `{ version, generated_at, records: [...] }`.
Current schema version: 1. Nullable fields are written as `null` when unknown; the UI shows "—".

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
| `thesis_text` | string \| null | yes | Short, paraphrased thesis |
| `sector_weights` | map of Sector → number \| null | yes | Thesis vector over the sector taxonomy; weights sum to 1 |
| `website` | string (pattern) \| null | yes | Absolute http(s) URL |
| `linkedin` | string (pattern) \| null | yes | Absolute http(s) URL |
| `funds` | array of string (pattern) | yes | Fund ids, any order |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source; medium: single secondary or user list with link; low: unverified lead |
| `category` | [InvestorCategory](#investorcategory) | yes | Computed by the pipeline; all null until Phase 1 |
| `seed_list_count` | integer | yes | How many user seed lists named this investor |
| `seed_source_ids` | array of string | yes | Seed lists that named this investor |
| `seed_hints` | array of [SeedHint](#seedhint) | yes |  |
| `flags` | array of `not_early_stage_target_by_default` | yes |  |

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
| `close_date` | string (pattern) \| null | yes | Announced or closed |
| `close_date_precision` | `day`, `month`, `year` \| null | yes |  |
| `vintage_year` | integer \| null | yes |  |
| `location` | string \| null | yes | Location as the source gives it |
| `notes` | string \| null | yes | Source notes that are not a link |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source; medium: single secondary or user list with link; low: unverified lead |

## Company

File: `data/processed/companies.json`. A portfolio company that is not one of our competitors

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `co_<slug>` |
| `name` | string | yes |  |
| `hq_country` | string \| null | yes | ISO 3166-1 alpha-2 |
| `founded_year` | integer \| null | yes |  |
| `sector` | `ai_infra`, `ai_apps_agents`, `industrial_manufacturing`, `robotics_physical_ai`, `defense_dual_use`, `hardware_deeptech`, `space`, `climate_energy`, `mobility_ev`, `supply_chain_logistics`, `enterprise_saas`, `dev_tools`, `fintech`, `health_bio`, `consumer`, `crypto_web3` \| null | yes |  |
| `description_short` | string \| null | yes | One line, paraphrased |
| `total_raised_usd` | number \| null | yes | US dollars (not millions) |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source; medium: single secondary or user list with link; low: unverified lead |
| `is_competitor` | `false` | yes | Competitors live in competitors.json |

## Competitor

File: `data/processed/competitors.json`. A company we compete with or benchmark against

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `co_<slug>` |
| `name` | string | yes |  |
| `hq_country` | string \| null | yes | ISO 3166-1 alpha-2 |
| `founded_year` | integer \| null | yes |  |
| `sector` | `ai_infra`, `ai_apps_agents`, `industrial_manufacturing`, `robotics_physical_ai`, `defense_dual_use`, `hardware_deeptech`, `space`, `climate_energy`, `mobility_ev`, `supply_chain_logistics`, `enterprise_saas`, `dev_tools`, `fintech`, `health_bio`, `consumer`, `crypto_web3` \| null | yes |  |
| `description_short` | string \| null | yes | One line, paraphrased |
| `total_raised_usd` | number \| null | yes | US dollars (not millions) |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source; medium: single secondary or user list with link; low: unverified lead |
| `is_competitor` | `true` | yes |  |
| `category` | `direct`, `adjacent`, `remote` | yes |  |
| `layer` | `design_intent`, `process_planning`, `plant_ops`, `quality_vision`, `autonomy_tooling`, `robotics`, `full_stack_factory` | yes | Position on the layer map (PROJECT_CONTEXT §2) |
| `layer_detail` | string \| null | yes | Finer layer, e.g. maintenance / condition monitoring |
| `size_class` | `early`, `growth`, `incumbent` \| null | yes |  |
| `headcount_est` | [Competitor.headcount_est](#competitor-headcount-est) \| null | yes | Headcount estimate, only with a source (e.g. LinkedIn page) |
| `revenue_usd` | number \| null | yes | Only when publicly reported; never estimated |
| `revenue_basis` | `reported`, `none` | yes |  |
| `product_summary` | string \| null | yes |  |
| `pricing` | string \| null | yes | Public pricing, as stated |

## Round

File: `data/processed/rounds.json`. One financing round of one company

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (pattern) | yes | Stable id, `rnd_<slug>` |
| `company_id` | string (pattern) | yes | Stable id, `co_<slug>` |
| `date` | string (pattern) \| null | yes | YYYY, YYYY-MM or YYYY-MM-DD; precision is given alongside |
| `date_precision` | `day`, `month`, `year` \| null | yes |  |
| `stage` | `pre_seed`, `seed`, `series_a`, `series_b`, `series_c_plus`, `growth`, `strategic`, `undisclosed` | yes |  |
| `stage_raw` | string \| null | yes | Round label as the source gives it |
| `amount_usd` | number \| null | yes | US dollars (not millions) |
| `valuation_post_usd` | number \| null | yes | US dollars (not millions) |
| `lead_investor_ids` | array of string (pattern) | yes |  |
| `participant_investor_ids` | array of string (pattern) | yes |  |
| `unspecified_investor_ids` | array of string (pattern) | yes | Investors the source names without saying whether they led |
| `notes` | string \| null | yes |  |
| `sources` | array of [Source](#source) (min 1) | yes | At least one source; first is primary |
| `confidence` | `high`, `medium`, `low` | yes | high: primary source; medium: single secondary or user list with link; low: unverified lead |

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

Computed by the pipeline; all null until Phase 1

| Field | Type | Required | Description |
|---|---|---|---|
| `freshness` | `fresh`, `older`, `unknown` \| null | yes | fresh if latest fund closed on/after the cutoff |
| `maturity` | `debut`, `emerging`, `established` \| null | yes | debut = Fund I, emerging = II–III, established = IV+ |
| `is_early_stage` | boolean \| null | yes | Stages include pre-seed, seed or Series A |
| `is_generalist` | boolean \| null | yes | Normalised entropy of sector_weights ≥ 0.85, or stated sector-agnostic |
| `cluster_id` | integer \| null | yes | k-means cluster |
| `industrial_affinity` | number \| null | yes | PROJECT_CONTEXT §4 |
| `stage_earliness` | number \| null | yes | Mean of stage scores |
| `fit` | [Fit](#fit) \| null | yes | Fit score and its breakdown |

## SeedHint

What a user-supplied list claims; Phase 1 verifies before it becomes a fact

| Field | Type | Required | Description |
|---|---|---|---|
| `source_id` | string | yes | User list the hint came from (PROJECT_CONTEXT §6) |
| `listed_focus` | string \| null | yes | Focus as the list states it; unverified |
| `listed_check_or_fund` | string \| null | yes | Check or fund size as listed; unverified |
| `notes` | string \| null | yes |  |

## Competitor.headcount_est



| Field | Type | Required | Description |
|---|---|---|---|
| `value` | integer | yes |  |
| `source` | [Source](#source) | yes | Provenance for a record or a single fact |

## Fit

Fit score and its breakdown

| Field | Type | Required | Description |
|---|---|---|---|
| `total` | number | yes | Fit score, 0–100 |
| `components` | [Fit.components](#fit-components) | yes | Points earned per component; null where inputs were missing |
| `flags` | array of `conflict`, `sparse_data` | yes | Shown next to the score, never scored |

## Fit.components

Points earned per component; null where inputs were missing

| Field | Type | Required | Description |
|---|---|---|---|
| `thesis` | number \| null | yes |  |
| `stage` | number \| null | yes |  |
| `check` | number \| null | yes |  |
| `portfolio_adjacency` | number \| null | yes |  |
| `geography` | number \| null | yes |  |
| `dry_powder` | number \| null | yes |  |

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
- **DatePrecision**: `day`, `month`, `year`
- **CompetitorCategory**: `direct`, `adjacent`, `remote`
- **CompetitorLayer**: `design_intent`, `process_planning`, `plant_ops`, `quality_vision`, `autonomy_tooling`, `robotics`, `full_stack_factory`
- **SizeClass**: `early`, `growth`, `incumbent`
- **RevenueBasis**: `reported`, `none`
- **InvestorFlag**: `not_early_stage_target_by_default`
- **FitFlag**: `conflict`, `sparse_data`
