# Phase 1 — Research, data & engines

Read `docs/PROJECT_CONTEXT.md`, then `docs/PHASE_0_REPORT.md`, then the latest entries of `docs/DECISIONS.md`. This phase fills the data with sourced facts, computes the analytics in the pipeline, and builds the finance math engine. **No new UI in this phase** beyond what's needed to check data (Phase 2 builds the views).

Work in order. After each numbered step: run the checks listed, commit with a conventional message, then continue. If a step fails twice, stop and report instead of improvising around it. There are two **human checkpoints** (steps 3 and 6): stop and wait for approval there.

---

## 0. Preconditions (human does this before starting)

- Phase 0 reviewed; `phase-0` merged to `main`; a `phase-1` branch created.
- Answers to the Phase 0 open questions recorded in `docs/DECISIONS.md`: raise size and instrument, pitch lean (design intent vs plant ops), frontier-list flag policy, bare "Accel", whether `data/raw/customers/` stays in git.
- Missing inputs added: infographic images and `data/raw/sources/linkedin_posts.md`; One Way Summit SF list 1; the two investor spreadsheets in `data/raw/incoming/`.
- Web access (search and fetch) available to Claude Code.

Claude Code: verify these. List what's missing and continue with the rest.

## 1. Contracts first

Research output needs somewhere reviewable to live before any research starts. The pipeline overwrites `data/processed/`, so research must not be written there by hand.

1. **Research cards.** Add Zod schemas and a folder `data/research/`:
   - `investors/<inv_id>.json` and `companies/<co_id>.json`: `{ entity_id, researched_at, fields: { <field>: { value, sources: Source[], confidence } }, funds: [...], rounds: [...], notes }`. Rounds and funds inside a card use the same shapes as the processed records, with sources.
   - The pipeline's `enrich/` step merges cards over Phase 0 records: a card field wins over a seed hint, and conflicts are logged.
2. **Per-field provenance.** PROJECT_CONTEXT §5.7 wants a source icon on every number. Decide how a field points at its sources (for example `field_sources: { check_min_usd: [0, 2] }` indexing into `sources`), add it to Investor, Fund, Company, Competitor and Round, and log the choice.
3. **New datasets:** `benchmarks.json` (metric, stage, region, period, value, unit, sample size, sources), `layout.json` (thesis-map coordinates per investor), `graph.json` (nodes, edges, metrics, precomputed positions).
4. Extend `validate:data`: every non-null numeric field on a record must be covered by `field_sources`; cards must point at existing ids.

Check: `pnpm gen:schema && pnpm validate:data && pnpm test` pass; the dictionary shows the new fields.

## 2. Remaining user inputs

1. Inspect each incoming spreadsheet, map its columns, and ingest it as `user_supplied` hints with a new `source_id` (added to PROJECT_CONTEXT §6).
2. Transcribe anything in `linkedin_posts.md` and the infographics that `data/seed/` doesn't already hold; flag logo-read names.
3. Re-run the pipeline. **Review every new entry in `merges.json`**; add wrong merges to `DO_NOT_MERGE` with a one-line reason (as Phase 0 did).

Check: `pnpm pipeline`, `uv run pytest`, `pnpm validate:data`; new merges reviewed and logged in DECISIONS.

## 3. Pick the research tiers — human checkpoint

Targets (PROJECT_CONTEXT §10): **Tier A ≥ 60 Western early-stage investors fully profiled**, each with ≥ 8 sourced portfolio rounds; **Tier B ≥ 200 shallow profiles**.

1. Candidate pools: seed-list investors (191), the 82 Goldman funds closed since the 2024-10-29 cutoff and other debut/emerging managers, investors in the robotics and physical-AI rounds, backers of the §7 competitors, and the incoming spreadsheets.
2. Rank candidates on cheap signals already in the data: region western or unknown, early-stage hints, `seed_list_count`, fresh Goldman fund, industrial/robotics/physical-AI hints, not flagged late-stage.
3. Write `data/research/TIER_CANDIDATES.md`: about 90 Tier A candidates (expect some to drop out as not early stage or not active) and about 250 Tier B, one line of reasoning each.

