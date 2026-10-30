# Phase 2 — Interface, polish and deploy

Read `docs/PROJECT_CONTEXT.md` (§2, §4, §5, §9 and §10 above all), `docs/PHASE_1_REPORT.md`, the latest `docs/DECISIONS.md` entries, `CLAUDE.md` and `AGENTS.md` first. Start only after the human has reviewed Phase 1 and merged `phase-1`; work on a new `phase-2` branch. If Phase 1 changed something this file assumes (schema shape, counts, file sizes), follow the Phase 1 reality and log the deviation in DECISIONS.md.

Goal: build every tab, view, calculator, chart and graph on the real data, with the inspector and provenance everywhere, the gamified layer, responsive layouts, measured performance and accessibility, and a protected Vercel deploy. **No new research.** Phase 2 changes the pipeline only when a view cannot be built otherwise; then Zod first, `pnpm gen:schema`, `pnpm pipeline`, and a DECISIONS entry.

Next.js is 16.4 with Cache Components and Partial Prefetching. Before writing Next code, read these bundled guides in `node_modules/next/dist/docs/01-app/`: `01-getting-started/15-route-handlers.md`, `03-api-reference/04-functions/generate-static-params.md` (§ With Route Handlers), `03-api-reference/04-functions/use-search-params.md` (§ Prerendering), `02-guides/lazy-loading.md`, `03-api-reference/04-functions/cacheLife.md`, `03-api-reference/05-config/01-next-config-js/output.md` (`outputFileTracingIncludes`), `03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md`, `02-guides/instant-navigation.md`, `02-guides/testing/playwright.md`, `02-guides/package-bundling.md`. Two facts from them shape this plan: `dynamicParams`, `dynamic` and `revalidate` segment configs don't exist under Cache Components, and `next/dynamic` with `ssr: false` only works inside Client Components.

---

## 0. What the data looks like

Measured on 2026-10-30 from the working tree's `data/processed/` (pipeline run `2026-10-30T13:07Z`, after commit `1520003`), while Phase 1 research was still running. Counts grew about 10% between two reads that day, so §1.1 re-measures them before anything else. Sizes are raw / gzip.

| What | Now | What it forces |
|---|---|---|
| Investors | 2,693: research tier A 80, B 199, C 2,414. 117 researched (A 60, B 57); 775 known only from fund or seed lists; 1,801 named only as a co-investor in someone's round | Most rows are thin. Every view needs a visible unknown state and counts of what it leaves out |
| `investors.json` | 5,166 KB / 472 KB. Median record 1.2 KB, largest 9.9 KB | Never send full records to a page. Phase 0 inlined 929 records (~1.4 MB HTML); today that would be ~5 MB |
| Directory rows (slim projection, all investors) | ~341 KB / 36 KB | Send slim rows only, page them at 100, and fetch full profiles when the inspector opens |
| Region | western 700, India 17, other 31, **unknown 1,945 (72%)**, of which 1,796 are co-investor-only names | The Western default hides 1,945 rows. Say so, with a one-click way to show them |
| Type / freshness / maturity / stages / check size | type unknown 2,539 (94%); freshness fresh 109, older 630, unknown 1,954; maturity known 734; stages known 105; check size known 67 | Filters on these fields hide unknowns. Show hidden counts per filter |
| Fit features (`fit_features.json`, 1,656 KB / 51 KB) | 2,603 records; **2,452 flagged `sparse` (94%)**; 151 not sparse (A 59, B 61, C 31); 51 `conflict`. Known per feature: thesis 359, stage 105, check 67, adjacency 2,104, geography 748, dry powder 739. Only 55 investors have all six | With the renormalised score (DECISIONS 2026-10-30), **all of the top 25 across all records are sparse, at 10–45% coverage, and three score 100.0 on 10% coverage.** Rankings exclude sparse records by default and always show coverage and bounds (§2.4) |
| Thesis map (`layout_thesis.json`) | 359 points (A 63, B 79, C 217), 8 clusters (13–105 members), 10 generalists. Fit view needs both industrial affinity and stage earliness: 102 investors | The map covers 13% of investors. The canvas names who is missing and why |
| Capital bubbles (`layout_bubbles.json`) | 951 records; **all three axes known for 64**, and 55 of those also have a fund size. Missing check size 884, stage 846, affinity 592 | A 3D chart of 64 points. Plotly costs 4,721 KB / 1,456 KB (`plotly.min.js`), so it loads only on this route |
| Graph (`graph.json`, 1,815 KB / 154 KB) | 2,847 nodes (2,104 investors, 743 companies, 42 of them competitors), 4,075 edges (lead 952, participant 2,662, role not stated 461), 616 co-investment edges among 304 investors (weight 2–9, median 2). One component holds 2,774 nodes. Investor degree: median 1, 1,567 nodes at degree 1, 76 at 8 or more. Positions precomputed (ForceAtlas2, 400 iterations, seed 42); no null x/y | WebGL (Sigma 4.0.4: 63 KB gzip) with stored positions, no layout in the browser. A compact projection is ~393 KB / 105 KB, served as one static JSON. Show labels only above a size threshold. Test fps on a 2× synthetic graph too, since Phase 1 is still adding nodes |
| Rounds | 887. Amount unknown 132 (15%), post-money unknown 832 (94%), stage undisclosed 126, no named lead 179, contested 9. Date precision: day 749, month 108, year 18, quarter 2, none 10. 660 rounds dated 2025–26 | No valuation charts. Unknown amounts are drawn hollow. Dates render at their precision, never padded to a day |
| Companies | 703. **Total raised unknown for all 703**; founded year unknown 488; layer set 99 | PROJECT_CONTEXT §9's "shade companies by total raised" is impossible. Use the sum of the company's sourced rounds in our data, labelled as a lower bound (§7) |
| Competitors | 44: direct 15, adjacent 24, remote 5. Layers: plant ops 26, design intent 5, process planning 4, quality vision 3, autonomy tooling 2, robotics 2, full-stack factory 2. Founded year and total raised both known for 30; sourced headcount 19; reported revenue 2; 126 rounds across 42. Overlap: 331 investors, 36 back two or more | The scatter plots 30 and lists the other 14. The overlap matrix shows the 36 multi-backers by default |
| Funds | 1,157. 126 closed on or after the 2024-10-29 cutoff (125 with a size): $41.0B in total, median $85M. The largest single record is a16z's combined 2025–26 funds at $15.0B (37%) | "Total dry powder" cannot be observed. Label the number "raised by funds closed since 2024-10-29", show the median and the largest share |
| Provenance | Field-level sources: investor check and portfolio numbers 162/162; round amounts 755/755; round dates 51 of 877; fund sizes 200 of 1,087 (the rest cite their fund-list row, `user_supplied`). Investor confidence: low 1,934, medium 650, high 109 | Source icons resolve field sources first and fall back to the record's sources, saying "record source" (§2.2) |
| Benchmarks / legal notes | 31 benchmarks. US pre-seed: round size $200K (PitchBook), pre-money $10.7M, three SAFE cap medians by round-size band (one marked conflicting in its notes), SAFE share 93%. US seed: round size $3.0M (PitchBook, all sectors) vs $4.1M (Carta, software only), pre-money, post-money, dilution. **India: deal counts and capital only, with no pre-seed or seed medians.** 24 legal notes over 8 topics | The benchmark view shows notes and segments; it never picks one median automatically. The India comparison is shown as unknown |

