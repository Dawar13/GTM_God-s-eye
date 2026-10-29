# Phase 1 — Research, data and engines

Read `docs/PROJECT_CONTEXT.md`, `docs/PHASE_0_REPORT.md` and the latest `docs/DECISIONS.md` entries first. If Phase 0 found something that contradicts this file (schema shape, counts, source quality), follow the Phase 0 reality and log the deviation in DECISIONS.md.

Goal: turn seeds into a verified, sourced dataset; compute every analytic the UI needs; build and test the finance engine. **Still no UI polish** — only the minimum wiring needed to eyeball data.

Workstreams, in this order:

| # | Workstream | Can run in parallel with |
|---|---|---|
| 1 | Schema additions + research tooling | — |
| 2 | Finance engine (pure math + tests) | 3–7 |
| 3 | Pilot: 5 investors end to end | 2 |
| 4 | Investor research (Tier A, then B) | 2 |
| 5 | Portfolio rounds + companies | 4 |
| 6 | Competitors | 4 |
| 7 | Benchmarks + India / structure research | 4 |
| 8 | Pipeline analytics | after 4–6 have ≥ 50% coverage, re-run at the end |
| 9 | QA, coverage and audit | last |
| 10 | Hand-off | last |

Commit after every batch. Never hold research only in context; write to files as you go so a new session can resume.

---

## 1. Schema additions and research tooling

### 1.1 New / extended schemas (Zod first, then `pnpm gen:schema`)
- `Partner`: id, investor_id, name, title, focus_sectors, linkedin_url (nullable), sources. Public professional info only. No personal emails or phone numbers.
- `Investor` add: `application_url` (nullable), `accepts_cold_inbound` (`yes | no | unknown`), `invests_in_indian_founders` (`yes | no | unknown`), `requires_us_entity` (`yes | no | unknown`), `portfolio_count_reported` (nullable), `seed_hints` (from Phase 0).
- `Round` add: `date_precision` (`day | month | quarter | year`).
- `Company` add: `sector_classified_by` (`source | model`), `layer` (nullable, same enum as competitors).
- `Benchmark`: id, metric (`median_round_size | median_pre_money | median_post_money | median_dilution | safe_cap_median | safe_share_of_rounds | time_between_rounds | …`), stage, geography, period, value, unit, sources.
- `LegalNote`: id, topic (`india_flip | reverse_flip | fema_pricing | angel_tax | india_convertible_note | isafe | ccps | delaware_requirement`), summary (paraphrased, ≤ 80 words), effective_date (nullable), jurisdiction, sources, `last_verified`.
- Derived fields must say how they were made: `{ value, method, inputs }` for `sector_weights`, `industrial_affinity`, `stage_earliness`, `fit_features`.

### 1.2 Research queue and cache
- `data/interim/research_queue.json`: one entry per entity `{ entity_type, id, tier, status: todo | in_progress | done | blocked, blocked_reason, last_touched }`. Always pick up `in_progress`, then `todo`. This is what makes the work resumable across sessions.
- `data/interim/research_cache/<entity_id>.json`: every page fetched for that entity — url, title, retrieved_at, and the specific fields extracted with a ≤ 25-word supporting snippet each. Snippets are for internal verification only; the dataset stores paraphrases.
- Use subagents (Task tool) for batches of ~5 entities in parallel when available; each subagent writes only its own cache files. The main agent merges into `data/processed/`.

### 1.3 Research protocol (applies to every fact)
1. Search → open the page → extract. Never record a fact from a search snippet alone.
2. Source priority: (a) the firm's / company's own site, fund announcement, SEC Form D, regulator site; (b) reputable press (TechCrunch, Axios, Fortune, WSJ, Bloomberg, Reuters, Sifted, Inc42, Entrackr, The Economic Times); (c) public pages of databases (Crunchbase, Tracxn, PitchBook profiles) as hints only, then confirm in (a) or (b).
3. Confidence: `high` = primary source, or two independent secondary sources agree. `medium` = one reputable secondary. `low` = user-supplied infographic or database page only.
4. Amounts: store in USD with `size_original` + `currency_original` and the FX rate + date used (`atlas/fx.py`, fixed rates table with a source). INR crore: 1 Cr = 10,000,000 INR.
5. No login-walled scraping (LinkedIn, PitchBook, Crunchbase Pro). Use what is publicly visible.
6. Disambiguate names before recording. Several names in this project are ambiguous (e.g. Meridian, Covalent, Omni, Activate, Expeditions, Spark). Confirm the entity by domain + description before saving; log the check.
7. Anything published after June 2026 is outside the model's own knowledge. Treat every 2026 claim from seeds as unverified until fetched.
8. Log each entity in `data/RESEARCH_LOG.md`: date, entity, questions, sources checked, result, conflicts, open items.

