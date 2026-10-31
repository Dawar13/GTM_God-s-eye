# Phase 2 report — interface, visualisation and polish

Phase 2 built every view of Capital Atlas on the frozen Phase 1 data, following `docs/PHASE_2.md`. This report covers what shipped, how chart accuracy is enforced, performance and accessibility, data gaps, deviations and the next steps. Every figure here comes from `docs/DECISIONS.md`, the test suite or measurements taken in S10b.

## What shipped

| Session | Commit | What |
|---|---|---|
| Plan | `6d0520e` | The user's `docs/PHASE_2.md`; branch `phase-2` started. |
| S0 | `fa2fff1` | Light-first tokens (dark under `[data-theme="dark"]`), the ui-atlas primitives (`Panel`, `Stat`, `Chip`, `ChartFrame`, `VizTooltip`, `Legend`, `Segmented` and the rest), palette and scale helpers, and the `/lab` style guide. |
| S1 | `542e3bb` | Shell: collapsible rail, top bar with sub-tabs, `cmdk` command palette, URL filters with `nuqs`, resizable Inspector drawer (bottom sheet below 1024px), keyboard shortcuts. |
| S2 | `9a4eb9a` | Command: stat strip and four small multiples (funds by year, fresh capital by region, top 10 by fit, recent deals in our layers), each linking to its full view. |
| S3 | `48475ba` | VC math I: round builder, cap table with a step chart, option pool shuffle, SAFE (post-money, pre-money, compare). |
| S4a | `6ee72c8` | VC math II: convertible note, liquidation waterfall with breakpoints, VC method, fund math with a required-exit gauge. |
| S4b | `46f2db0` | Power law Monte Carlo in a Web Worker (seeded), India legal notes, opt-in Practice mode (scenarios and challenges); filters hidden on VC math. |
| S5 | `8817207` | Investors directory (virtualised TanStack table, column chooser, density, CSV export, sort in the URL) and the Inspector investor profile. |
| — | `e3816b8` | `data/interim/` tracked in git at the user's request. |
| S6 | `1479f88` | Thesis map (hulls, labels, brush to filter the Directory, Fit view) and capital bubbles (Plotly 3D with three linked 2D projections). |
| S7 | `255fa9e` | Network graph on Sigma 4: one graph per payload, filters and four modes as reducers, search-to-focus, fullscreen. |
| S8 | `3d49448`, `749a06e` | Competitors: table, founded vs raised scatter, funding timeline, investor overlap heatmap, layer map. The fix commit corrected the meaning of the conflict flag. |
| S9 | `2fb3ce4` | Strategy: fit weight sliders, ranked targets, outreach tiers with manual overrides, our raise against benchmarks, competitor investors split, structural questions, target-list CSV. |
| S10a | `a947b07` | Performance (server-rendered shell, row payloads moved to `/api` routes, lazy Inspector profile and palette), AA contrast in both themes, accessibility checks, consistency sweep. |
| S10b | not yet committed | A last performance pass on Command and Network, mobile layout fixes, `docs/RUNBOOK.md`, final screenshots and this report. |

Final screenshots of each top-level tab, desktop 1440×900 and mobile 390×844, are in `docs/screens/final-*.png`.

## How the chart accuracy contract is enforced

`docs/PHASE_2.md` §2 is enforced by code and tests, not by review alone.

- **Tested transforms.** Every chart's data comes from a pure function in `src/lib/viz/transforms/` (27 modules, one of them shared helpers). Components do not reshape records. The transforms are covered by `tests/viz-transforms.test.ts`, `tests/viz-calculators.test.ts`, `tests/viz-calculators-s4a.test.ts` and the per-session suites (`thesis-s6`, `capital-s6`, `network-s7`, `competitors-s8`, `strategy-s9`, `profile-s5` and others). Finance math lives in `src/lib/finance` with hand-checked worked examples and a 95% line-coverage bar.
- **Nulls and footnotes.** `ChartFrame` takes the sources and the not-shown counts and prints them in every footnote, along with the loading, empty and error states and the "View as table" toggle. Unknown values are counted, never drawn as zero.
- **Consistency with the Directory.** `tests/viz-consistency.test.ts` runs on the real loaders. For six filter combinations it checks that the stat strip, fresh capital, funds by year and top 10 match the Directory; that the Strategy ranking is the Directory's fit order; that thesis-map brushing, capital bubbles (position and latest fund) and network investor nodes match the Directory's rows; and, on Competitors, that the table, scatter, timeline and heatmap agree on rounds, totals and investor pairs.
- **Contrast.** `tests/contrast.test.ts` reads both theme blocks of `src/styles/tokens.css` and checks WCAG contrast for every text token on every surface it is used on. It failed on the S0 tokens (7 failures) and passes since S10a.
- **Parity with the pipeline.** Where the app recomputes something the Python pipeline also computes, a test compares them: the check-fit port against all 3,232 stored fit records (`tests/fit-check-s9.test.ts`), the 24-month conflict rule against every stored flag (`tests/competitor-investors-s9.test.ts`), and the column-wise `/api` payloads against the row builders they replace (`tests/payload-s10.test.ts`).
- **Formats.** Money, percentages and dates go through `src/lib/format` (`tests/format.test.ts`).