Other constraints found while measuring:
- **8 clusters, 7 Okabe–Ito colours**, and k can reach 10. Add marker shape as a second channel (§6).
- **Contrast, from computed WCAG ratios:** on the light canvas `#F5F6F8`, `#E69F00` 2.08, `#56B4E9` 2.13, `#F0E442` 1.22, `#CC79A7` 2.83 and amber `#F2B134` 1.75 all fall below the 3:1 needed for graphical objects. On the dark canvas, company grey `co-1 #5B616B` is 2.85. The light-theme focus colour `#A86B00` (4.07) passes. Fixes are in §14.
- **react-plotly.js 4.1.0 peers on `plotly.js`, which isn't installed.** Use `react-plotly.js/factory` with `plotly.js-dist-min`.
- **Sigma 4 is not Sigma 2/3.** `sigma/rendering` has SDF node shapes (circle, square, triangle, diamond), a fill layer, node backdrops and dashed edge layers, but no node border layer. Read `node_modules/sigma/dist/declarations/src/rendering/**`, `sigma/README.md` and `node_modules/@react-sigma/core/README.md` before drawing outlines.
- **No component, e2e or accessibility test tooling exists yet.** Vitest runs in `environment: "node"` on `*.test.ts` only, and there is no Playwright, Testing Library, jsdom or axe.

---

Workstreams, in this order:

| # | Workstream | Can run in parallel with |
|---|---|---|
| 1 | Groundwork: data profile, budgets, loaders, route handlers, URL state, filters, test tooling | — |
| 2 | Shared primitives: provenance, unknowns, coverage, chart frame, theme colours | 5 |
| 3 | Inspector and profiles | 5 |
| 4 | Directory (Lighthouse gate) | 5 |
| 5 | VC math calculators | 2–4, 6–9 |
| 6 | Thesis map and capital bubbles | 7, 8 (after 2–3) |
| 7 | Network (60 fps gate) | 6, 8 |
| 8 | Competitors | 6, 7 |
| 9 | Raise strategy | 6–8 (after 4) |
| 10 | Command | after 4 and 9 |
| 11 | Gamified layer | after 5; alongside 6–10 |
| 12 | Responsive | per view as it is built; final pass after 11 |
| 13 | Performance | gate checks after 4 and 7; final pass last |
| 14 | Accessibility | per view; final pass last |
| 15 | Deploy (needs the human) | after 13–14 |
| 16 | Tests, exit checklist, report and hand-off (§16–18) | tests alongside every workstream; report last |

Commit after each workstream, or each view inside a large one, with `pnpm lint && pnpm typecheck && pnpm test && pnpm validate:data` green (CLAUDE.md), and run `pnpm test:e2e` before closing a workstream. Never commit files under `data/research/` from Phase 2.

**Every view is done only when it:** reads data only through `src/lib/data/`; shows unknowns as "—" (with the accessible name "unknown") and states how many records it left out and why; puts a source or "how computed" icon on every number in the inspector; respects the global filters, or says it ignores them; opens the inspector on click and on Enter; has a keyboard path and a text alternative for every chart; works in both themes; has the responsive behaviour in §12 and a Playwright smoke test with no console errors; and follows §9 and CLAUDE.md (sentence case, no all-caps labels, no generic card grids, tabular numbers via the `num` utility, units on every number, `$1.2M` / `₹1.5 Cr` / `9.1%` from `src/lib/format`).

---

## 1. Groundwork

### 1.1 Data profile and budgets
- `scripts/data-profile.ts` (`pnpm data:profile`): prints every number in §0 from the loaders. Run it first; if a count moved more than 25%, update §0 in your report and recheck the budgets in §13.
- `tests/budgets.test.ts`: builds the Directory rows, the graph view and the largest investor profile through the same functions the app uses, and fails if they exceed §13's byte budgets. Size regressions then fail `pnpm test`, not Lighthouse.

### 1.2 Loaders and view models (`src/lib/data/`)
- Give every loader in `index.ts` `cacheLife("max")`. Data changes only through a pipeline run and a redeploy. Add `outputFileTracingIncludes: { "/*": ["./data/processed/**/*.json"] }` to `next.config.ts` so a revalidation on Vercel can still read the files. Log both choices.
- Keep `node:fs` in `index.ts` only. Put view models in pure, isomorphic modules, each with Vitest tests, and expose each through a cached loader:

| Module | Builds | Used by |
|---|---|---|
| `directory.ts` (extend) | `DirectoryRow`: id, name, aliases, research tier, region, type, stages, check min/max, latest fund size and year, freshness, maturity, rounds in dataset, fit features (values only), flags, confidence | Directory, Strategy |
| `profile.ts` | `InvestorProfile` (record, funds, partners, rounds with company names and roles, co-investors counted from rounds, competitor exposure, fit features), `CompanyProfile` (record or competitor, rounds with investors by role) | Profile route handlers |
| `graph-view.ts` | Compact arrays: nodes `[id, kind, label, x, y, degree, betweenness, isCompetitor]`, edges `[source, target, role, roundId]`, co-investment `[source, target, weight]`, plus joins the client needs: investor tier, region and cluster; company known-rounds total | Network |
| `thesis-view.ts`, `bubbles-view.ts` | Points joined with name, tier, cluster name, fit; plus a count of unplaced investors and the reason | Thesis map, Bubbles |
| `competitor-view.ts` | Table rows, scatter points, timeline rounds, the overlap matrix (with role and date per cell), layer map | Competitors |
| `strategy-view.ts` | Fit inputs per investor (see §9), competitor backers split into conflict and signal, benchmarks, legal notes by topic | Strategy |
| `command-view.ts` | §10's numbers, all computed | Command |
| `filters.ts` | `applyFilters(rows, filters) → { rows, hidden: Record<FilterKey, number> }` (§1.4) | Every investor view |
| `client.ts` | The only client-side fetchers: `fetchInvestorProfile(id)`, `fetchCompanyProfile(id)`, `fetchGraphView()`, each memoised in a module-level `Map` | Inspector, Network |

### 1.3 Static JSON route handlers
Under Cache Components a GET handler is prerendered when it reads no runtime data, and `use cache` has to live in a helper, not the handler body (route-handlers guide).
- `src/app/api/profiles/investors/[id]/route.ts` and `src/app/api/profiles/companies/[id]/route.ts`: `generateStaticParams` over every id (~2,700 and ~750 files). The GET handler awaits a cached `getInvestorProfile(id)` / `getCompanyProfile(id)` and returns `Response.json(...)`. An unknown id returns 404. Rounds are served inside the company profile.
- `src/app/api/graph/route.ts`: one static compact graph view.
- Confirm in the `next build` output that these handlers are prerendered.

### 1.4 Filters and URL state
- Extend `src/store/filters.ts` with `maturity` and `includeUnknown` (default `false`). Defaults stay Western-first (PROJECT_CONTEXT §2).
- Matching rules, in `filters.ts`: region and type by equality; stage when `stages` includes it; freshness by value, where `unknown` counts as unknown; maturity by value; sector when the sector is among the investor's top three `sector_weights` with weight > 0. A null or empty field is "unknown". Unknowns are excluded and counted unless `includeUnknown` is on. Log the sector rule.
- `FilterBar` shows the hidden counts ("1,945 hidden: region unknown · Show"). On Command and VC math it renders a one-line note that filters apply to Investors, Competitors and Strategy.
- `src/lib/url-state.ts`: pure `encode` / `decode` (tested) for `region, stage, type, fund, sector, maturity, unknown, q, page, sort, inspect` (`inspect=investor:inv_x` or `company:co_x`) and Strategy's `w` (six weights), `raise`, `instrument` and `lean`. `src/components/shell/UrlSync.tsx` is a client component rendered in its own `<Suspense fallback={null}>` in `layout.tsx`. It reads with `useSearchParams` and writes with `window.history.replaceState`, which Next supports and which keeps navigation out of the history stack.
- Add `export const ensureStatic = "navigation"` to `src/app/layout.tsx` so no later change can make a route render per request. If `next build` rejects a route, fix the route rather than remove the export, and log any exception. Keep the dev overlay's instant-navigation validation free of warnings.

### 1.5 Test tooling (pin exact versions; record them in DECISIONS)
- Component tests: add `@testing-library/react`, `@testing-library/user-event` and `jsdom`. Split `vitest.config.mts` into two projects: `node` for `*.test.ts`, and `jsdom` for `*.test.tsx` under `tests/components/` and `src/**`. Keep the 95% finance coverage threshold.
- End to end: add `@playwright/test` and `@axe-core/playwright` with `playwright.config.ts`. Its `webServer` runs `pnpm build && pnpm start -p 3100`. Projects: desktop 1280×800, tablet 768×1024, phone 375×812. Specs go in `tests/e2e/*.spec.ts`; Vitest ignores them by name.
- Scripts: `test:e2e`, `perf:lighthouse` (§13), `data:profile`.

### 1.6 Retire the Phase 0/1 sanity UI
Delete `src/app/debug/`: its connector table becomes a panel in Network (§7), and its rounds table moves into company profiles. Remove `phaseNote` from `src/lib/nav.ts` and phase notes from `EmptyState`; empty states now say what to do next (§9). Add `scenario` and `challenges` to `VC_MATH_TOOLS` (§11).

---

## 2. Shared primitives (`src/components/data/`, `src/components/charts/`)

### 2.1 Unknowns
`<Unknown />` renders `UNKNOWN` ("—") with a visually hidden "unknown". `<Value value format>` renders a formatted value or `<Unknown />`. Partial dates use one formatter, `formatPartialDate(date, precision)` in `src/lib/format`, which gives "2025", "Q3 2025", "Mar 2025" or "12 Mar 2025". Converted amounts show the original currency and amount beside the USD figure; the FX tooltip gives the rate, its period and a link to its source.

### 2.2 Provenance
- `resolveSources(record, field)` in `src/lib/data/sources.ts` (pure, tested) returns `{ sources, level: "field" | "record" }` from `field_sources[field]`, falling back to `record.sources`.
- `<SourceIcon sources level label />` is a button with a popover listing title, publisher, `retrieved_at`, kind and a link. A `user_supplied:<id>` source shows "User list (unverified): <id>" with no link. The accessible name reads, for example, "Sources for check size: 2, record level". Every number in the inspector gets one.
- `<ComputedIcon method inputs />` replaces the source icon on derived values (sector weights, industrial affinity, stage earliness, fit features). It shows the `method` and `inputs` the pipeline recorded, and links to the sources of those inputs where they are fields.
- `contested` rounds get a "Sources disagree" chip that opens the anomaly entries for that record (from `getAnomalies()`).

### 2.3 Data confidence meter (PROJECT_CONTEXT §5.7)
`dataConfidence(investor, roundsCount)` in `src/lib/data/confidence.ts` returns the record's `confidence`; fields known out of the Tier A list in PHASE_1 §4.3 (type, region, HQ, website, stages, check range, leads, thesis, ≥ 1 fund, ≥ 1 partner, ≥ 8 rounds, application URL); and the source-kind mix. Render it as a three-step meter plus text ("7 of 12 fields known · 4 primary, 2 secondary, 1 user list"). There is no blended score. Log the definition.