---

## 2. Finance engine — `src/lib/finance/`

Pure, deterministic TypeScript. No React, no I/O. Every function has JSDoc with the formula, the assumptions, and a citation (Brad Feld & Jason Mendelson, *Venture Deals*; Y Combinator SAFE user guides; NVCA model documents). Internally use full precision; round only in `lib/format`. Tests use tolerance 1e-6 on fractions and 0.01 on dollars/shares.

### 2.1 Modules and functions
| File | Functions |
|---|---|
| `priced-round.ts` | `pricedRound({ preMoney?, postMoney?, investment, preMoneyFDShares })` → post, pre, price per share, new shares, ownership map |
| `option-pool.ts` | `poolShuffle({ headlinePreMoney, investment, existingShares, existingPool, targetPostPoolPct })` → pool shares to add, price, effective pre-money, post cap table |
| `safe.ts` | `convertPostMoneySafes(...)`, `convertPreMoneySafes(...)`, discount, MFN handling; conversion at a priced round with or without pool top-up |
| `note.ts` | `accrue({ principal, rate, compounding: 'simple' \| 'annual' \| 'monthly', start, end })`, `convertNote({ accrued, cap, capBasis, discount, roundPrice, capitalization })` |
| `cap-table.ts` | `simulate(rounds[])` applying a sequence of SAFEs / notes / priced rounds / pool top-ups; returns a snapshot per step |
| `waterfall.ts` | `distribute({ exitValue, classes[] })` supporting 1x/2x, non-participating, participating, capped participating, seniority stack vs pari passu, conversion decisions; `payoutCurve(exitRange)` |
| `vc-method.ts` | `vcMethod({ exitValue, targetMultiple, retention, investment })` → required ownership, post, pre |
| `fund-math.ts` | `exitOwnership(entry, dilutions[])`, `exitNeededToReturnFund(fundSize, exitOwnership, multiple = 1)` |
| `pro-rata.ts` | `proRata({ ownership, roundSize })`, ownership after with / without pro-rata |
| `power-law.ts` | `simulatePortfolio({ n, distribution, params, trials, seed })` with a seeded PRNG (e.g. mulberry32) so results are reproducible |
| `india.ts` | No math beyond FX and INR formatting. Holds typed references to `LegalNote` ids |

Shared invariants (property tests with fast-check or hand-rolled loops): ownership sums to 1; shares never negative; founders' % never rises in a financing without buybacks; post = pre + new money for priced rounds.

### 2.2 Worked examples to encode as tests (all independently checkable)
1. **Priced round**: pre $8M, invest $2M, 8,000,000 pre shares → post $10M, price $1.00, 2,000,000 new shares, investor 20%.
2. **Option pool shuffle**: same, plus 10% post-money pool created pre-money, no existing pool → pool 1,142,857.14 shares, price $0.875, new shares 2,285,714.29, post FD 11,428,571.43; founders 70%, investor 20%, pool 10%; effective pre-money $7M.
3. **Post-money SAFE → Series A**: founders 9,000,000 shares; SAFE $1M at $10M post-money cap; A at $20M pre, $5M new, no pool change → SAFE converts to 1,000,000 shares at $1.00; A price $2.00; 2,500,000 new shares; post 12,500,000; founders 72%, SAFE 8%, A 20%. With a 20% discount the cap still wins ($1.00 < $1.60).
4. **Convertible note**: $500K, 8% simple, converts after 18 months; A price $2.00; 20% discount; $8M cap on 10,000,000 pre-money shares → accrued $560,000; cap price $0.80 beats discount price $1.60; 700,000 shares.
5. **Liquidation preference**: investor $5M for 25%, 1x non-participating → exit $10M: investor $5M, common $5M; exit $40M: converts, investor $10M, common $30M; breakpoint $20M. Participating uncapped at $40M → $13.75M. Participating capped at 3x ($15M): exit $40M → $13.75M; exit $80M → converts, $20M.
6. **Fund math**: 10% at entry, two later rounds at 20% dilution each → 6.4% at exit. To return a $50M fund: $781.25M exit. A $1B fund needs $15.625B.
7. **VC method**: exit $200M, 20x target, retention 0.5, invest $1M → required ownership 20%, post $5M, pre $4M.
8. **Pro-rata**: 10% owner, round $5M selling 20% → pro-rata $500K; without it ownership drops to 8%.
9. **YC examples**: fetch Y Combinator's current Post-Money SAFE user guide, and encode its worked examples verbatim as additional tests (numbers only; cite the URL in the test file). If your implementation disagrees with YC's example, YC wins — fix the code, log in DECISIONS.md.

