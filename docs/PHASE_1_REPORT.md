# Phase 1 report — research, data and engines

Branch `phase-1`, 2026-10-30. Research was stopped at the user's request once Tier A was complete ("good enough"; DECISIONS 2026-10-30 "Research closed"). Everything below is generated from the committed data; regenerate with `pnpm pipeline && pnpm coverage:report && pnpm report:tables`.

## 1. Exit checklist (PHASE_1 §10)

| Item | Result |
|---|---|
| Schema additions, JSON Schema regenerated, research tooling | Done (`src/lib/schema/research.ts`, `pnpm research:check`, `pnpm gen:schema`) |
| Finance engine, worked examples and YC SAFE guide, ≥ 95% line coverage | Done (`src/lib/finance`, `pnpm test:coverage`) |
| Tier A: ≥ 60 Western with ≥ 8 sourced rounds | **60** (80 profiled; 3 below 8 rounds, 1 inactive) |
| Tier A: ≥ 10 India with ≥ 8 sourced rounds | **11** |
| Tier B: ≥ 200 profiles | **175** profiled, 104 with ≥ 3 rounds; 25 not researched (stopped early) |
| All §7 competitors profiled | **24 / 24**, plus 20 found by discovery = 44 |
| ≥ 600 rounds with a non-list source, ≥ 400 companies | **1,246** rounds, **1,078** companies |
| All 50 seed-list rows verified | **50 / 50** (49 rounds; Walden listed twice): 34 confirmed, 12 corrected, 3 contested |
| Benchmarks; legal notes with ≥ 2 sources per topic | 31 benchmarks; 24 notes, 8 topics, 4–9 sources each |
| Pipeline analytics | Done: categories, thesis vectors, clusters, layouts, graph metrics, fit features |
| QA: coverage report, conflicts list, sanity UI, determinism | Done: `docs/COVERAGE.md`, `docs/CONFLICTS.md` (684 entries), `/debug` + Directory columns, two clean runs identical apart from timestamps |
| Self-audit precision ≥ 95% | **96.7%**: 30 facts (seed 20261030), re-checked against their sources by a separate agent; 29 correct, 1 wrong, 0 unverifiable. The wrong fact (VentureTech Alliance's stages, inferred from "early to mid-stage") was removed. Table in `docs/COVERAGE.md` |

## 2. Counts

| Investors | Funds | Partners | Rounds | Companies | Competitors | Benchmarks | Legal notes |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 3,317 | 1,210 | 323 | 1,246 | 1,034 | 44 | 31 | 24 |

- Research files: 80 Tier A (median 11 rounds), 177 Tier B (median 2 rounds), 44 competitors, 49 seed-round checks; 3,793 pages cited.
- About 150 research-agent runs. Tier B and round checks ran on Sonnet. One 5-hour usage limit was hit; interrupted agents resumed with their saved work.
- Entity resolution: 77 do-not-merge pairs added after reviewing every new merge (fuzzy collisions, parent vs venture arm, bare names that fit several firms).
- Coverage by tier, source mix and confidence mix: `docs/COVERAGE.md`.

## 3. Top 25 investors by default fit

Default weights (thesis 30, stage 20, check 15, adjacency 15, geography 10, dry powder 10). Unknown features are left out and the remaining weights renormalised; **Known** is the share of weight that was known. Investors flagged `sparse` (≥ 3 of 6 features unknown) are excluded. Raise size is the $1.0M assumption.

| # | Investor | Tier | Fit | Known | thesis | stage | check | adjacency | geography | dry powder | Flags |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | Banana Capital | B | 83.6 | 55% | — | 1.00 | 1.00 | — | 0.70 | 0.40 | |
| 2 | Bezos Expeditions | A | 79.1 | 75% | 0.84 | 0.80 | — | 0.74 | 0.70 | — | |
| 3 | Transition | A | 78.7 | 100% | 0.52 | 1.00 | 1.00 | 0.74 | 0.70 | 1.00 | |
| 4 | seed + speed Ventures | A | 78.0 | 100% | 0.50 | 1.00 | 1.00 | 0.74 | 0.70 | 1.00 | |
| 5 | 2048 Ventures | A | 76.2 | 100% | 0.49 | 1.00 | 1.00 | 0.63 | 0.70 | 1.00 | |
| 6 | Conviction Partners | A | 75.5 | 100% | 0.42 | 1.00 | 1.00 | 0.74 | 0.70 | 1.00 | |
| 7 | Boost VC | B | 75.5 | 100% | 0.50 | 1.00 | 1.00 | 0.57 | 0.70 | 1.00 | conflict |
| 8 | Cleo Ventures | B | 75.3 | 85% | 0.50 | 1.00 | 0.80 | — | 0.70 | 1.00 | |
| 9 | Anti Fund | B | 74.5 | 100% | 0.75 | 1.00 | 1.00 | 0.00 | 0.70 | 1.00 | |
| 10 | 137 Ventures | C | 74.3 | 65% | 1.00 | — | — | 0.49 | 0.70 | 0.40 | |
| 11 | Sarah Smith Fund | B | 74.3 | 70% | — | 1.00 | 1.00 | 0.00 | 0.70 | 1.00 | |
| 12 | Earlybird | A | 72.7 | 100% | 0.40 | 1.00 | 1.00 | 0.78 | 0.70 | 0.70 | |
| 13 | SNAK Venture Partners | A | 72.5 | 100% | 0.68 | 0.80 | 1.00 | 0.28 | 0.70 | 1.00 | |
| 14 | Y Combinator | B | 71.7 | 90% | 0.35 | 1.00 | 1.00 | 0.81 | 0.70 | — | |
| 15 | Sequoia Capital | A | 71.7 | 100% | 0.35 | 1.00 | 1.00 | 0.81 | 0.70 | 0.70 | conflict |
| 16 | Bee Partners | A | 70.7 | 100% | 0.58 | 1.00 | 1.00 | 0.49 | 0.70 | 0.40 | |
| 17 | Haystack | A | 70.5 | 100% | 0.30 | 1.00 | 1.00 | 0.63 | 0.70 | 1.00 | |
| 18 | Lux Capital | A | 70.2 | 100% | 0.52 | 0.80 | 1.00 | 0.84 | 0.70 | 0.40 | |
| 19 | Pax | B | 70.0 | 100% | 0.46 | 1.00 | 0.80 | 0.49 | 0.70 | 1.00 | |
| 20 | Belief Capital | B | 70.0 | 85% | 0.75 | 1.00 | — | 0.00 | 0.70 | 1.00 | |
| 21 | Crane Venture Partners | A | 69.2 | 100% | 0.33 | 1.00 | 1.00 | 0.28 | 1.00 | 1.00 | |
| 22 | Also Capital | A | 69.2 | 100% | 0.38 | 1.00 | 1.00 | 0.39 | 0.70 | 1.00 | |
| 23 | Eclipse | A | 69.1 | 100% | 0.58 | 1.00 | 0.20 | 0.97 | 0.70 | 0.70 | conflict |
| 24 | Convective Capital | A | 68.4 | 85% | 0.39 | 1.00 | — | 0.63 | 0.70 | 1.00 | |
| 25 | Orion VC | A | 68.3 | 75% | 0.67 | 1.00 | — | 0.28 | 0.70 | — | |

Rank 1 rests on 55% known weight and no thesis; read rank together with Known. Phase 2 shows fit bounds (PHASE_2 §2.4).

## 4. Clusters

k-means on thesis vectors (k by silhouette, seed 42); 558 investors have a vector (a portfolio needs ≥ 3 rounds with a known sector).

| Cluster | Top sectors | Size | Example members (highest fit) |
|---|---|---:|---|
| cl_0 | robotics / physical AI · AI infra · AI apps | 78 | Xora, Bosch, SoftBank, Amazon Industrial Innovation Fund |
| cl_1 | AI apps / agents · AI infra · fintech | 136 | seed + speed, Conviction, Cleo Ventures, Y Combinator, Sequoia |
| cl_2 | industrial manufacturing · AI apps · hardware / deep tech | 60 | 1789 Capital, KAS Venture Partners, T. Rowe Price |
| cl_3 | climate / energy · defence / dual use · AI infra | 168 | Transition, Earlybird, Haystack, Lux Capital, Pax |
| cl_4 | fintech · AI apps · enterprise SaaS | 25 | Better Tomorrow, Cambrian, ResilienceVC |
| cl_5 | consumer · health / bio · enterprise SaaS | 20 | ajvc, Neo, Cake Ventures |
| cl_6 | health / bio · enterprise SaaS · fintech | 38 | Supply Change Capital, Virtue, Breakout |
| cl_7 | hardware / deep tech · health / bio · AI infra | 21 | Hitachi Ventures, OVNI Capital, VentureTech Alliance |
| cl_8 | enterprise SaaS · fintech · AI infra | 12 | Founders' Co-op, Fika, High Alpha |

## 5. Surprises in the data

**Investors in several competitors** (any round, any role):

| Investor | Competitors backed |
|---|---|
| SV Angel | Arda, Atoms, Flow Engineering, Meridian, SalesPatriot |
| Pear VC | Galvant, Meridian, Parallax Worlds, SalesPatriot |
| Andreessen Horowitz | Applied Intuition, Atoms, Hadrian |
| Construct Capital | Didero, Hadrian, Nexxa.ai |
| Eclipse | Noetive, Uptool, Vinci |
| Khosla Ventures | Arda, Uptool, Vinci |
| Valor Equity Partners | Flow Engineering, Hadrian |
| Sequoia Capital | Flow Engineering, Magentic |

**Connector investors** (betweenness on the investor–company graph): Y Combinator (0.103, 48 companies), Alumni Ventures (0.073), Accel (0.055), Antler (0.053), General Catalyst (0.045), SV Angel, Khosla, NVIDIA, a16z, 8VC.

**Findings that bear on the raise:**
- **15 direct competitors.** Eight were found by discovery in Phase 1 (Didero, Forgepoint, Uptool, Magentic, Edmund, Spector.ai, IndustrialMind.ai, Procol); Apprentice.io and Galvant moved from adjacent to direct after research. **None delivers through WhatsApp**: they work in the ERP, email, Teams or their own apps.
- **Kalaari Capital** published an AI-in-manufacturing thesis (June 2026) inviting vertical-AI founders and has no factory-AI company yet.
- **Accel (India)** backs US-headquartered companies with Indian founders (Fibr AI, Origin, Ema). **Antler US** requires existing US work authorization; **Antler India's Embark** moves India-based AI founders to San Francisco and helps them incorporate.
- **Construct Capital** (Didero, Nexxa.ai, Hadrian) and **Eclipse** (Noetive, Uptool, Vinci) are the most active backers of our layer. Eclipse carries the `conflict` flag (Uptool, direct, 2026); Construct's Didero round (July 2024) is outside the 24-month window.
- **Seed-list corrections:** 12 of 49 listed rounds were wrong in amount, lead or stage (e.g. Mind Robotics' $900M is two rounds; Merge Labs has no named lead).
- **Pritzker Group Venture Capital** looks wound down (latest deal Dec 2023; two partners left to found SNAK) and carries the `inactive` flag.
- **Same-name firms:** "Transition VC" is both a London fund and a Bengaluru energy fund; research files now disambiguate with a place.

## 6. What could not be found, and why

| Gap | Extent | Why |
|---|---|---|
| Indian-founder policy, US-entity rule | Tier A 20% / 31% known | Rarely stated on firm sites; recorded only when stated |
| Check size, application URL | Tier A 74% / 49% | Many firms take pitches by email or intro only |
| Fund sizes from SEC Form D | most US funds | EDGAR refuses an anonymous User-Agent; we do not send personal data (README rule 5) |
| Tier B rounds | median 2; 104 of 175 have ≥ 3 | Most are small 2025–26 funds with few announced deals |
| HQ, stages for Tier B | 54% / 61% | Agents dropped facts they could not quote verbatim when the fetch tool returned a summary |
| Post-money valuations | 94% of rounds unknown | Rarely disclosed |
| India pre-seed / seed medians | none | Sources give deal counts and averages, not medians |
| 25 Tier B investors | not researched | Stopped early at the user's request |
| Blocked sources | throughout | Business Wire, Crunchbase, YourStory, PitchBook and some firm sites return 403 |

## 7. Open questions for the human

1. **Raise size and instrument.** Fit's check feature assumes a $1.0M post-money SAFE (`RAISE_SIZE_USD`). Confirm or change.
2. **Which entity raises:** the Delaware C-Corp alone, or a flip of the Indian Pvt Ltd under it? It decides how much `requires_us_entity` and the India legal notes matter.
3. **Pitch direction:** design-intent tooling or plant-ops agents? It changes the thesis and adjacency weights.
4. **Who uses the app**, and is anything shared outside (advisors)? It decides Vercel protection and whether partner names show.
5. **The two incoming investor spreadsheets** (`data/raw/incoming/`) have not arrived; nothing was ingested.
6. **The 25 unresearched Tier B investors:** leave as is, or research later?
7. **Phase 2 spec gaps** found while drafting `docs/PHASE_2.md`: "dry powder" cannot be observed (label it "raised by funds closed since …"); total raised is unknown for non-competitor companies (shade by the sum of our sourced rounds, as a lower bound); the founder outcome score is undefined; "outreach tiers" clash with research tiers by name; 9 clusters vs 7 categorical colours.

## 8. Next

`docs/PHASE_2.md` (draft) is ready for review. Phase 2 does not start until this report has been reviewed and `phase-1` merged.
