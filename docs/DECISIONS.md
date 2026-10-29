# Decisions

Dated log of every non-obvious choice. Newest entry at the bottom. The latest entry states the current phase.

---

## 2026-10-29 — Phase 0 started

- Repo root is the VS Code workspace folder (`GTM_finance_God's eye`); the package is named `capital-atlas`. The folder name contains an apostrophe and spaces, which npm rejects as a package name, so `create-next-app` was run in a scratch folder named `capital-atlas` and its output copied in.
- Work happens on the `phase-0` branch. Merge to `main` after the Phase 0 review.
- Missing at start (PHASE_0 §0): the infographic images and `data/raw/sources/linkedin_posts.md`. Phase 0 parses neither, so work continued without them. The two seed CSVs and the Goldman PDF were present. The customer lists were copied from `~/Downloads`.

## 2026-10-29 — Stack versions (exact, pinned in package.json)

Toolchain: Node 24.13.0, pnpm 10.33.0, Python 3.12.4, uv 0.12.19, git 2.47.1.

| Package | Version | Note |
|---|---|---|
| next / eslint-config-next | 16.4.3 | Template defaults kept: `cacheComponents`, `partialPrefetching` |
| react / react-dom | 19.3.0 | |
| typescript | 5.9.3 | `strict`, `noUncheckedIndexedAccess`, target ES2022 |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | See below |
| shadcn (CLI + `shadcn/tailwind.css`) | 4.23.0 | `--base radix --preset nova` (style `radix-nova`) |
| radix-ui | 1.8.1 | |
| cn | 0.5.0 | shadcn's own clsx + tailwind-merge replacement; generated components import it |
| class-variance-authority | 0.7.1 | |
| tw-animate-css | 1.4.0 | |
| zod | 4.6.7 | |
| zod-to-json-schema | 3.25.2 | Installed per spec; see step 4 entry for which generator is used |
| zustand | 5.0.16 | |
| @tanstack/react-table | 9.3.1 | v9 API (not v8) |
| framer-motion | 14.7.1 | |
| clsx / tailwind-merge | 2.1.1 / 3.7.0 | |
| lucide-react | 1.64.0 | |
| recharts | 3.10.1 | Phase 2 |
| d3 / @types/d3 | 7.9.0 / 7.4.3 | Phase 2 |
| react-plotly.js / plotly.js-dist-min | 4.1.0 / 4.1.2 | Phase 2 |
| graphology / graphology-layout-forceatlas2 | 0.26.0 / 0.10.1 | Phase 2 |
| sigma / @react-sigma/core | 4.0.4 / 6.0.0 | Phase 2 |
| vitest / @vitest/coverage-v8 | 5.0.5 | |
| tsx | 4.23.15 | |
| prettier / prettier-plugin-tailwindcss | 3.9.10 / 0.8.1 | |
| eslint | 9.39.5 | |
| @types/node | 24.19.2 | Matches Node 24; vitest 5 needs ≥ 22 |

- **Tailwind through PostCSS, not the Turbopack loader.** `create-next-app` 16.4 wires Tailwind through `turbopack.rules` + `@tailwindcss/turbopack`, which only works under Turbopack. PHASE_0 §2.1 asks for nothing we'd need to undo later, so we use `@tailwindcss/postcss` (`postcss.config.mjs`), which works with Turbopack and webpack alike.
- **shadcn on Radix.** shadcn 4 defaults to Base UI; PROJECT_CONTEXT §8 says Radix primitives, so init used `--base radix`.
- **`typecheck` runs `next typegen` first.** Next 16 generates the global `PageProps` / `LayoutProps` types into `.next/types`. Without typegen, `tsc --noEmit` fails on a fresh clone.
- **Build scripts.** pnpm 10 blocks dependency install scripts by default. `esbuild` is allowed (tsx and vitest need its binary); `es5-ext`, `sharp`, `unrs-resolver` stay blocked.
- **Line endings.** `.gitattributes` forces LF in the repo, so Windows `core.autocrlf` doesn't churn diffs.