Exit for this workstream: `pnpm test` green, coverage ≥ 95% lines on `src/lib/finance`.

---

## 3. Pilot (calibrate before scaling)

Fully profile 5 investors end to end — pick 2 from the seeds with clear industrial/physical-AI focus, 1 generalist seed fund, 1 debut fund, 1 India fund. For each: investor, funds, partners, ≥ 8 portfolio rounds, companies. Run validation. Then write a short note in RESEARCH_LOG.md: time per investor, which sources worked, which fields were consistently unfindable. Adjust Tier A/B field lists if a field is unfindable for 4 of 5. Commit, then scale.

---

## 4. Investor research

### 4.1 Build the candidate pool
Start from all Phase 0 investors (Goldman + seeds), then add these **candidates to check** (names from general knowledge; include only if research confirms they exist, are active and fit):

- *Industrial / hard tech / physical AI early-stage (Western)*: Root Ventures, Eclipse, Lux Capital, Construct Capital, 8VC, Prime Movers Lab, Playground Global, Ubiquity Ventures, Bee Partners, Engineering Capital, Scout Ventures, Shield Capital, Supply Change Capital, Mavka Ventures, Riceberg Ventures, OneSixOne Ventures, Asimov Ventures, Venturetech Alliance, Transition VC, Kadmos Capital, Denver Ventures, Pritzker Group VC, Catamaran Ventures, Premji Invest, Bezos Expeditions, Lockheed Martin Ventures, In-Q-Tel.
- *AI-first / B2B seed (Western)*: Conviction, Air Street Capital, Gradient, Haystack, 2048 Ventures, Crane Venture Partners, Index Ventures (seed), Merantix Capital, Earlybird, seed+speed, Cleo Ventures, Curiosity, Seven Stars, Folklore Ventures, Cornerstone VC, Spark Growth Ventures.
- *Investors in our competitors*: Foundation Capital, Also Capital, Antler, Genius Ventures (Tandem); Valor Equity Partners, Atreides (Flow Engineering); plus whoever Phase 1 competitor research finds.
- *Accelerators / platforms*: Y Combinator, Techstars, Antler, Entrepreneur First, South Park Commons, Neo, Pear VC.
- *Cross-border / immigrant-founder friendly*: Orion VC, Unshackled Ventures, One Way Ventures, Geek Ventures, Hustle Fund.
- *India (toggle, lower priority)*: ajvc, 100X.VC, Speciale Invest, pi Ventures, Ideaspring Capital, Stellaris, Blume, Peak XV (Surge), Accel India, Elevation, Kalaari, Antler India.

### 4.2 Tiering (compute, don't hand-pick)
Preliminary score per candidate:
- +3 Western and early-stage (by seed hints or Goldman fund size ≤ $200M)
- +3 industrial / robotics / hardware / deep tech / supply chain / defence / physical AI signal in hints
- +2 backed a competitor or any company in `seed_rounds.csv` robotics list
- +2 fund closed on/after the freshness cutoff
- +1 per additional seed list it appears in (max +3)
- +1 AI-first thesis