## Performance

Lighthouse 12, desktop preset, performance only, run with Playwright's Chromium 156 against `pnpm build` and `pnpm start -p 3000` on the development laptop. Targets from `docs/PHASE_2.md` S10: 90 or more on Command and Directory, 85 or more on Network.

Score is the median of the runs; the range follows in brackets. TBT and LCP are medians too. "Before" is the S10a build (`a947b07`) measured at the start of S10b; "after" is the final S10b build.

| Route | Target | Before | After | Result |
|---|---|---|---|---|
| Command `/` | 90 | 87 (82–92, 3 runs) · TBT 283 ms · LCP 0.9 s · CLS 0.001 | 92.5 (77–98, 10 runs) · TBT 192 ms · LCP 0.9 s · CLS 0.001 | Met on the median; 4 of the 10 runs were below 90 |
| Directory `/investors/directory` | 90 | 99 (S10a) | 98 (98–99, 3 runs) · TBT 69 ms · LCP 0.9 s · CLS 0.001 | Met |
| Network `/investors/network` | 85 | 66 (65–67, 3 runs) · TBT 1,445 ms · LCP 0.8 s · CLS 0.017 | 62.5 (46–64, 6 runs) · TBT 2,498 ms · LCP 0.8 s · CLS 0.017 | Missed |
| Strategy `/strategy` | none | 94 (S10a) | not re-measured | — |

- **The laptop slowed down during the session**, so the Network rows above are not a fair before/after. Measured back to back at the end, three runs each, the S10a Network code scored 56 (42–63, TBT 3,083 ms) and the S10b code 64 (63–65, TBT 2,321 ms). Command ranged from 77 to 98 on one unchanged build. Re-measure on the deployment (`docs/RUNBOOK.md`).
- **Command** now mounts its four charts one per task (`StaggeredContainer`). S10a found all four rendering in one 170–250 ms task.
- **Network** builds its graph in slices while a skeleton shows, and no longer redraws the whole graph once on mount. It still misses the target because of one task of 1.5 to 2.5 s: Sigma's constructor processing 3,923 nodes and 6,478 edges, plus the first WebGL frame, which headless Chromium draws in software. That task cannot be split from outside Sigma; DECISIONS (S10b) explains why and what would be needed.
- **Mobile** (Lighthouse's default Slow 4G and 4× CPU) is far below the targets on every route (S10a: 41 to 60). It was not re-measured in S10b. The app is a desktop console, so the targets are judged on desktop.

## Accessibility

- AA contrast for text in both themes, checked by `tests/contrast.test.ts`. S10a changed light `--muted`, `--positive` and `--negative` and dark `--muted` and `--negative`; each is now at least 4.6:1 on the surfaces it is used on.
- Every chart has a "View as table" alternative in `ChartFrame`. S10a opened all 35 toggles in a browser and each showed a table; the Directory, India notes and Accelerators are tables or text already.
- No button, link, radio, input or separator lacks an accessible name, and the first 40 tab stops on every route show a visible focus ring (S10a, Playwright, 18 routes).
- `scripts/keyboard-walkthrough.ts` visits all 18 routes by keyboard, drives the rail, the palette and the Inspector, and fails on console errors or server errors. It passes on the final S10b production build: 18 routes, 63 checks, no console errors.
- Motion only follows user actions and falls back to instant under `prefers-reduced-motion`, including the network camera.
- Pointer-only interactions (brushing the thesis map, dragging tier cards, WebGL hover) have keyboard routes: the table alternatives, the "Move to tier" menu and the network search box.

## Known data gaps

Data was frozen in Phase 2. `docs/DATA_ISSUES.md` logs 13 issues. None was fixed in the data; the views count or label each gap (a not-shown count, "—", a flag or a legend note) rather than hide it.

- Investors are thinly described: 2,553 of 3,317 have no region, 2,569 have no freshness (no fund on record), and in the graph 2,595 of 2,849 investors have no type and 2,324 no thesis cluster.
- Funds: 87 of 1,210 have no close date or vintage year, and 90 have no size.
- Fit scores: most investors are `sparse` (2,950 of 3,232 fit records), so rankings show the 282 reliable ones first.
- Chart coordinates are sparse: 558 investors have a thesis-map position, 191 can be placed in the Fit view, and 104 have all three capital-bubble axes.
- Companies: only 118 of 1,034 non-competitor companies have a layer, and only 37 of 1,074 graph companies have a stored total raised (130 have no amount at all).
- Competitors (44): 9 have no founded year, 7 no total raised, 19 no headcount and 42 no revenue; 9 of their 126 rounds have no date and 35 no amount. The schema stores revenue without currency or year and HQ without a city.
- Two pipeline choices are visible in the views: 9 thesis clusters against an 8-hue palette (a ninth hue was added), and 7 investors whose pipeline "latest fund" differs from the Directory's (the views use the Directory's).