## 2026-10-29 — Design tokens and shell

- **Token names.** §9 calls the secondary text colour "muted", but shadcn already uses `muted` for a background surface (`bg-muted` on slider tracks, tab lists, hovers). Two meanings for one class is a trap, so Atlas tokens are `canvas, panel, panel-raised, rule, ink, ink-muted, amber, on-amber, focus, cat-1..7, co-1..5` (Tailwind: `bg-panel`, `text-ink-muted`, …). shadcn's semantic variables (`--background`, `--muted`, `--ring`, …) are aliased to these in `globals.css`, so shadcn components follow the theme.
- **Added tokens not in §9.** `panel-raised` (hover / selected surface, dark `#252930`, light `#ECEEF2`). Light `ink-muted` = `#5B616B` (6:1 on white). Light `focus` = `#A86B00`, because `#F2B134` is under 2:1 on light surfaces and the focus ring needs 3:1. Company greys `co-1..5` interpolate `#5B616B → #C9CDD4` in five steps.
- **Theme is `data-theme` on `<html>`**, default `dark`. An inline script in `<head>` applies the stored choice (`localStorage["atlas-theme"]`) before first paint. The `dark:` Tailwind variant is remapped to `data-theme`, so shadcn's `dark:` styles follow the toggle. The toggle's icon and label switch by CSS, so the server render never mismatches.
- **Western is the default region filter** (PROJECT_CONTEXT §2). In Phase 0 the filters are wired to Zustand but don't filter any view yet, and the bar says so.
- **Section layouts own title and sub-tabs.** `vc-math/layout.tsx` and `investors/layout.tsx` render the title and sub-tab links; the active tab comes from `usePathname` in a client component. Pages read `params` inside `<Suspense>`, which Next 16.4's instant-navigation validation requires with Cache Components. Trade-off: an unknown slug (`/vc-math/nope`) renders the not-found view with `noindex` but an HTTP 200, because the check runs after the shell has streamed. Acceptable for an internal tool; revisit if it matters.
- **Index routes redirect.** `/vc-math` → `/vc-math/round-builder`, `/investors` → `/investors/directory`.
- **Rail labels.** Sentence case per §9: "VC math", and "Strategy" for the raise strategy tab. Narrow screens always show the icon rail; labels stay in the accessibility tree.
- **Next dev indicator moved to bottom-right** so it doesn't cover the rail's theme and collapse buttons.

## 2026-10-29 — Data contracts

