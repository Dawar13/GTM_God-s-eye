# Research workspace

Everything here is input to the pipeline and is committed. Web research costs real fetches and can't be regenerated, so it lives here rather than in `data/interim/` (see DECISIONS, 2026-10-30).

| Path | What |
|---|---|
| `queue.json` | One entry per entity to research, with tier, score and status. Rebuilt by `uv run python -m atlas.research_queue`; statuses survive rebuilds. |
| `TIERS.md` | Readable tier list with the reasons for each score. |
| `cache/<key>.json` | One research file per entity, written by a research agent. Merged into `data/processed/` by `pnpm pipeline`. |
| `benchmarks.json` | Benchmark records (schema `Benchmark`). |
| `legal_notes.json` | Legal / structure notes (schema `LegalNote`). |
| `STATUS.md` | Batch log: who did what, when. |

Schemas for every file are in `data/schemas/research_*.schema.json`, generated from `src/lib/schema/research.ts`.

## Protocol (PHASE_1 §1.3), for every fact

1. **Search, then open the page, then extract.** Never record a fact from a search-result snippet.
2. **Source priority:** (a) the entity's own site, fund announcement, SEC Form D, regulator site → page `kind: "primary"`; (b) reputable press (TechCrunch, Axios, Fortune, WSJ, Bloomberg, Reuters, Sifted, Inc42, Entrackr, The Economic Times, Business Insider, The Information, Forbes, VentureBeat, GeekWire, Crunchbase News) → `kind: "press"`; (c) public database pages (Crunchbase, Tracxn, PitchBook profiles, CB Insights) → `kind: "database"`, used as hints and confirmed in (a) or (b) whenever possible.
3. **Confidence is computed by the pipeline** from the pages behind each fact: any primary page, or two press pages from different domains → high; one press page → medium; database page only → low. So list every page that supports a fact.
4. **Amounts:** record `amount_original` / `size_original` and `currency_original` as announced. INR in rupees (₹1.5 Cr = 15000000). The pipeline converts to USD with `atlas/fx.py`.
5. **No login-walled pages** (LinkedIn feeds, PitchBook, Crunchbase Pro). Public pages only. LinkedIn profile URLs may be recorded when the firm's own site links to them.
6. **Disambiguate** before recording: confirm the entity by its domain and description, and write how in `identity_check` (including what it is *not*, e.g. "Spark Growth Ventures, not Spark Capital").
7. **Anything published after June 2026 is outside the model's knowledge.** Every 2026 claim must come from a fetched page. Never fill a value from memory; if it can't be found, leave it out and add it to `open_items`.
8. **Snippets** (≤ 25 words, copied from the page) are for internal verification. Values like `thesis_text`, `description` and `product_summary` are paraphrased in your own words.
9. **Partners:** public professional information only (name, title, focus, a public profile URL). Never emails or phone numbers.

## Investor file (`entity_type: "investor"`)

Required for every tier: `key`, `entity_type`, `tier`, `name` (official, as the firm writes it), `status` (`active | inactive | not_found | not_an_investor`), `researched_at`, `identity_check`, `pages`, `facts`, `funds`, `partners`, `rounds`, `conflicts`, `open_items`.

`facts` holds any of: `aliases, type, website, linkedin, hq_city, hq_country (ISO-2), stages, check_min_usd, check_max_usd, leads, thesis_text, stated_sectors, application_url, accepts_cold_inbound, invests_in_indian_founders, requires_us_entity, portfolio_count_reported`. Each is `{ "value": …, "pages": [indexes into pages], "snippet": "≤ 25 words" }`. Leave a fact out rather than guess.

| | Tier A | Tier B |
|---|---|---|
| identity, type, HQ, website | required | required |
| stages, leads, check range | required if stated anywhere | if stated |
| thesis_text | ≤ 60 words | ≤ 25 words |
| stated_sectors | from the firm's own description, using the 16 sector ids | same |
| funds | all known (number, size, close date) | latest only |
| partners | those relevant to industrial / AI / hardware | — |
| application_url, cold inbound, Indian founders, US entity | required (use `unknown` only after looking) | if easy |
| rounds | ≥ 8; prefer the last 24 months and our sectors; with co-investors | ≥ 3 notable |

Each round: `company` (`name, website, description, hq_country, founded_year, sector, sector_classified_by, layer`), `stage`, `stage_raw`, `date` + `date_precision` (`YYYY-MM-DD` day, `YYYY-MM` month, `YYYY-Qn` quarter, `YYYY` year), `amount_original`, `currency_original`, `valuation_post_original`, `leads`, `participants`, `unspecified` (investor names as the source gives them; the researched investor must appear in one of the three), `pages`, `snippet`.

- `sector_classified_by: "source"` when the company's own words put it in the sector; `"model"` when you classified it.
- `layer` only for industrial / robotics / hardware-tooling companies: `design_intent, process_planning, plant_ops, quality_vision, autonomy_tooling, robotics, full_stack_factory`.

## Sector ids

`ai_infra, ai_apps_agents, industrial_manufacturing, robotics_physical_ai, defense_dual_use, hardware_deeptech, space, climate_energy, mobility_ev, supply_chain_logistics, enterprise_saas, dev_tools, fintech, health_bio, consumer, crypto_web3`

## Stages and types

Stages: `pre_seed, seed, series_a, series_b, series_c_plus, growth` (rounds may also be `strategic, undisclosed`). Investor types: `vc, cvc, angel, syndicate, family_office, sovereign, asset_manager, accelerator, strategic, individual`.