**Stop. The human approves or edits the Tier A list before deep research starts.**

## 4. Research protocol (every entity)

Sources, in order of preference: the firm's own site (thesis, team, portfolio page), fund announcements, SEC Form D on EDGAR (fund size and date), company press releases, then secondary sources (TechCrunch, Axios, Fortune, Crunchbase public pages, LinkedIn).

Rules (PROJECT_CONTEXT §5, restated because they decide everything):

- No fact without a URL and `retrieved_at`. If it can't be found, the field stays `null`.
- Never fill from memory. Anything after June 2026 must be verified on the web.
- An amount from a single secondary source is `confidence: medium`.
- When sources conflict, keep both, pick the primary, and add a row to `data/RESEARCH_LOG.md`.
- Every research action (including searches that found nothing) is a row in `RESEARCH_LOG.md`.

Per **Tier A** investor: name, aliases, parent brand, type, HQ city and country, region, stages, check range, leads (yes/no), thesis (paraphrased, 40 words or fewer), website, LinkedIn, every fund found (number, size, close date), at least 8 portfolio rounds (company, date, stage, amount, lead or participant), and sector evidence for the thesis vector.
Per **Tier B** investor: type, HQ and region, stages, latest fund, website, one-line thesis, at least 2 portfolio companies.

While doing this, verify or reject every `seed_hint` and every Goldman anomaly on the investors touched.

Work in batches of 10 investors. After each batch: write the cards, run the pipeline and validation, update `data/research/STATUS.md` (done / in progress / dropped and why), and commit.

Check per batch: `pnpm pipeline && pnpm validate:data && uv run pytest`.

## 5. Competitors

1. Profile every company in PROJECT_CONTEXT §7: what it does (confirm layer and category against its own site), HQ, founded year, rounds with sources, total raised (sum of sourced rounds, or a reported total), headcount estimate (labelled, with its source), revenue only if publicly reported, public pricing, investors.
2. Identify Covalent, Meridian, Galvant, SalesPatriot and Parallax Worlds first. Several names are common; record how each was identified.
3. Move verified competitors (including Atoms and Machina Labs) from `companies.json` to `competitors.json`.
4. Re-check `category: direct` against the pitch-lean answer from step 0.

Check: every competitor has at least one primary source; `validate:data` passes.

## 6. Benchmarks and structure research — human checkpoint

1. **Round benchmarks:** median pre-seed and seed round size, valuation and dilution, US and India where published (Carta, PitchBook-NVCA Venture Monitor, AngelList, Peter Walker / Carta posts). Latest period available, written to `benchmarks.json` with period and sample size.
2. **India instruments:** CCPS, CCD, iSAFE, the FEMA pricing rules for non-resident investment, and the current status of angel tax. Write `docs/research/INDIA_INSTRUMENTS.md`, every rule with its regulation and date.
3. **India flip:** what US investors expect, mechanics (share swap, FEMA/ODI, tax), cost, time, and alternatives. Write `docs/research/INDIA_FLIP.md` as trade-offs, **no recommendation** (PROJECT_CONTEXT §1).

**Stop. The human reviews the two research notes before the India calculator rules are coded.**

## 7. Pipeline analytics (`pipeline/atlas/analyze/`)

Add `scikit-learn umap-learn networkx httpx`. Every step is deterministic (fixed seeds) and tested against hand-computed cases.

1. `categorise.py`: freshness (cutoff from config), maturity, `is_early_stage`, `is_generalist` (normalised Shannon entropy of `sector_weights` ≥ 0.85, or a stated sector-agnostic thesis).
2. `thesis.py`: `sector_weights` = 0.5 × stated thesis + 0.5 × portfolio share by sector; record which inputs existed.
3. `cluster.py`: k-means on non-generalists, k from 4 to 10 by silhouette; generalists assigned to the nearest cluster for colour only; UMAP to 2D (PCA fallback) → `layout.json`.
4. `affinity.py`: industrial affinity and stage earliness exactly as PROJECT_CONTEXT §4.
5. `fit.py`: the six components with default weights 30/20/15/15/10/10; flags `conflict` (backed a direct competitor in the last 24 months) and `sparse_data` (unknown share > 40%). Our round size comes from config, labelled as an assumption until answered.
6. `graph.py`: nodes and edges from rounds (lead, participant, role not stated); degree, weighted degree, betweenness, VC↔VC co-investment counts → `graph.json`. Precompute ForceAtlas2 positions with a small `scripts/layout-graph.ts` using `graphology-layout-forceatlas2` (already installed), so Phase 2 doesn't lay out at runtime.

