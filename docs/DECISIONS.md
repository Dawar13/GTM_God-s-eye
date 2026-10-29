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
