# Capital Atlas

Internal fundraising console for Utopian Autonomy: who has money, what they back, who they co-invest with, the VC math, our competitors, and which investors to raise from. Start with [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md).

## Phase status

| Phase | Status |
|---|---|
| 0 — Foundation | Done, awaiting review. See [docs/PHASE_0_REPORT.md](docs/PHASE_0_REPORT.md) |
| 1 — Research, data and engines | Planned in [docs/PHASE_1.md](docs/PHASE_1.md); not started |
| 2 — Interface and polish | Not started |

## Requirements

Node 20 or later (built on 24), pnpm 10, Python 3.11 or later, and [uv](https://docs.astral.sh/uv/).

```sh
pnpm install
cd pipeline && uv sync
```

## Run the app

```sh
pnpm dev          # http://localhost:3000
pnpm build        # production build; every route is prerendered
```

The app reads `data/processed/*.json` through the loaders in `src/lib/data/`. Loaders are cached, so restart `pnpm dev` after re-running the pipeline.

## Run the pipeline

```sh
pnpm pipeline                         # ingest -> resolve -> build -> export, prints a summary
cd pipeline && uv run pytest          # pipeline tests
cd pipeline && uv run ruff check .    # lint
```

It reads `data/raw/sources/` and `data/seed/`, writes intermediates to `data/interim/` (not committed: `goldman_funds.csv`, `goldman_anomalies.csv`), and writes `data/processed/*.json`. Each processed file is checked against `data/schemas/*.schema.json` before it is written.

## Validate

```sh
pnpm gen:schema      # Zod -> data/schemas/*.schema.json and docs/DATA_DICTIONARY.md
pnpm validate:data   # Zod parse of every processed file + cross-file integrity
pnpm lint && pnpm typecheck && pnpm test
```

Before every commit, run lint, typecheck, test and validate:data. If you change a schema in `src/lib/schema/`, run `pnpm gen:schema`, then `pnpm pipeline`, then `pnpm validate:data`.

## How data flows

```
data/raw/sources/  data/seed/         user-supplied originals and transcriptions (read-only)
        │
        ▼
pipeline/atlas/    ingest → resolve names → build records → export
        │                      └─ every merge logged: data/processed/merges.json
        ▼
data/processed/    investors, funds, companies, competitors, rounds, anomalies, merges
        │          validated by JSON Schema (Python) and Zod (pnpm validate:data)
        ▼
src/lib/data/      async loaders, the only code that reads processed data
        ▼
src/app/           pages
```

Every record carries `sources` (URL or `user_supplied:<list>`, `retrieved_at`, kind) and a `confidence`. Unknown values are `null` and show as "—". See [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) for every field.

## Where things live

| Path | What |
|---|---|
| `docs/PROJECT_CONTEXT.md` | Source of truth for scope, data model, analytics, design |
| `docs/DECISIONS.md` | Dated log of non-obvious choices; latest entry states the current phase |
| `data/RESEARCH_LOG.md` | One row per research action (Phase 1 onwards) |
| `src/lib/schema/` | Zod schemas and shared enums, the single source of truth for data shape |
| `src/lib/format/` | `$1.2M`, `₹1.5 Cr`, `9.1%`, "—" |
| `src/components/shell/` | Left rail, filter bar, inspector, page canvas |
| `src/styles/tokens.css` | Colour tokens, dark default and light |
| `pipeline/atlas/` | Python pipeline (`config.py` holds cutoffs, thresholds, do-not-merge pairs) |