Check: `uv run pytest`, `pnpm pipeline`, `pnpm validate:data`; the same input twice gives byte-identical outputs.

## 8. Finance engine (`src/lib/finance/`)

Pure TypeScript functions, Vitest, 100% coverage on this folder. Decide the money and share rounding rules first (for example: shares floor to whole shares, money to cents) and log them.

Each tool gets the worked example below **and** at least one example from a published source, cited in the test name (for example YC's Post-Money SAFE user guide). The examples below were computed by hand; if one disagrees with a published method, stop and flag it rather than adjusting the test to pass.

| Function | Worked example |
|---|---|
| Round builder | Pre-money $8M + new money $2M → post-money $10M, investor 20.0%. With 10,000,000 pre-round shares: price $0.80, 2,500,000 new shares. |
| Option pool shuffle | Pre-money $8M, raise $2M, 10% post-money pool created before the round → effective pre-money $7M. |
| Post-money SAFE | Founders 9,000,000 shares; $1M SAFE at $10M post-money cap → 1,000,000 SAFE shares (10%). Series A $5M at $20M pre-money (pre-money includes SAFE shares): price $2.00, 2,500,000 new shares. After: founders 72.0%, SAFE holder 8.0%, Series A 20.0%. |
| Pre-money SAFE | The same inputs side by side with the post-money SAFE, showing the difference in founder dilution; take the pre-money mechanics from a published source. |
| Convertible note | $500K at 8% simple interest for 18 months → $560,000 converting; price = lower of cap price and discounted round price. |
| Liquidation waterfall | $10M invested for 20%. 1x non-participating: exit $30M → investor $10M, common $20M; exit $80M → investor converts, $16M. 1x participating: exit $30M → $10M + 20% × $20M = $14M. Participating capped at 3x ($30M): exit $200M → investor converts, $40M. Add a two-series case for seniority vs pari passu. |
| VC method | Exit $500M, target 10x, 50% expected dilution → post-money $25M; with a $5M investment → pre-money $20M. |
| Fund math | $50M fund, 10% at entry, 50% follow-on dilution → 5% at exit; the exit needed to return the fund is $1B. Same ownership in a $1B fund → $20B. |
| Power law simulation | Seeded random generator; the same seed gives the same histogram; document the outcome distribution used. |
| India instruments | Only after step 6 is approved: CCPS/CCD conversion and a check against the FEMA pricing floor. |

Check: `pnpm test` with coverage at 100% on `src/lib/finance/`; lint and typecheck pass.

## 9. Exit checklist

- [ ] Tier A: at least 60 Western early-stage investors fully profiled, each with at least 8 sourced portfolio rounds
- [ ] Tier B: at least 200 shallow profiles
- [ ] Every competitor in PROJECT_CONTEXT §7 profiled; verified ones in `competitors.json`
- [ ] Every non-null number has a source (`validate:data` enforces it)
- [ ] `benchmarks.json`, `layout.json`, `graph.json` and fit scores exist and validate
- [ ] Finance functions pass worked-example and published-example tests, 100% coverage
- [ ] `data/RESEARCH_LOG.md` complete; every new merge reviewed
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm validate:data` and `uv run pytest` pass

## 10. Hand-off

Write `docs/PHASE_1_REPORT.md`: what was researched, counts per tier, coverage gaps, conflicts found, decisions made, and open questions. Then draft `docs/PHASE_2.md` from PROJECT_CONTEXT §10: every view and calculator on real data, the gamified layer, the inspector with per-number provenance, responsiveness, and performance (including the Directory payload noted in the Phase 0 report). Also cover the protected Vercel deploy. Stop and wait for review.