### 2.4 Fit coverage and bounds
- Add `fitBounds(fit, weights)` to `src/lib/fit/score.ts` and test it: the lowest and highest score possible if each unknown feature were 0 or 1. A sparse investor scoring 100 on 10% coverage shows a range of 10–100, which states the trap honestly. Log it as an addition to the 2026-10-30 fit entry.
- `<FitCell>` shows the score, a six-cell coverage strip (filled = known, hollow = unknown, in weight order), the bounds as a thin range bar, and chips for `sparse` and `conflict`. `<FitBreakdown>` (inspector, Strategy) lists each feature's value, its points under the current weights, its method and inputs, or "unknown".

### 2.5 Charts
- `useThemeColors()` resolves the CSS tokens (`--cat-1..7`, `--co-1..5`, `--ink`, `--ink-muted`, `--rule`, `--amber`, `--focus`) to concrete colour strings and updates on a `data-theme` change (watch the attribute with a MutationObserver). Sigma, Plotly and Recharts all take colours from it. No hex values in components.
- `<ChartFrame title summary table>` provides a heading, a one-sentence text summary that is also the chart's accessible name (`role="img"`, `aria-label`), a legend in text, a "Show as table" toggle that renders the same data as a real `<table>`, and a footnote counting unplotted records and why.
- Recharts for standard charts; D3 for custom SVG (SAFE dilution waterfall, timelines). Import only the named exports you use from `d3`, and check the result with `pnpm next analyze`. Animate only in response to user input, never with `prefers-reduced-motion` (Recharts `isAnimationActive`).

---

## 3. Inspector and profiles

- Selection becomes `{ kind: "investor" | "company" | "round", id, companyId? }` with no payload. The inspector fetches through `src/lib/data/client.ts`, shows a skeleton of the final layout while loading, and an inline error with Retry on failure.
- **Focus:** opening from the keyboard moves focus to the inspector heading. Escape or Close returns focus to the element that opened it, so record that element on `select`. The resize handle keeps its keyboard support. The inspector syncs with `inspect=` in the URL, so a profile link is shareable.
- **Investor profile** (PROJECT_CONTEXT §2 Profile), sections in this order:
  1. Identity: name, aliases, parent brand, type, region, HQ, website, LinkedIn and application links, research depth ("Deep research" A / "Profile" B / "List only" C), and flags (`inactive`, `not_early_stage_target_by_default`).
  2. Confidence meter and fit breakdown.
  3. Thesis text with sector weights as a bar list.
  4. Stages, check range, leads, cold inbound, Indian founders, US entity required. A `yes | no | unknown` value shows as that word, never as a blank.
  5. Funds: a table of number, size, close date (at its precision) and vintage, newest first, with a fresh marker.
  6. Notable portfolio: companies in our or neighbouring layers first, then most recent. Show 8 rows with "Show all n".
  7. Co-investors: the top 10 by shared rounds. Each opens that investor.
  8. Competitor exposure: competitor, category, role, date, and why it is or isn't a conflict.
  9. Partners: name, title, focus, LinkedIn. Public professional information only.
  10. Seed-list claims, labelled "unverified list claims".
  11. Every source, grouped by kind.
- **Company profile:** identity, `sector` with `sector_classified_by`, layer, description, then rounds (stage, date, amount, lead / participant / role not stated, contested chip). Competitors add category, layer detail, size class, founders, named customers, headcount as "about n (source)", revenue only when reported, product summary and pricing.
- Remove the raw JSON `<pre>` and its `font-mono`: §9 bans monospace for data.

---

## 4. Directory (`/investors/directory`) — the Lighthouse gate

- The server page builds `DirectoryRow[]` and passes only those to the client table. Full records never reach the page.
- **Columns:** Name (a button; a search box matches names and aliases), Fit (`FitCell`), Research depth, Region, Type, Stages, Check range, Latest fund (size and year, fresh marker), Maturity, Rounds, Confidence. Numbers are right-aligned `num`. Unknowns sort last in both directions, as today. Default sort: fit descending with sparse records after all non-sparse ones, stated in the header's tooltip.
- **Category chips** (PROJECT_CONTEXT §2): region × freshness × maturity × stage × type. They are the visible state of the filter store, not a second state. Each chip shows its count, and the unknown count sits beside it.
- **Paging:** TanStack Table v9's row pagination at 100 rows per page, with `page` in the URL. Rows have a fixed height and the pager has reserved space, so filters cause no layout shift. An `aria-live="polite"` status reads "Rows 101–200 of 700. 1,945 hidden: region unknown."
- **Empty state:** "No investors match these filters. Clear a filter or include unknown values", with both actions as buttons.
- **Gate:** Lighthouse performance ≥ 85 (§13) before moving on.

---

### 4.1 Accelerators (`/investors/accelerators`)

Added after Phase 1 at the user's request: 30 programmes from a user-supplied list (`accelerator_programs.json`), terms as listed and unverified. Replace the plain table with the Directory's table primitives: sort by headline USD, first check and equity; filter by equity-free and by linked tier; open the linked investor in the inspector; label every term "as listed" with the list as its source. Unlinked programmes (7) show "—" for firm with the reason in the inspector.

## 5. VC math calculators (`/vc-math/[tool]`)

All math comes from `src/lib/finance/`; **no arithmetic on money, shares or percentages in components** beyond formatting. Each calculator has inputs (sliders paired with number inputs), a live chart, a results table, a "Show the formula" toggle, and one preloaded worked example. Move the PHASE_1 §2.2 inputs out of `tests/finance/worked-examples.test.ts` into `src/lib/finance/examples.ts`, imported by both the tests and the calculators, so every preloaded example is a tested one. Engine `RangeError`s become inline messages next to the input at fault, never a crash. Input schemas live in `src/lib/schema/calculators.ts` (Zod), shared with the share codec in §11; run `pnpm gen:schema` after adding them.