## Deviations

The full list is in `docs/DECISIONS.md` under each session. The ones that change what a reader sees:

- **Shell and filters (S1, S4b, S8).** Filters live in the URL. They are hidden on VC math and Competitors, where no investor filter applies.
- **Command (S2).** Investors flagged `sparse` are left out of "Top 10 by fit", and "dry powder" is the size of fresh latest funds, not capital left to deploy; both are stated on the page.
- **VC math (S3, S4a, S4b).** The cap-table step chart is drawn as gapless stacked columns; steps can be added and removed but not reordered. The liquidation tool models two preferred classes. The VC method page has no gauge, since its exit is an input. The note value line starts at the principal, not zero, and says so. Practice has three question kinds.
- **Directory (S5).** Rows are focusable ARIA rows, not a native table, because the list is virtualised.
- **Thesis map and network (S6, S7).** WebGL network nodes have no darker stroke, and role-not-stated edges look like participant edges. The 60 fps network target was not measured on a real GPU.
- **Competitors (S8).** Revenue is shown in USD without its year, because the schema does not store one.
- **Strategy (S9).** Outreach tier cut-offs (70 and 55) are a design choice, stated on each column. No planned valuation is drawn on the benchmarks, because the app holds none.
- **Performance (S10a, S10b).** Network misses its Lighthouse target, and Command meets its target on the median but not on every run (see above). Zod still reaches the client bundle (33 KB gzipped) through `src/lib/schema/enums`, which was out of scope. Mobile scores are well below the targets on every route.
- **Screenshots (S10b).** The S10 row asks for desktop and mobile shots of every tab, so S10b took 10, over the two-screenshot rule.

## Deploy

Not done, by the user's choice: the user will deploy it themselves. `docs/RUNBOOK.md` gives the steps, including how to keep every deployment behind Vercel Authentication on the free plan and how to re-measure Lighthouse on the deployment.

## Phase 1 open questions still open

Two of the questions in `docs/PHASE_1_REPORT.md` §7 are now settled (items 1 and 2); the rest are open and Phase 2 ran on the stated defaults.

1. Raise size and instrument: now an app-wide variable ("Our round" in the top bar, in the link as `?raise=` and `?inst=`), defaulting to a $1.0M post-money SAFE. The raise re-scores every fit score; the instrument highlights matching benchmarks and sets the SAFE calculator's tab, but no fit feature depends on it.
2. Which entity raises: answered by the user on 2026-10-31. Investors put money into the Delaware C-Corp (the US parent), not the Indian Pvt Ltd. Strategy shows it as decided, with links to the India legal notes on that route.
3. Pitch direction (design-intent tooling or plant-ops agents). The fit weights use the defaults; Strategy's sliders let you try either.
4. Who uses the app and whether anything is shared outside. This decides deployment protection and whether partner names show; the RUNBOOK keeps everything private until it is answered.
5. The two incoming investor spreadsheets have not arrived, so nothing was ingested.
6. Whether to research the 25 unresearched Tier B investors.
7. The Phase 2 spec gaps were handled in the build (dry powder labelled as fund size, company capital as a lower bound, outreach tiers named apart from research tiers, a ninth cluster hue), except the founder outcome score, which is still undefined and not shown.

## Next steps toward real-time data

- **The seam is `src/lib/data/`.** Every view and every `/api` route reads data only through these async loaders, so the app does not care where the data comes from. Today they read `data/processed/*.json` files bundled with the build.
- **Put an API behind the loaders.** Replace the file reads with calls to a small service or database holding the same Zod-validated records. Keep validating at that boundary with the schemas in `src/lib/schema`. The loaders already cache with `"use cache"` and revalidate on Next's default profile (15 minutes for the `/api` routes, per the build output), so new data would then appear without a rebuild.
- **Refresh incrementally.** Today `pnpm pipeline` rebuilds everything from the raw files. A real-time path would update one entity at a time (a new round, a fund close) and recompute only what depends on it: that investor's fit features, the graph edges it touches and the totals. Cache tags per dataset would let a write invalidate just the loaders it affects.
- **Schedule the pipeline.** Until then, run the pipeline on a schedule (for example a nightly CI job) that validates the data, runs the tests and pushes a commit, so the protected deployment rebuilds itself from fresh data.
- **Keep the provenance rules.** Every new fact still needs a source URL and `retrieved_at`, and unknown stays null. The consistency tests should run against the live source before each refresh is accepted.
