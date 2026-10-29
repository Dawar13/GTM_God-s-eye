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
- Next.js here is 16.4 with Cache Components; read AGENTS.md and the bundled docs it points to before writing Next code.