| Tool | Engine | Output | Preloaded example |
|---|---|---|---|
| Round builder | `pricedRound` | Ownership bars before and after, price per share, new shares; a pre- or post-money toggle | §2.2-1 |
| Cap table | `simulate` (SAFE, note, pool top-up and priced steps, 1..n) | Stacked area of ownership by step; founder % at the last step; a snapshot table per step | §2.2-3 as steps |
| Option pool shuffle | `poolShuffle`, `poolIncreaseForTarget` | Headline vs effective pre-money; who pays for the pool | §2.2-2 ($8M headline, $7M effective) |
| SAFE | `convertPostMoneySafes`, `convertPreMoneySafes`, `equityFinancing`, `resolveMfn` | Conversion table (price and method: cap or discount), D3 dilution waterfall, pre- and post-money SAFEs side by side on the same inputs | §2.2-3, plus YC Appendix II example 1 |
| Convertible note | `accrue`, `convertNote`, `yearFraction30360` | Accrued value curve by month, cap price vs discount price, shares at conversion | §2.2-4 |
| Liquidation waterfall | `distribute`, `payoutCurve`, `conversionPoint` | Payout by class across exit values with conversion points marked; a table at the chosen exit; seniority vs pari passu toggle | §2.2-5 |
| VC method | `vcMethod` | Required ownership, implied post- and pre-money | §2.2-7 |
| Fund math | `exitOwnership`, `exitNeededToReturnFund`, `proRata` | A horizontal gauge: exit needed vs a chosen exit, for $50M and $1B funds side by side | §2.2-6 and §2.2-8 |
| Power law | `simulatePortfolio` (seeded) | Histogram of fund multiples, p10 / median / p90, P(≥ 1x), P(≥ 3x); the seed shown and editable | Inputs labelled "illustrative assumption", since no dataset gives them |
| India instruments | `notesForTopic`, `INDIA_TOPICS`, `croreToRupees`, `inrToUsd` | Legal notes by topic with sources, `last_verified`, `effective_date` and the disclaimer; a FEMA floor check (issue price per share vs fair value per share, both entered in ₹, pass or fail citing the `fema_pricing` note); a ₹25 lakh minimum-ticket check for convertible notes citing the `india_convertible_note` note | Inputs blank until entered |

Add the two pure helpers the India view needs to `src/lib/finance/india.ts`, with tests: `femaFloorCheck({ issuePrice, fairValue })` and `noteTicketCheck(amountInr)`. Each constant holds the legal-note id that states its rule. A USD figure appears only when the user enters an INR/USD rate; otherwise only INR is shown.

The power law simulation must finish in ≤ 50 ms at the default trials. Debounce input by 150 ms. If the trials control allows more than 20,000, run it in a Web Worker.

---

## 6. Thesis map and capital bubbles

**Thesis map (`/investors/thesis-map`)** is an SVG scatter of the 359 points.
- UMAP axes have no units: no ticks. Say "Position shows thesis similarity."
- Colour is the cluster. Clusters 1–7 use `cat-1..7`; from the 8th on, reuse colours with a square, then a diamond. Put direct labels at the cluster centroids.
- Generalists are hollow rings, per PROJECT_CONTEXT §2.
- The Fit view toggle switches to x = industrial affinity, y = stage earliness (both 0–1, ticks shown) and plots only the 102 investors with both.
- Hover shows a card (name, cluster, top three sectors with weights, fit); click opens the inspector.
- Below the canvas, a listbox of the plotted investors in filter order acts as the keyboard path: arrow keys move, Enter opens. The footnote reads, for example, "2,334 investors have no thesis vector: A 17, B 120, C 2,197."

**Capital bubbles (`/investors/capital`)** is a Plotly `scatter3d`: x = typical check (log), y = stage earliness, z = industrial affinity, size = latest fund, colour = cluster.
- Plotly loads only here: `next/dynamic(() => import(...), { ssr: false })` inside a client component, using `react-plotly.js/factory` with `plotly.js-dist-min`.
- Investors without a fund size draw at a fixed small size as a hollow marker, with a legend entry "fund size unknown".
- `plotly_click` opens the inspector; hover shows the card.
- The 64-row table alternative is always available, and is the default below 768 px.
- The footnote reads, for example, "887 of 951 not plotted: check size unknown 884, stage unknown 846, affinity unknown 592".
- No auto-rotation, and no transitions under reduced motion.

---

## 7. Network (`/investors/network`) — the 60 fps gate

- The `SigmaContainer` (`@react-sigma/core` 6) loads with `ssr: false` and fetches `fetchGraphView()` after mount. Build the graphology graph once, with x/y from the file. Never run a layout in the browser, and keep `graphology-layout-forceatlas2` out of client bundles.
- **Encoding:**
  - Investor size grows with √degree. Colour by a "Colour by" control: cluster (default), region, research depth or freshness. Unknown is `ink-muted`.
  - Companies are greys `co-2..5`, shaded by the sum of sourced round amounts in our data and labelled "known rounds (lower bound)". A company with no known amount gets the lowest step and a legend entry. Don't use `co-1` on the dark canvas (2.85:1).
  - Competitors get a grey fill with an amber outline: `--focus` in the light theme, because `#F2B134` is 1.75:1 there. Sigma 4 has no border layer, so build the outline from a node backdrop or a two-layer shape after reading its declarations, and log the method.
  - Edges: lead edges solid and wider; participant edges thinner; role-not-stated edges thin and dashed (Sigma 4 has a dashed edge layer); co-investment edge width grows with weight.
- **Modes:** full graph; ego network on click (depth 1, with a toggle for depth 2); VC↔VC co-investment projection (the 304 investors and 616 edges, reusing the bipartite positions, with a DECISIONS note; if it reads poorly, extend `scripts/layout-graph.ts` with a seeded projection layout and a schema field); competitor highlight (competitors, their backers, and the edges between them).
- **Interactions:** pan, zoom, pinch; hover highlights the neighbours; click selects and opens the inspector; clicking an edge opens its round. Filtering by cluster, research depth, region and sector (global filters plus a cluster picker) uses Sigma 4 node and edge reducers and state, never mutating attributes per frame. Companies left with no visible edge are dimmed.
- **Labels and connectors:** labels appear only for nodes above `labelRenderedSizeThreshold`, plus the hovered and selected nodes; at the default zoom roughly the 76 investors with degree ≥ 8. Turn on `hideEdgesOnMove` only if the fps test fails without it.
- **Keyboard and text alternative:** a "Find a node" combobox selects a node, centres the camera on it (with no animation under reduced motion) and opens the inspector. The inspector's co-investor and portfolio lists move along the graph. A side panel lists the top 25 connectors by betweenness (from the old `/debug` page), each a button.
- **Theme:** the canvas background is the page's; labels and edges take `useThemeColors()` and refresh on a theme change.
- **Gate:** §13.2's fps test passes on the full dataset.

