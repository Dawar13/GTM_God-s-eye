# Phase 0 report — Foundation

Date: 2026-10-29. Branch: `phase-0` (11 commits, not merged to `main`). Status: **done, waiting for review before Phase 1.**

## What was built

| Area | What exists now |
|---|---|
| App | Next.js 16.4 (App Router, Cache Components), React 19.3, strict TypeScript, Tailwind 4 + shadcn/ui on Radix. Versions are pinned and listed in `docs/DECISIONS.md`. |
| Shell | Left rail (5 sections, collapsible to icons), filter bar (region / stage / type / fund age / sector, wired to Zustand, Western by default, not yet applied to views), resizable inspector (mouse and keyboard), URL-routed sub-tabs, dark and light themes saved per browser, amber focus ring, reduced-motion support, skip link. |
| Routes | `/`, `/vc-math/[tool]` (10 tools), `/investors/[view]` (4 views), `/competitors`, `/strategy`. Every route renders: either a one-sentence empty state saying which phase fills it, or (Command, Directory) real data. |
| Data contracts | Zod schemas for Investor, Fund, Company, Competitor, Round, Source, Anomaly and Merge, in `src/lib/schema/`. `pnpm gen:schema` writes JSON Schema (`data/schemas/`) and `docs/DATA_DICTIONARY.md`. `pnpm validate:data` parses every processed file and checks cross-file integrity. |
| Pipeline | Python (uv) in `pipeline/atlas/`: Goldman PDF ingest, seed-list ingest, investor name resolution, record building, and JSON export validated against the generated JSON Schema. `pnpm pipeline` runs it and prints a summary. |
| Data in the app | Command lists raw counts. Investors → Directory is a sortable table of all 929 investors; clicking or pressing Enter on a name opens its raw record in the inspector. |
| Tests | 37 Vitest tests (schemas, integrity, formats, directory rows) and 68 pytest tests (Goldman parsing including every row PHASE_0 §6.7 names, name matching, geography, seeds end to end). |

Exit checklist (PHASE_0 §10): all items pass. `pnpm lint`, `typecheck`, `test` and `validate:data` pass; `uv run pytest` passes; `next build` passes with every route prerendered. Every route, plus keyboard use, the theme toggle, phone width and reduced motion, was checked in headless Chrome with no console errors.

## Counts

| | Count | Notes |
|---|---:|---|
| Investors | 929 | 712 from the Goldman fund list, 191 on seed lists (27 on both), 53 stubs that only appear as round investors |
| Funds | 973 | 971 indexed Goldman rows + 2 unindexed rows above row 1 |
| Companies | 49 | from 50 seed rounds; 20 tagged robotics/physical AI by their list, 29 sector unknown |
| Rounds | 49 | 50 listings; Walden Robotics appears on both lists and became one round. 30 seed, 19 stage undisclosed |
| Round edges | 100 | 48 lead, 20 participant, 32 role not stated by the source |
| Name merges | 64 | 61 same normalised name, 2 alias (a16z, USV), 1 fuzzy (Constanoa → Costanoa) |
| Merges blocked | 11 pairs | wrong merges found in review; `DO_NOT_MERGE` in `pipeline/atlas/config.py` |
| Anomalies | 70 | all from the Goldman list; breakdown below |
| Region | 676 western · 3 india · 30 other · 220 unknown | unknown is mostly seed-list names without a location |
| Goldman funds closed on or after the freshness cutoff (2024-10-29) | 82 | candidates for "fresh fund" once Phase 1 computes categories |

Investor `type` is set only for the 40 frontier-lab names (guesses, confidence low). Everything else is null for Phase 1. 37 investors carry `not_early_stage_target_by_default`.

## Problems found in the source data

**Goldman list (`goldman_sub200m_funds.pdf`)**, 70 anomalies flagged, none silently fixed:

