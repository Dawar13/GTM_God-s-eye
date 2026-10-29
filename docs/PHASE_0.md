# Phase 0 — Foundation

Read `docs/PROJECT_CONTEXT.md` first. This phase builds the skeleton, the data contracts and the ingestion of what we already have. **No web research and no real charts in this phase.**

Work in order. After each numbered step: run the checks listed, commit with a conventional message (`chore:`, `feat:`), then continue. If a step fails twice, stop and report instead of improvising around it.

---

## 0. Preconditions (human does this before starting Claude Code)

- Empty folder opened in VS Code, Git installed, Node ≥ 20, pnpm, Python ≥ 3.11, `uv` installed.
- Copy these into the repo (create folders as needed):
  - `docs/PROJECT_CONTEXT.md`, `docs/PHASE_0.md`
  - `data/seed/seed_investors.csv`, `data/seed/seed_rounds.csv`
  - `data/raw/sources/` ← all original files: the Shai Goldman PDF (rename to `goldman_sub200m_funds.pdf`), every infographic image, and a `linkedin_posts.md` with the pasted post texts
  - `data/raw/customers/` ← `Industrial_AI_Target_List.xlsx`, `Industrial_AI_Target_List_Bangalore.xlsx`

Claude Code: verify these exist. If any is missing, list what's missing and continue with the rest.

---

## 1. Repo structure

Create exactly this (empty folders get a `.gitkeep`):

```
capital-atlas/
├─ CLAUDE.md
├─ README.md
├─ docs/
│  ├─ PROJECT_CONTEXT.md
│  ├─ PHASE_0.md
│  ├─ DECISIONS.md          # dated log of every non-obvious choice
│  └─ DATA_DICTIONARY.md    # generated from Zod schemas in step 4
├─ data/
│  ├─ raw/
│  │  ├─ sources/           # user-supplied originals (read-only)
│  │  ├─ incoming/          # future investor spreadsheets
│  │  └─ customers/         # customer target lists (not investor data)
│  ├─ seed/                 # transcribed seeds (csv)
│  ├─ interim/              # pipeline intermediates (gitignored)
│  ├─ processed/            # app-facing JSON (committed)
│  ├─ schemas/              # JSON Schema generated from Zod
│  └─ RESEARCH_LOG.md
├─ pipeline/                # Python, managed by uv
│  ├─ pyproject.toml
│  ├─ atlas/
│  │  ├─ __init__.py
│  │  ├─ config.py          # paths, freshness cutoff, taxonomy
│  │  ├─ ids.py             # slug + id helpers
│  │  ├─ ingest/
│  │  │  ├─ goldman_pdf.py
│  │  │  └─ seeds.py
│  │  ├─ enrich/            # Phase 1
│  │  ├─ analyze/           # Phase 1 (categorise, cluster, graph, fit)
│  │  └─ export/
│  │     └─ write_json.py
│  └─ tests/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                       # Command
│  │  ├─ vc-math/[tool]/page.tsx
│  │  ├─ investors/[view]/page.tsx      # directory | thesis-map | capital | network
│  │  ├─ competitors/page.tsx
│  │  └─ strategy/page.tsx
│  ├─ components/
│  │  ├─ shell/             # LeftRail, FilterBar, Inspector, PageCanvas
│  │  ├─ ui/                # shadcn primitives
│  │  ├─ charts/            # Phase 2
│  │  ├─ graph/             # Phase 2
│  │  └─ calculators/       # Phase 2
│  ├─ lib/
│  │  ├─ schema/            # Zod schemas (single source of truth)
│  │  ├─ data/              # loaders: the ONLY place that reads data/processed
│  │  ├─ finance/           # pure math, Phase 1
│  │  └─ format/            # money, %, dates, INR crore
│  ├─ store/                # Zustand: filters, selection, theme
│  └─ styles/tokens.css
├─ scripts/
│  ├─ validate-data.ts
│  └─ gen-json-schema.ts
└─ tests/                   # Vitest
```

## 2. App tooling

1. `pnpm create next-app@latest .` → TypeScript, App Router, Tailwind, ESLint, `src/` dir, import alias `@/*`. No Turbopack-only features you'd need to undo later.
2. Add: `zod zustand @tanstack/react-table framer-motion clsx tailwind-merge lucide-react`
3. Add later-phase viz deps now so versions are pinned once: `recharts d3 react-plotly.js plotly.js-dist-min graphology graphology-layout-forceatlas2 sigma @react-sigma/core`
4. Dev: `vitest @vitest/coverage-v8 tsx zod-to-json-schema prettier prettier-plugin-tailwindcss @types/d3`
5. Init shadcn/ui; add only: button, tabs, tooltip, sheet, slider, input, select, badge, separator, scroll-area, toggle-group.
6. `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`.
7. Scripts in `package.json`:
   ```
   dev, build, start, lint, typecheck (tsc --noEmit), test (vitest run),
   format, validate:data (tsx scripts/validate-data.ts),
   gen:schema (tsx scripts/gen-json-schema.ts),
   pipeline (cd pipeline && uv run python -m atlas.run)
   ```