---

## 8. Competitors (`/competitors`)

- **Table:** name, category (direct / adjacent / remote), layer and layer detail, size class, founded, total raised, latest round, headcount ("about n" with source), sources. Clicking a row opens the company profile.
- **Founded vs total raised** (scatter, log y, colour by category, competitors drawn per §9 styling): 30 plotted, 14 listed underneath with what is missing.
- **Funding timeline** (D3): one row per competitor, x = date. Rounds with an amount are sized by amount; rounds without one are hollow at a fixed size. Month and year precision draw as brackets spanning the period. Lead investors appear on hover; click opens the round.
- **Investor overlap matrix:** investors × competitors, columns grouped by category. Each cell shows the role and latest date and opens the round. Default rows are the 36 investors backing two or more competitors; a toggle shows all 331. Global filters apply to rows. On narrow screens the matrix scrolls inside its own container with the first column sticky.
- **Layer map:** seven layer columns from design intent to full-stack factory, competitors placed by category, marker size by size class. Seven competitors have no size class and draw hollow.
- No revenue chart: only 2 of 44 report revenue. Show it in profiles only.

---

## 9. Raise strategy (`/strategy`)

- **Our raise** inputs, all in the URL and labelled "assumption" (PROJECT_CONTEXT §1, §11.1):
  - raise size, default $1.0M;
  - instrument, default post-money SAFE;
  - pitch lean, which sets which layers count as ours for adjacency. "Balanced" (the pipeline's default: design intent, process planning, plant ops, quality vision) is the default; "Design intent" uses design intent and process planning; "Plant ops" uses plant ops and quality vision. Neighbour layers stay as configured. This answers §11.3 in the app until the human decides. Log it.
- **Live fit:** port the `check` and `adjacency` features from `pipeline/atlas/analyze/fit.py` to `src/lib/fit/features.ts`, so raise size and pitch lean re-score live. The other four features come from `fit_features.json` unchanged. `strategy-view.ts` ships per investor only check min/max/leads and the distinct adjacent companies (layer, industrial-sector flag, most recent round date). Constants go in `src/lib/fit/config.ts` (`FIT_REFERENCE_DATE = "2026-10-30"`, layers), commented with their pipeline twins. A **parity test** recomputes both features for every investor at $1.0M and the Balanced lean and matches `fit_features.json` to 1e-6.
- **Ranking:** six weight sliders (0–100 each; the effective share is shown, since `fitScore` normalises) and `rankByFit` with `useDeferredValue`, so dragging stays smooth. By default only non-sparse, active investors rank (151 today). "Include sparse (2,452)" appends them below a divider with their bounds visible. Columns: rank, investor, `FitCell`, bounds, reason chips, research depth, region.
- **Outreach tiers** ("Reach out first", "Next", "Later"; plus "Research first" for sparse records). Never call these Tier A/B/C, which already means research depth. They come from `outreachTier(score, flags, thresholds)` in `src/lib/fit/outreach.ts`. Conflict and inactive never reach "first". Set the default thresholds from the measured distribution so that "first" holds 10–20 names (today the non-sparse top 10 run 72.7–80.0), make them editable, and log them.
- **Reason chips** come from `src/lib/fit/reasons.ts` (pure, tested; thresholds logged):
  - positive: pre-seed, seed, fresh fund, leads, check fits our raise, industrial thesis, n companies in our layers, backs Indian founders, takes cold pitches, application form;
  - negative: conflict (naming the competitor and date), requires a US entity, inactive, not an early-stage target by default.
  - No paragraphs.
- **Backed our competitors:** two lists from the overlap data. "Likely conflict" holds investors flagged `conflict` (51): they backed a direct competitor in the last 24 months. "Signal of thesis interest" holds the rest. Each row shows competitors, category, role and date.
- **Benchmarks:** a dot plot per metric with our raise marked. Each point shows publisher, period, sample size and instrument, and its notes expand. Never auto-select a SAFE cap band from the three: the band is stated only in notes. Show "No India pre-seed or seed median in our data" for India.
- **Open structural questions:** the `india_flip`, `delaware_requirement` and `reverse_flip` notes with their sources and the disclaimer, plus PROJECT_CONTEXT §11's questions with status "open". Present facts only; make no recommendation (§1).

---

## 10. Command (`/`)

Small multiples on rules and whitespace, not a grid of boxed cards. Every number comes from `command-view.ts`:
- **Investors tracked:** 2,693, split into researched (117), list only (775) and co-investor only (1,801).
- **Region split:** western 700, India 17, other 31, unknown 1,945, drawn as one bar with unknown included.
- **Fresh capital:** 126 funds closed since 2024-10-29, a $41.0B sum and $85M median, on a log strip plot of fund sizes with the largest labelled. Captioned "raised by funds closed since 2024-10-29; uncalled capital ('dry powder') is not public".
- **Deals mapped:** 887 rounds by quarter, stacked by stage, with the unknown-amount count.
- **Competitors tracked:** 44, as a category × layer mini matrix.
- **Top 10 by fit:** non-sparse, active, default weights, with `FitCell` and a link to Strategy.
- **Data freshness:** a quiet line with the pipeline's `generated_at`.

The filter bar does not apply here (§1.4).

---

## 11. Gamified layer (VC math)

- **Scenario mode (`/vc-math/scenario`):** a three-round path (pre-seed, seed, Series A). Each round has an instrument (post-money SAFE or priced), an amount, a cap or pre-money, a pool target and preference terms (1x non-participating by default). Then pick an exit value.
  - Add `scenarioOutcome()` to `src/lib/finance/scenario.ts`. It composes `simulate` and `distribute` and returns founder FD % after each round, founder proceeds at the exit after preferences, and a **founder outcome score = founder proceeds ÷ exit value × 100**. PROJECT_CONTEXT doesn't define the score, so log this definition for review.
  - For how converted SAFEs rank in the preference stack, follow the YC SAFE user guide the engine already cites, and cite the passage in JSDoc. Test it against a hand-worked case.
  - "Pin as baseline" (in `localStorage`) shows deltas against a pinned path.
- **Guess the number (`/vc-math/challenges`):** `makeChallenge(kind, seed)` in `src/lib/finance/challenges.ts` (pure; inputs from `mulberry32`) returns `{ prompt, inputs, answer, unit, formula }`. The answer comes from the engine function, and a test asserts that for every kind. Kinds:
  - priced-round ownership;
  - effective pre-money after a pool shuffle;
  - post-money SAFE ownership;
  - note conversion shares;
  - payout at an exit;
  - VC-method post-money;
  - exit needed to return the fund;
  - pro-rata amount.

  Tolerance is ±2% relative, or ±0.5 percentage points for percentages; log it. After an answer, show the engine's answer, the formula with the numbers, and "Open in calculator" (a share link). Keep the current and best streak per kind and overall in `localStorage["atlas-challenges"]`, versioned and wrapped in try/catch like the theme; there is no server. Feedback motion runs only on answer and never under reduced motion; no sound.
- **Share links:** every calculator, scenario and challenge serialises to `#s=<base64url JSON>` as `{ v: 1, tool, inputs }`, validated by the Zod schemas from §5. Read the hash with `useSyncExternalStore`, where the server snapshot is the worked example. A bad, oversized (> 2,000 characters) or outdated link loads the example with an inline note. "Copy link" uses the Clipboard API, with a select-the-text fallback.

---

## 12. Responsive

PROJECT_CONTEXT §9: graphs to tablet, tables and calculators to phone. Test at 375×812, 768×1024, 1280×800 and 1920×1080. At no width does the page scroll sideways.

| Width | Layout |
|---|---|
| ≥ 1280 | Rail, canvas, resizable side inspector |
| 768–1279 | Icon rail; the inspector is an overlay sheet from the right (`components/ui/sheet`); graphs, map and bubbles take touch pan, pinch and tap |
| < 768 | Filters collapse to a "Filters (n)" button that opens a sheet. Directory and Strategy show three columns (name, fit, region) and the rest lives in the full-screen inspector. Calculators stack inputs above a fixed-height chart. Thesis map, bubbles and network show "Open on a tablet or larger for the map" above their table or list alternative, never a dead end. The overlap matrix scrolls inside its container |

---

## 13. Performance

### 13.1 Budgets

| Target | Budget | How it is checked |
|---|---|---|
| Directory | Lighthouse performance ≥ 85 with the default (mobile) settings, median of 3 runs. Also report desktop. LCP ≤ 2.5 s, TBT ≤ 200 ms, CLS ≤ 0.1 | `pnpm perf:lighthouse` (Lighthouse CLI, pinned) against `pnpm build && pnpm start`, then again on the protected preview with the bypass header (§15) |
| Directory payload | Row data ≤ 400 KB raw and ≤ 50 KB gzip (today 341 / 36); route JS ≤ 200 KB gzip first load; no Plotly, Sigma, Recharts or D3 in its chunks | `tests/budgets.test.ts`; the `next build` route table; `pnpm next analyze` |
| Inspector | Profile JSON p95 ≤ 50 KB raw; click to painted profile ≤ 300 ms on a local production build | Budgets test; a Playwright timing |
| Graph view | ≤ 450 KB raw and ≤ 120 KB gzip (today 393 / 105) | Budgets test |
| Network | ≥ 60 fps while panning, zooming and hovering on the full dataset | §13.2 |
| Strategy | Re-ranking every fit record ≤ 16 ms; slider INP ≤ 200 ms | A Vitest timing over the real fit records; Chrome performance panel |
| Capital bubbles | Plotly in this route's chunk only; its weight recorded | `pnpm next analyze` |

### 13.2 Measuring fps
`tests/e2e/graph-fps.spec.ts`, run headed Chromium with the GPU on (headless Chromium may fall back to software WebGL and measure the wrong thing):
1. Load the network view and wait for the first render.
2. Script 5 s of drag-pan, wheel zoom in and out, and a hover sweep across 50 nodes.
3. Sample frame intervals with `requestAnimationFrame` inside the page.
4. Pass when the median interval is ≤ 16.7 ms and no more than 5% of frames exceed 33 ms. Record the machine, GPU and browser in the report.

Repeat with a synthetic 2× graph fixture (`tests/fixtures/graph-2x.json`, generated by script with the same shape and a seed) and report the result; it is not a gate.

---

## 14. Accessibility (WCAG 2.2 AA)

- **Automated:** an `@axe-core/playwright` scan of every route in both themes at desktop and phone sizes. Zero serious or critical violations.
- **Keyboard paths**, each a Playwright test using keys only:
  - skip link → rail → filter bar → canvas → inspector, and back;
  - sort, page and open in the Directory;
  - search, then select, then inspect in the Network;
  - the listbox on the Thesis map;
  - every calculator input;
  - challenge answer and streak.
- **Focus:** visible everywhere, with the existing amber / `#A86B00` ring. The inspector moves and returns focus (§3). Popovers and sheets trap and restore focus (Radix).
- **Contrast:**
  - Text stays ink or `ink-muted`, never a category colour on the light theme.
  - In the light theme, give category-coloured marks a 1 px `--ink` stroke at 60% opacity, so `#F0E442` (1.22:1), `#E69F00`, `#56B4E9` and `#CC79A7` stay discernible.
  - The competitor outline uses `--focus` in light.
  - Company marks start at `co-2` on the dark canvas.
  - Every colour encoding repeats in text, in the legend or the table alternative.
- **Reduced motion:** `MotionConfig reducedMotion="user"` is already in place. Also: no Sigma camera animations, no Plotly transitions, no Recharts animation and no streak animation when reduced motion is on.
- **Tables:** real `<table>` with `<caption>`, `scope` on header cells, `aria-sort` on sortable headers, and live-region announcements for paging and filter counts.
- **Charts:** `ChartFrame` provides the summary, legend text and table alternative (§2.5). The 3D chart and the graph have full keyboard alternatives (§6, §7).
- **Manual:** an NVDA pass on Windows over the Directory, the inspector, one calculator and Strategy. Note what was read wrongly and fix it.

---

## 15. Deploy — protected Vercel (needs the human's approval and credentials)

Do nothing on Vercel until the human says go in the session. Never print, commit or log a token, password or bypass secret. The app needs no environment variables: data ships in `data/processed/`.

1. **Prepare in the repo** (no approval needed):
   - Add a `.vercelignore` excluding `data/raw/` (it holds the customer target lists; PHASE_0_REPORT open question 4), `data/research/`, `data/interim/`, `pipeline/`, `coverage/` and `tests/e2e/` output, so they are never uploaded.
   - Confirm `pnpm build` passes from a clean clone with only `data/processed/` present.
   - Set Node 24.x in the project settings or `package.json` `engines`.
2. **Human:** the repo has no git remote. Either create a private GitHub repo and connect it to a Vercel project, or run `vercel login` and `vercel link` locally. Choose the team and plan.
3. **Protection** (PROJECT_CONTEXT §8, "internal data"):
   - Turn on Vercel Authentication before the first deploy. The API's `ssoProtection.deploymentType` values are `prod_deployment_urls_and_all_previews` (Standard Protection), `all` (All Deployments) and `preview`.
   - Standard Protection, by its definition, covers preview URLs and generated production deployment URLs, not the production domain. Recommend `all`, or never assigning a public production domain if the plan doesn't offer `all`. Check plan availability in the dashboard; don't assume it.
   - Password protection is another plan-dependent option.
   - The human decides. Record the choice in DECISIONS.
4. **Preview first:** `vercel deploy` (or push the branch). Then:
   - check that a logged-out request gets Vercel's login wall, not the app;
   - run the Playwright smoke suite and Lighthouse against the preview, using an automation bypass secret the human creates (Deployment Protection → Protection Bypass for Automation) and sends as the `x-vercel-protection-bypass` header (`--extra-headers` for Lighthouse, `extraHTTPHeaders` for Playwright), read from an environment variable.
5. **Production** only with the human's approval: `vercel deploy --prod`, or promote the checked preview. Then re-run the logged-out check.
6. Write the URL, the protection mode and the checks in `docs/PHASE_2_REPORT.md`, but never a secret.

---

## 16. Tests

| Layer | What | Where |
|---|---|---|
| Unit (Vitest, node) | Every new pure function: filters, URL state, view models, `resolveSources`, `dataConfidence`, `fitBounds`, the fit port (with the parity test), outreach tiers, reasons, graph view, command and competitor views, `femaFloorCheck`, `noteTicketCheck`, `scenarioOutcome`, `makeChallenge`, the share codec, `formatPartialDate`; plus the budgets test | `tests/*.test.ts`, `tests/finance/` |
| Component (Vitest, jsdom) | Where logic sits in a component: `SourceIcon` (record vs field level, user-list label, keyboard); `FitCell` and `FitBreakdown` (unknown features, bounds); the Directory table (unknowns sort last, paging announcements, chips mirror the store); weight sliders (live re-rank); one test per calculator asserting displayed values equal the engine's output for the worked example and that invalid input shows an inline error | `tests/components/*.test.tsx` |
| End to end (Playwright) | A smoke test per route: Command; the 12 VC math tools; Directory, Thesis map, Capital bubbles and Network; Competitors; Strategy. Each loads, shows real data, has no console errors, and opens the inspector from its canvas where it has one. Also: the keyboard paths (§14), axe in both themes, responsive checks at the three sizes, share-link round trips, `inspect=` deep links, and the fps spec | `tests/e2e/*.spec.ts` |

---

## 17. Exit checklist

- [ ] All five tabs, all 12 VC math tools and all four investor views work on real data through `src/lib/data/`. No Phase 0/1 sanity UI is left.
- [ ] Every inspector number has a source or "how computed" icon. Every investor has the confidence meter, and fit shows coverage and bounds.
- [ ] Unknowns show as "—" with counts of what each view leaves out. Nothing is imputed.
- [ ] Calculators call `src/lib/finance` only. Each preloads a tested worked example and has the formula toggle and a share link.
- [ ] Fit sliders, raise size and pitch lean re-score live. The parity test passes. Sparse records are excluded from default rankings.
- [ ] Gamified layer: scenario mode, challenges with streaks, `#s=` share links.
- [ ] Lighthouse performance ≥ 85 on `/investors/directory` (mobile, median of 3), locally and on the protected preview.
- [ ] Network ≥ 60 fps on the full dataset (§13.2), with the 2× fixture result reported.
- [ ] axe has no serious or critical violations on any route in either theme; the keyboard path tests pass; the NVDA pass is done.
- [ ] Responsive at 375, 768, 1280 and 1920 widths, with no horizontal page scroll.
- [ ] Protected Vercel deploy is live with the human's approval, and a logged-out request is refused.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm validate:data && pnpm test:e2e` pass. `pnpm build` passes with every route prerendered. Finance coverage is ≥ 95%.
- [ ] DECISIONS.md logs every choice this file asks you to log; README phase status is updated.

## 18. Hand-off

Write `docs/PHASE_2_REPORT.md`:
- what each tab does now, with a screenshot per view in both themes (`docs/screens/`);
- measured results: Lighthouse runs, fps (with machine), budgets vs actuals, bundle sizes per route, axe summary, NVDA notes;
- deploy URL, protection mode and the checks run;
- deviations from this file and why;
- where thin data limits a view (re-measured §0 numbers): what the next research batch would unlock, for example check sizes for the bubbles and stages for the fit view;
- open questions for the human:
  - raise size and instrument (§11.1);
  - which entity raises (§11.2);
  - pitch direction, now a lean selector (§11.3);
  - who uses the app and whether anything is shared outside, which decides the protection mode and whether partner names are shown (§11.4);
  - the incoming spreadsheets (§11.5);
  - the founder outcome score definition;
  - the outreach thresholds;
  - "dry powder" wording;
  - company shading without total raised.

Then stop and wait for review.