- **Not a final amount (28):** the notes say target, first close, raising, unconfirmed, or "assumption" (Founder Collective: "previous fund was $75M, so assumption is that it is a similar size"). These funds are `confidence: low`.
- **Dates (11):** impossible or malformed: `9/10/2925` (Flybridge), `6/27/0203` (Uncork), `12/23/2106` (Algebra), `715/2025` (Verified), `213/2024`, `7/30/32022`, `10/272020`, `5/2/22018`, `78/2021`. The year column is used instead. Two valid dates disagree with the year column (Prudence 2024 vs 2023, Tenzing 2022 vs 2023).
- **Amounts (8):** `93/3` (Deciens), blank for PivotNorth, Haywire and BBG Ventures, `$4,100` for Anthology Fund (left null). AIX $202M, Blockchain Capital $250M and Benhamou $480M are above the list's own $200M ceiling (kept, flagged).
- **Name typos (17):** Ventrues ×5, Ventues ×4, Capial ×2, Captal, Venure, Ventture, Partnes, Venturesq, Opportuniy. Display names keep the typo; matching treats it as the intended word.
- **Structure:** two fund rows sit above row 1 with no index (Hyperstition, BBG Ventures). 14 links overflow into a ninth column, and two more wrap mid-cell; all are rejoined. Fund numbers `1` and `Opp Fund`.
- **Internal conflicts not flagged by rule:** BBG Ventures has a Fund II dated 2024 and a Fund III dated 2021. Haystack has two rows both labelled Fund V (2019, 2020). Uncork's $200M row links to an article about $400M.

**Seed lists:**

- **Hints that disagree:** Crane Venture Partners is listed with a $150M Q3 2026 close and a $484M 2026 fund. Primary Venture Partners' "2026 fund $625M" is far above its Goldman history ($30M → $100M → $150M). Kept as hints for Phase 1.
- **Logo-read names:** `freesbee_q3_2026_fund_closes` names were read from treemap logos (the list says "verify spelling").
- **Ambiguous names:** bare `Accel` on the frontier list doesn't say which Accel. `Expeditions` (Q3 closes) vs `Bezos Expeditions` (AI investors) are kept apart.
- **Different firms that normalise alike**, found in review and blocked: Collide Capital / Collider Ventures, Corigin / Origin, House Capital / The House Fund, Amplify Ventures / Amplify Partners, ATX Seed Ventures / ATX Venture Partners, IDG Capital / IDG Ventures, Bain Capital / Bain Capital Ventures, Atomic / Atomico, Cleo Capital / Cleo Ventures, Spark Growth Ventures / Spark Capital (separated by rule).
- **Robotics round list** names investors without saying who led, so those edges are stored as "role not stated" rather than guessed.

## Things that need your attention

**Missing inputs.** Not in the repo; Phase 0 parses none of them, but Phase 1 needs them:

1. The infographic images and `data/raw/sources/linkedin_posts.md` (PHASE_0 §0).
2. One Way Summit SF list 1 (only list 2 was provided).
3. The two incoming investor spreadsheets (PROJECT_CONTEXT §6), to go in `data/raw/incoming/`.

**Open questions:**

1. **Raise size and instrument** (PROJECT_CONTEXT §11.1). The fit score's check-size component needs a number. Default stays $1.0M post-money SAFE, labelled "assumption", unless you say otherwise.
2. **Pitch lean** (§11.3): design-intent tooling or plant-ops agents? This decides which competitors count as direct, and the thesis weights in the fit score.
3. **Which entity raises / India flip** (§11.2). Phase 1 will research and present the trade-off; it needs your constraints (timing, existing Indian shareholders).
4. **Who uses this, and is it shared outside the team** (§11.4)? This matters now: the customer target lists in `data/raw/customers/` are committed to git. If the repo will be pushed or shared, say whether they should be removed from history and gitignored.
5. **Frontier-list flag.** Following your list's notes, a16z, Lightspeed, Founders Fund, General Catalyst and the other frontier-lab names are flagged "not an early-stage target by default", except Sequoia and Conviction, which run sub-$200M funds on the Goldman list. Keep that default, or exempt the large multi-stage VCs?
6. **Bare "Accel"** on the frontier list: should it be treated as Accel US?
7. **Display names with typos** ("ATX Seed Ventrues", "Blossom Capial") stay as written until a source confirms the spelling in Phase 1. Fine, or correct obvious ones now?
8. **Merge review.** 64 merges are in `data/processed/merges.json`, and all were reviewed here. Do you want to scan them, especially the display names chosen ("Greycroft Partners", "TLV Ventures", "Haystack")?
9. **Branch.** Work is on `phase-0`. Merge to `main` after review?

## Notes for Phase 1 and 2

- The Directory page inlines every investor record for the inspector (~1.4 MB HTML). Phase 2 has to page or fetch records on demand to reach Lighthouse 85.
- Loaders use `"use cache"`; restart `pnpm dev` after re-running the pipeline.
- Next 16.4 validates "instant navigation": anything that reads URL params must sit under `<Suspense>` (see `docs/DECISIONS.md`).
- Every new data source will produce new name merges; review `merges.json` each time and extend `DO_NOT_MERGE` when two firms collide.