- **JSON Schema comes from Zod 4's built-in `z.toJSONSchema` (draft 2020-12), not `zod-to-json-schema`.** Version 3.25.2 accepts Zod 4 schemas but silently emits an empty schema (`{"$schema": …}` only), so Python validation would accept anything. The package was removed. Refinements (sector weights summing to 1, date precision, check min ≤ max) aren't expressible in JSON Schema; `pnpm validate:data` enforces them.
- **Strict objects.** Every record rejects unknown fields, so a pipeline typo fails validation instead of shipping.
- **Fields added beyond PROJECT_CONTEXT §3**, each because Phase 0 data needed somewhere honest to go:
  - every record: `confidence`.
  - Investor: `parent_brand`, `aliases`, `category` (PHASE_0 §4); `seed_list_count`, `seed_source_ids`, `seed_hints`, `flags` (PHASE_0 §7).
  - Fund: `close_date_precision` (Goldman dates are often month-only), `notes` (Goldman notes that aren't links, e.g. "Targeting $40M").
  - Round: `date_precision`, `stage_raw` (label as listed), `notes`, and `unspecified_investor_ids` for investors a source names without saying whether they led. The robotics list mixes leads and participants in one column; filing them as leads would draw false solid edges in the network.
  - Competitor: `layer_detail` (free text under the fixed layer), `headcount_est` as `{ value, source }` so the estimate always carries its source.
- **Partial dates.** Dates are `YYYY`, `YYYY-MM` or `YYYY-MM-DD` with a precision field, checked to agree. Seed rounds are `"2026"` / `year` (PHASE_0 §7.4).
- **Source URL** is an http(s) URL or `user_supplied:<source_id>` (PHASE_0 §6.5). Bare domains are rejected; the pipeline adds `https://` when a link is clearly a domain.
- **Competitors live in `competitors.json`**, companies in `companies.json`; ids are unique across both and rounds may point at either.
- **Review datasets.** `anomalies.json` (rows flagged, not fixed) and `merges.json` (every name merge) are processed datasets too, so the Command page can count them and reviewers can read them without running the pipeline.
- **Enums not given in §3** are provisional and can change here: `layer` uses the seven layers of the §2 layer map; `size_class` is `early | growth | incumbent`.
- **Loaders are async and use `"use cache"`.** Under Cache Components, uncached file reads would make every page dynamic. Async also matches the later move to an API. Restart `pnpm dev` after re-running the pipeline.

## 2026-10-29 — Pipeline setup

- **Python.** `requires-python = ">=3.11"`; uv resolved CPython 3.13.15. Locked in `pipeline/uv.lock`: pdfplumber 0.11, pandas 3.1, jsonschema 4.26, python-slugify 9.1, rapidfuzz 3.14; dev: pytest 9.2, ruff 0.17.
- **Id scheme** (`pipeline/atlas/ids.py`): `inv_<slug>`, `fund_<inv-slug>_<number or year>` with the Roman numeral lower-cased (`fund_root-ventures_iv`), `co_<slug>`, `rnd_<co-slug>_<yyyy-mm>_<stage>`, using `yyyy` when only the year is known (`rnd_atoms_2026_undisclosed`). Slugs come from python-slugify. Collisions get `-2`, `-3`, … in order of appearance.
- **`retrieved_at` for user-supplied files is fixed at 2026-10-29**, the day they were handed over (`USER_SOURCES_RECEIVED`), not the run date. Otherwise every re-run rewrites every record and buries real changes in the diff. Only `generated_at` changes per run.
- **Freshness cutoff** is `FRESHNESS_CUTOFF = "2024-10-29"` in `atlas/config.py` (24 months before 2026-10-29).
- **Export validates first.** `write_json.py` checks each dataset against `data/schemas/*.schema.json` (Draft 2020-12 with format checking) before writing, and refuses to write on failure. `pnpm validate:data` then re-checks with Zod plus cross-file integrity.

## 2026-10-29 — Goldman PDF ingest

- **Extraction.** pdfplumber table extraction finds all 971 indexed rows (1–971, none missing or duplicated) on all 11 pages, so the line-regex fallback never fires on this file; it stays in place, tested on a synthetic line, for future versions of the PDF. Two more fund rows sit above row 1 with no index (Hyperstition, BBG Ventures); they are kept as `unindexed-1/2` and flagged. 973 funds in total.
- **Long links overflow into a ninth cell** (14 rows). The overflow is always the tail of the URL, so it is joined without a space.
- **Flag, don't fix.** Anomalies go to `data/interim/goldman_anomalies.csv` and `data/processed/anomalies.json`. Where a value is unusable the field is null and the anomaly says so:
  - amount blank or not a number (`93/3`) → `size_usd` null.
  - amount over $1,000M (`$4,100` for Anthology Fund) → null as implausible for this list; amounts between $200M and $1,000M (AIX $202M, Blockchain Capital $250M, Benhamou $480M) are kept and flagged as above the list's ceiling.
  - date malformed, nonexistent, before 2000 or after 2026-10-29 (`9/10/2925`, `715/2025`, `6/27/0203`, `12/23/2106`, `78/2021`) → `close_date` = the year column with precision `year`.
  - valid date whose year disagrees with the year column (Prudence, Tenzing) → both kept as listed and flagged; `vintage_year` is the year column.
  - fund number `1` → read as `I`; `Opp Fund` → number null, text kept in `notes`.
  - notes that say the amount is a target, a first close, unconfirmed or a guess → fund `confidence: low`.
  - name tokens within edit distance of a generic word (`Ventrues`, `Ventues`, `Capial`, `Partnes`, `Venturesq`, …) → flagged as possible typos, kept as written, matched as the generic word.
- **Sizes** are stored in dollars (`$160` → 160,000,000) with `currency_original: USD`; the list's column is USD.
- **Source per fund**: the row's link when present, else `user_supplied:goldman_sub200m_funds`; `kind: user_supplied`; `title` records the row (`goldman_sub200m_funds row 42`) so every fund traces back to its line in the PDF.
- **Investor type is left null** for Goldman investors. The list is mostly VCs but includes corporate arms (Salesforce, SAP.iO, Grab), accelerators (Techstars) and fund-of-funds (Cendana); Phase 1 classifies.

## 2026-10-29 — Name matching (investors)

- **Display names keep generic words**; only the matching key drops them (PHASE_0 §6.4). The key also drops: `fund`, `the`, `and`, `llc`, `lp`, `inc`, `co`, `group`, `management`, `investment(s)`; trailing vehicle words (`seed`, `opportunity`, `opp`, `growth`, `scout`, `climate`, `creator`, `select`, `early`, `diversity`, `hardware`, `secondary`); and likely typos of generic words. So `Sequoia Seed Fund`, `Sequoia Capital Seed Fund` and `Sequoia Ventues - Scout Fund` share the key `sequoia`.
- **The firm is cut from the fund name** before matching: ` - climate fund`, `, Liquid Value Fund` and parentheticals are removed; `(fka Carmel Ventures)` becomes an alias.
- **Threshold**: rapidfuzz `token_sort_ratio` ≥ 92 on keys (`NAME_MATCH_THRESHOLD`). Exact key matches merge without a score.
- **Aliases** (`atlas/resolve.py`): `a16z` ↔ Andreessen Horowitz, `USV` ↔ Union Square Ventures. Short and reviewable on purpose.
- **Display name**: a seed-list name wins (seed lists name firms; Goldman names funds). Otherwise the most recent Goldman name without typos or vehicle words.
- **Every merge is logged** in `data/processed/merges.json`. All 54 merges from the first run were reviewed by hand. Five were wrong and are now blocked by `DO_NOT_MERGE` in `atlas/config.py`, which applies to exact and fuzzy matches alike: Collide Capital ≠ Collider Ventures (NYC vs Israel), Corigin Ventures ≠ Origin Ventures (NYC vs Chicago), House Capital ≠ The House Fund (Launch House vs Berkeley), Amplify Ventures ≠ Amplify Partners (LA vs Bay Area), ATX Seed Ventures ≠ ATX Venture Partners. 49 merges remain.
- **Accel split rule.** Regional arms of one brand are separate investors with a shared `parent_brand` (Accel US / Accel Europe & Israel / Accel India → `parent_brand: "Accel"`). In the pipeline, a name whose key ends in a region word (US, Europe, India, Israel, Korea, Africa, Japan, …) keeps its own key and gets `parent_brand` = the name before the region word: `Antler US Fund` → Antler, `Altos Ventures Korea Fund` → Altos Ventures, `500 Startups Japan` → 500 Startups. "SEA" is deliberately not a region word (it turned "Red Sea Ventures" into parent "Red").
- **Vehicle words count only at the end of the written name** (optionally followed by "Fund"), and never shrink a key below 3 characters; a name whose key would fall below 3 characters keeps all its words. So "Spark Growth Ventures" stays `spark growth` (not Spark Capital), "AI Seed" stays `ai seed` (not AI Fund), "Capital F" stays `capital f`.
- **More do-not-merge pairs found reviewing the seed merges**: IDG Capital ≠ IDG Ventures (China vs Bay Area), Bain Capital ≠ Bain Capital Ventures (parent vs venture arm), Atomic ≠ Atomico (SF studio vs London VC), Cleo Capital ≠ Cleo Ventures (Bay Area USD fund vs EUR fund). 64 merges remain after the seed lists, all reviewed.
- **Region from location** (`atlas/geo.py`) only when every place in the location string is in the table and all agree. Mixed (`Bay Area, China`), unlisted or vague (`Global`) locations → null for Phase 1. Known misspellings in the list (`Chicaog`, `Vancover`, `Israe`, …) are in the table explicitly.

## 2026-10-29 — Seed lists

- **Hints, not facts.** Listed focus and check / fund sizes go into `seed_hints` with their `source_id`; `check_min_usd`, `check_max_usd`, `stages` and `sector_weights` stay null for Phase 1 to verify.
- **`seed_list_count`** counts distinct lists in `seed_investors.csv` naming the investor (fund list and round lists don't count). Only four investors appear on two lists: Andreessen Horowitz and NVIDIA (frontier labs + US robotics map), Crane Venture Partners (Q3 closes + B2B AI funds), Restive Ventures (B2B AI funds + One Way Summit).
- **Frontier-lab list.** Each name gets a type guess from `FRONTIER_TYPE_GUESSES` in `atlas/ingest/seeds.py`: strategic for operating companies (NVIDIA, Microsoft, Tencent, …), cvc for corporate venture arms (GV, Cisco Investments, AMD Ventures, Salesforce Ventures), asset_manager (BlackRock, Fidelity, T. Rowe Price, Blackstone, TPG, Coatue, Boyu, Valor Equity Partners), sovereign (MGX, QIA), individual (Liang Wenfeng), vc for the rest. These are guesses, so the records stay `confidence: low`. The user's list notes every row as "late-stage/strategic; not an early-stage target by default", so every frontier-list investor gets `not_early_stage_target_by_default`, **unless the Goldman list shows it running a fund of $200M or less** (Sequoia's seed funds, Conviction). That means a16z, Lightspeed, Founders Fund and General Catalyst are flagged by default; Phase 1 can lift the flag with evidence.
- **Region from the list's own scope**: `li_20_b2b_ai_funds_2026` is a list of US/UK/EU funds, so its names are western. A note that starts with a place ("India; 28 pre-seed deals/yr" for ajvc) gives the region. A regional arm's own name does too: Accel (US) → western, Accel (India) → india.
- **Accel** appears four ways: `Accel` (frontier list), `Accel (US)`, `Accel (Europe & Israel)`, `Accel (India)` (Q3 closes). The three arms are separate investors with `parent_brand: "Accel"`. Bare `Accel` stays a brand-level record because the list doesn't say which arm; Phase 1 resolves it.
- **Rounds.** The AI mega-seed list names leads, then strategic co-investors: they become `lead_investor_ids` and `participant_investor_ids`. The robotics list names investors without roles: `unspecified_investor_ids`. "Cathay Innovation (+4 co-leads)" keeps Cathay as lead and notes the four unnamed co-leads; "undisclosed" leaves no investor and says so in `notes`. Stage is `seed` for "2026 seed (mega-seed)" and `undisclosed` for "type not listed".
- **The same round listed twice** (same company, year and amount; only Walden Robotics, $300M) becomes one round with both sources; the named stage beats `undisclosed`, and an investor named as lead anywhere is a lead.
- **Company sector** is `robotics_physical_ai` for companies from the robotics list (the list's own scope) and null for mega-seed companies. `total_raised_usd` stays null; one listed round isn't a total.
- **Competitors stay companies in Phase 0.** Atoms and Machina Labs are in PROJECT_CONTEXT §7 but nothing there is verified; Phase 1 moves verified competitors into `competitors.json`.
- **Investor stubs from rounds** (Tether, Amazon, Toyota, "UK government", …) get the round list as source, `confidence: low` and no type.