8. Record exact installed versions in `DECISIONS.md`.

Check: `pnpm dev` renders; `pnpm lint && pnpm typecheck` pass.

## 3. Design tokens and shell

1. `src/styles/tokens.css`: CSS variables from PROJECT_CONTEXT §9 for dark (default) and light (`[data-theme="light"]`). Include the Okabe–Ito palette as `--cat-1..7` and company greys `--co-1..5`.
2. Fonts via `next/font/google`: IBM Plex Sans (400, 500, 600) and IBM Plex Sans Condensed (400, 500). Global `tabular-nums` utility for numbers.
3. Map tokens into Tailwind theme so classes like `bg-panel text-ink border-rule` work.
4. Shell components:
   - `LeftRail`: Command, VC Math, Investors, Competitors, Strategy. Icons + labels; collapsible to icons.
   - `FilterBar`: placeholders for region, stage, type, freshness, sector (wired to Zustand, no data yet).
   - `Inspector`: right-side resizable drawer, closed by default, opens from Zustand `selection`.
   - `PageCanvas`: main area with title and sub-tab navigation (Tabs routed by URL, not local state).
5. Each page shows a purposeful empty state: one sentence on what will appear here and which phase fills it. No lorem ipsum, no fake numbers.
6. Theme toggle (dark/light) persisted to `localStorage`.
7. Respect `prefers-reduced-motion`; visible focus ring in amber.

Check: navigate every route incl. `/vc-math/safe` and `/investors/network`; keyboard-only navigation works.

## 4. Data contracts (Zod)

In `src/lib/schema/`, define schemas exactly as PROJECT_CONTEXT §3, plus:
- `Investor.parent_brand: string | null` (e.g. Accel US / Accel Europe & Israel / Accel India are separate investors with `parent_brand: "Accel"`).
- `Investor.aliases: string[]` (e.g. "a16z" ↔ "Andreessen Horowitz").
- `Investor.category` (computed fields, written by the pipeline, nullable in Phase 0): `freshness`, `maturity`, `is_early_stage`, `is_generalist`, `cluster_id`, `industrial_affinity`, `stage_earliness`, `fit` (object with total + components + flags).
- `Source` as specified; `sources` must be non-empty for every record. `confidence: "high" | "medium" | "low"`.
- Enums for sector taxonomy, stages, investor types, regions — exported constants so the UI and pipeline share them.
- `Dataset` wrapper for each processed file: `{ version, generated_at, records: [...] }`.

Then:
- `scripts/gen-json-schema.ts` writes `data/schemas/*.schema.json`. The Python pipeline validates its output against these (use `jsonschema`), so TS stays the single source of truth.
- `scripts/validate-data.ts` loads every `data/processed/*.json`, parses with Zod, and checks referential integrity (every investor_id / company_id in rounds and funds exists; no duplicate ids; every source has url + retrieved_at). Exit non-zero on any failure with a readable report.
- Generate `docs/DATA_DICTIONARY.md` from the schemas (field, type, required, description).
- `src/lib/data/`: typed loaders `getInvestors()`, `getFunds()`, `getRounds()`, `getCompanies()`, `getCompetitors()`. Components never import JSON directly.

Check: `pnpm gen:schema && pnpm validate:data` passes on empty datasets.

## 5. Python pipeline setup

1. `cd pipeline && uv init`; deps: `pdfplumber pandas jsonschema python-slugify rapidfuzz` (Phase 1 will add `scikit-learn umap-learn networkx httpx`). Dev: `pytest ruff`.
2. `atlas/config.py`: paths, `FRESHNESS_CUTOFF = "2024-10-29"`, taxonomy list (must match the TS enum; add a test that compares them via the generated JSON Schema).
3. `atlas/ids.py`: stable ids = `inv_<slug>`, `fund_<inv-slug>_<number or year>`, `co_<slug>`, `rnd_<co-slug>_<yyyy-mm>_<stage>`.
4. `atlas/run.py`: runs ingest → export; prints a summary table (counts, anomalies).

## 6. Ingest the Goldman PDF (`ingest/goldman_pdf.py`)

The PDF lists ~971 funds ≤ $200M: index, fund name, amount ($M), date announced, year, fund number, location, notes/link. Text extraction is messy (rows run together, missing fields).