Tier A = top 60–80 Western + top 10 India. Tier B = next ~200. Tier C = everything else (Goldman data only, no research). Save tier + score in the queue. Log the cut lines in DECISIONS.md.

### 4.3 Fields per tier
| Field | Tier A | Tier B |
|---|---|---|
| name, aliases, parent_brand, type, region, HQ, website | ✓ | ✓ |
| stages, leads?, check range | ✓ | ✓ (if stated) |
| thesis (paraphrased, ≤ 60 words) | ✓ | ✓ (≤ 25 words) |
| funds: all known (number, size, close date) | ✓ | latest only |
| partners relevant to industrial / AI / hardware | ✓ | — |
| application_url, cold inbound, Indian founders, US entity requirement | ✓ | if easy |
| portfolio rounds | ≥ 8, prefer last 24 months, prefer our sectors | ≥ 3 notable |
| co-investors on each round | ✓ | — |

Batch size 10. After each batch: merge, `pnpm validate:data`, update queue, commit `data: tier A batch N`.

### 4.4 Incoming spreadsheets
If files exist in `data/raw/incoming/`: write `atlas/ingest/incoming.py` (schema-sniff columns, map to Investor, keep `kind: user_supplied`), merge, re-tier. Log column mapping in DECISIONS.md.

---

## 5. Portfolio rounds and companies

- Every round found in §4 becomes a Round + Company (dedupe companies by domain first, then fuzzy name ≥ 92).
- Verify all 50 rounds in `seed_rounds.csv`: confirm amount, date (month), stage, leads, participants. Upgrade confidence or mark `contested`.
- Company sector: from the company's own description; if classifying with the model, set `sector_classified_by: "model"`.
- Company `layer` only for companies in our space (industrial / robotics / hardware tooling).
- Target: ≥ 600 rounds, ≥ 400 companies by end of phase. Quality over count — never pad.

---

## 6. Competitors

Profile every company in PROJECT_CONTEXT §7, then search for missing ones (queries like "AI agents for manufacturing startup seed", "requirements management hardware AI startup", "factory copilot WhatsApp", "industrial AI India startup funding 2026") and add any that genuinely overlap. For each:
- identity check (domain, founders, HQ, founded year)
- full funding history (all rounds, leads, participants) → Rounds
- category, layer, size_class (by total raised: < $5M, $5–25M, $25–100M, $100M–1B, > $1B)
- product summary (≤ 50 words), publicly named customers, public pricing
- headcount with source (label as approximate), revenue only if publicly reported
- investors → link to Investor records (this feeds the conflict flag and the overlap matrix)

---

## 7. Benchmarks and India / structure research

### 7.1 Benchmarks (→ `benchmarks.json`)
Find the latest available editions and record each metric with period and geography:
- Carta: State of Private Markets (quarterly), pre-seed / SAFE reports — median round size and valuation by stage, median dilution, SAFE vs note share, valuation caps.
- PitchBook-NVCA Venture Monitor — deal counts, median pre-money by stage.
- India: Tracxn / Inc42 / Bain India VC report — pre-seed and seed medians.
- Fund-level: Q3 2026 stats from the Freesbee post (debut 22 funds, $774M, median $33M; established median $105M) as `user_supplied`, plus Carta/PitchBook fund data if available.

### 7.2 Legal / structural notes (→ `legal_notes.json`)
Facts with sources and dates, no recommendations. Mark every note "not legal or tax advice — confirm with your CA / counsel".
- India flip: how it's done (share swap vs. new Delaware parent), Overseas Investment rules, tax consequences, typical cost and timeline ranges if published.
- Reverse flip trend (Indian startups moving domicile back before IPO) and why.
- Whether YC and typical US seed funds require a Delaware parent; how they treat India-operating companies.
- FEMA pricing for non-resident investment in Indian unlisted companies.
- Current status of India's angel tax (Section 56(2)(viib)).
- Convertible notes for DPIIT-recognised startups (minimum ticket, tenure).
- India SAFE variants (e.g. iSAFE) and CCPS / CCD basics.
- Each topic gets ≥ 2 sources, at least one primary (RBI, Income Tax Dept, DPIIT, Ministry of Finance) where one exists.

---

## 8. Pipeline analytics — `pipeline/atlas/analyze/`