1. Extract with pdfplumber (try table extraction first; fall back to line parsing with regex anchored on the leading row index).
2. Output `data/interim/goldman_funds.csv` with: row_index, fund_name_raw, amount_musd, date_raw, date_iso, year, fund_number, location, link.
3. **Flag, don't fix**, anomalies into `data/interim/goldman_anomalies.csv` with a reason. Known examples to expect: impossible dates (`9/10/2925`, `715/2025`, `6/27/0203`), amount like `93/3`, implausible sizes (`$4,100` for a fund in a ≤$200M list), rows without amounts, year column disagreeing with date. Use the year column when the date is broken and log it.
4. Group rows into investors: normalise names (strip "Ventures/Capital/Partners" only for matching, never for display; fuzzy match with rapidfuzz ≥ 92 and log every merge for review). Repeated firms (e.g. Haystack, Refactor, Work-Bench) become one Investor with many Funds.
5. Every record gets source `{ url: <link if present else "user_supplied:goldman_sub200m_funds">, kind: "user_supplied", retrieved_at: <today> }` and `confidence: "medium"`.
6. Region from location string where unambiguous (e.g. "Israel" → western, "India" → india, "China" → other); otherwise `null` for Phase 1 to fill.
7. Tests (`pipeline/tests/test_goldman.py`): row count within ±2% of 971, at least these parse correctly: Antler US Fund $160M 2026 Fund II NYC; Dorm Room Fund $50M 2026; Seven Stars $40M 2025 Fund I Bay Area; Root Ventures $190M 2025 Fund IV.

## 7. Normalise the seeds (`ingest/seeds.py`)

1. `seed_investors.csv` (≈196 rows from 9 user lists): dedupe by normalised name across lists; keep every `source_id` the name appeared in (appearing in several lists is itself a signal — store `seed_list_count`). Merge with Goldman investors when matched.
2. Don't trust listed focus/check sizes as facts: store them as `seed_hints` on the investor (`{source_id, listed_focus, listed_check_or_fund}`), used by Phase 1 research to verify.
3. Late-stage / strategic names from the frontier-labs list (NVIDIA, BlackRock, Fidelity, Tencent…) get `type` guess + flag `not_early_stage_target_by_default`; they matter for the network view, not the target list.
4. `seed_rounds.csv` (50 rounds from the robotics and AI mega-seed lists): create Company + Round records with lead/participant investor links (create investor stubs if new). Amounts and dates are `confidence: "low"` until verified in Phase 1; date = `2026` with `date_precision: "year"`.
5. Write `data/processed/{investors,funds,companies,rounds}.json` in the `Dataset` wrapper, validate with JSON Schema in Python, then `pnpm validate:data`.

## 8. Wire minimal real data into the shell (no styling work)

- Command page: plain list of counts from loaders (investors, funds, rounds, companies, anomalies count). This proves the data path end to end.
- Investors → Directory: an unstyled TanStack table with name, region, latest fund size, latest fund year, seed_list_count. Clicking a row opens the Inspector with raw JSON. That's all.

## 9. Docs and hygiene

- `CLAUDE.md` (Claude Code reads this automatically every session):
  ```
  # Capital Atlas
  Read docs/PROJECT_CONTEXT.md before any work. Current phase: see docs/DECISIONS.md (latest entry).
  Rules:
  - Never invent data. Unknown = null. Every fact needs a source URL + retrieved_at.
  - Components read data only through src/lib/data/.
  - Zod schemas in src/lib/schema are the single source of truth; regenerate JSON Schema after edits.
  - Finance math lives in src/lib/finance as pure, tested functions.
  - Run lint, typecheck, test, validate:data before every commit.
  - Log non-obvious choices in docs/DECISIONS.md with date and reason.
  - Design: follow PROJECT_CONTEXT §9; no all-caps labels, no generic card grids, tabular numbers.
  ```
- `.gitignore`: node_modules, .next, data/interim, pipeline/.venv, .env*.
- `README.md`: how to run app, pipeline, validation; phase status.
- `DECISIONS.md`: first entries — stack versions, id scheme, name-matching threshold, Accel split rule, freshness cutoff.
- `data/RESEARCH_LOG.md`: header + table format (date, entity, question, sources checked, result, conflicts).

## 10. Exit checklist

- [ ] `pnpm dev` → all 5 tabs and all sub-routes render purposeful empty states; theme toggle works
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm validate:data` all pass
- [ ] `cd pipeline && uv run pytest` passes
- [ ] `data/processed/` has investors, funds, companies, rounds; anomalies CSV reviewed
- [ ] Directory table shows real rows; inspector opens
- [ ] DECISIONS.md, DATA_DICTIONARY.md, README.md written

## 11. Hand-off

Finish by writing `docs/PHASE_0_REPORT.md`: what was built, counts (investors, funds, merges, anomalies), problems found in the source data, open questions for the human. Then draft `docs/PHASE_1.md` using PROJECT_CONTEXT §10 (research tiers, research protocol, pipeline analytics, finance engine with worked-example tests). Stop and wait for review before starting Phase 1.