Add deps: `scikit-learn umap-learn networkx`. All randomness seeded (`random_state=42`). Each module writes to `data/processed/` and is idempotent.

| Module | Output |
|---|---|
| `categorize.py` | freshness, maturity, is_early_stage, region fill-ins (PROJECT_CONTEXT §3) |
| `thesis.py` | sector_weights = 0.5 × stated-thesis vector (keyword map in `config.py`, logged hits) + 0.5 × portfolio sector share (recency-weighted: last 24 months × 1.0, older × 0.5). If one input is missing use the other, record `method`. Normalised entropy → `is_generalist` (threshold 0.85) |
| `cluster.py` | k-means on non-generalists, k ∈ [4, 10] by silhouette; cluster names generated from top-3 sectors of each centroid; UMAP 2D (fallback PCA) → `layout_thesis.json` |
| `axes.py` | industrial_affinity, stage_earliness, typical check (geometric mean of min/max), latest fund size → `layout_bubbles.json` (x, y, z, size, colour key) |
| `graph.py` | nodes (investors, companies), edges (round participation; attrs: lead, stage, amount, date); metrics: degree, weighted degree, betweenness; VC↔VC co-investment edges (weight = shared rounds, keep weight ≥ 2) → `graph.json` |
| `competitors.py` | investor × competitor overlap matrix → `competitor_overlap.json` |
| `fit.py` | fit **features** only (each 0–1): thesis, stage, check (uses raise size from `config.py`, default $1.0M, overridable), adjacency (recency-weighted count of portfolio companies in our layers), geography/structure, dry powder; flags: conflict (backed a direct competitor in last 24 months), sparse (> 40% of inputs null) → `fit_features.json`. Weighted total is computed in TypeScript so UI sliders work live |

Graph layout: `scripts/layout-graph.ts` (Node, graphology + ForceAtlas2, fixed iterations and seed) writes x/y into `graph.json`. Doing it in Node keeps layout identical to what Sigma renders.

Also add `src/lib/fit/score.ts`: `fitScore(features, weights)` with tests (weights normalised, monotonic in each feature, flags pass through).

---

## 9. QA, coverage and audit

1. `scripts/coverage-report.ts` → `docs/COVERAGE.md`: per tier, % non-null per field; source kind mix; confidence mix; counts of investors, funds, partners, rounds, companies, competitors, benchmarks, legal notes.
2. **Self-audit**: randomly sample 30 facts (fixed seed) across types. Re-open each source and check the value. Record precision in COVERAGE.md. If precision < 95%, find the failure pattern, fix the batch it came from, re-sample.
3. Conflicts list: every field with disagreeing sources and which one won.
4. Minimal sanity UI (no styling): Directory shows tier, fit features and sources; a raw table page for rounds; a debug page that dumps cluster sizes and graph metrics. This is only to eyeball data; Phase 2 replaces it.

---

## 10. Exit criteria

- [ ] Finance engine: all worked examples + YC examples pass; coverage ≥ 95%
- [ ] Tier A: ≥ 60 Western + ≥ 10 India investors fully profiled; each with ≥ 8 sourced rounds
- [ ] Tier B: ≥ 200 investors with required fields
- [ ] All §7 competitors profiled (plus any new ones found), with funding history and investor links
- [ ] Benchmarks and legal notes recorded with ≥ 2 sources per legal topic
- [ ] All analytics files generated, deterministic on re-run (diff-clean)
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm validate:data` and `uv run pytest` pass
- [ ] Self-audit precision ≥ 95%; COVERAGE.md and RESEARCH_LOG.md complete

## 11. Hand-off

Write `docs/PHASE_1_REPORT.md`:
- final counts and coverage; audit precision
- top 25 investors by default fit score, with feature breakdown (table, no prose)
- clusters found (name, size, example members)
- surprises in the data (e.g. investors who back several competitors, connector investors with high betweenness)
- what could not be found and why
- open questions for the human (raise size, instrument, entity, pitch direction)

Then draft `docs/PHASE_2.md` (all views, calculators, graph interactions, gamified layer, performance, accessibility, deploy), based on what the data actually looks like. Stop and wait for review.
