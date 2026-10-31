# Phase 2 (final) — Interface, visualisation and polish

The third and last phase. Read `docs/PROJECT_CONTEXT.md` §2 and §9, `docs/PHASE_1_REPORT.md`, and `docs/COVERAGE.md`. **No web research in this phase.** Data is frozen; if data is wrong, log it in `docs/DATA_ISSUES.md` and keep building.

This phase **replaces the dark-first direction in PROJECT_CONTEXT §9 with a light-first theme**. In session S0, update §9 to match this file and log the change in DECISIONS.md.

---

## 0. Token budget rules (read every session)

1. **Never open files in `data/processed/`.** Inspect data with `jq` (`jq '.records | length'`, `jq '.records[0]'`) or the loaders. Never `cat` JSON.
2. **One session = one row of the session plan (§3).** At the end: run checks, commit, tick the box in this file, then `/clear`.
3. **Shared parts before views.** S0 builds the primitives; later sessions only compose them. Don't create new one-off chart wrappers.
4. **Edit, don't rewrite.** Change files in place. Don't regenerate a whole component to change a colour.
5. **Screenshots: at most two per session** (one after build, one after fixes). Use Playwright at 1440×900, plus one mobile 390×844 only in S1 and S10.
6. **Models**: Sonnet for S0–S5, S8–S9; Opus for S6 and S7 (3D and the network graph) and for S10 if performance work gets hard.
7. **Plan mode first** for each session: list files to touch, then build. If the plan touches more than ~12 files, split the session.

---

## 1. Visual system (light-first)

Feel: a calm, bright analyst's workspace. Light surfaces, generous whitespace, colour reserved for data. Quiet chrome, vivid but soft data marks. The signature element is the network canvas; everything else stays restrained.

### 1.1 Colour tokens (`src/styles/tokens.css`)
| Token | Light (default) | Dark (optional) | Use |
|---|---|---|---|
| `--canvas` | `#F6F7F9` | `#16181D` | app background |
| `--panel` | `#FFFFFF` | `#1D2026` | panels, drawer, menus |
| `--panel-sunk` | `#F0F2F5` | `#191C21` | table header, input wells |
| `--rule` | `#E3E6EB` | `#2C3038` | borders, gridlines |
| `--ink` | `#1A1F29` | `#E6E8EB` | primary text |
| `--ink-2` | `#4A5160` | `#B4BAC4` | secondary text |
| `--muted` | `#8A919C` | `#8A919C` | axis labels, hints |
| `--accent` | `#4F5BD5` | `#8B94F0` | selection, focus, active nav |
| `--accent-soft` | `#EEF0FB` | `#262A45` | active nav bg, selected rows |
| `--positive` / `--negative` | `#2F9E6F` / `#D1495B` | same | up/down only, never decoration |

Data palette (categorical, Tableau 10, colour-blind-checked with Coblis or Viz Palette): `#4E79A7 #F28E2B #59A14F #E15759 #76B7B2 #EDC948 #B07AA1 #9C755F`. On light backgrounds use fills at 85% opacity with a 1px stroke of the same hue darkened 15%.
Companies: greys `#C4C9D1 → #8A919C` (darker = more capital raised). Competitors: grey fill + 2px `--accent` ring.
Sequential (heatmaps): single-hue `#EEF0FB → #4F5BD5`. Never rainbow.

### 1.2 Type
IBM Plex Sans (UI) and IBM Plex Sans Condensed (tables, axes, dense labels). Scale: 12 / 13 / 14 / 16 / 20 / 28. Body 14/20. Numbers always `tabular-nums`. Sentence case everywhere. No all-caps labels, no monospace for data, no arrows appended to buttons.

### 1.3 Shape, depth, spacing, motion
- Spacing: 4px base (4, 8, 12, 16, 24, 32, 48).
- Radius by role, not uniform: inputs/chips 6px, panels 10px, drawer 0 on its attached edge.
- Depth: borders first. One shadow token for floating things only (menus, palette, tooltips): `0 8px 24px rgba(26,31,41,.08)`.
- Motion: 160ms ease-out for open/close, 220ms for list reorders (Framer `layout`). Only respond to user actions; no entrance animations on page load. Respect `prefers-reduced-motion` (fall back to instant).

---

## 2. Chart accuracy contract (applies to every visual)

1. **Data flows through tested transforms.** Each chart has a pure `toSeries()` (or `toNodes()`) in `src/lib/viz/transforms/` with a Vitest test. Components never reshape data inline.
2. Bars start at zero. Log axes say "log scale" in the axis title. No dual y-axes. No 3D except the capital bubble view.
3. Bubble size is **area**-proportional (radius = √value). State the size encoding in the legend.
4. Nulls are never plotted as zero. Every chart footer shows "N not shown (missing <field>)".
5. Every tooltip shows: exact value with units, date or period, confidence, and source domain. Clicking a mark opens the Inspector.
6. Totals shown on a chart must equal the same totals in the Directory for the same filters. Add one `tests/viz-consistency.test.ts` that checks this for counts and dollar totals.
7. Money: `$1.2M`, `$740M`, `$1.75B`, `₹1.5 Cr`. Percent: 1 decimal. Dates: `Mar 2026`. All via `src/lib/format`.
8. Every chart sits in `ChartFrame`: title (what it shows), one-line subtitle (how to read it), legend, footnote (sources + not-shown count), and loading / empty / error states.

---

## 3. Session plan

Tick each box when its checks pass.

### S0 — Design system and primitives ☑
- Update tokens to §1, light default, dark via `[data-theme="dark"]`. Update PROJECT_CONTEXT §9 + DECISIONS.md.
- Primitives in `src/components/ui-atlas/`: `Panel`, `Stat` (value, unit, delta, source dot), `Chip` (filter chip with count), `Metric` (formatted number), `ChartFrame`, `VizTooltip`, `Legend` (categorical, size, sequential), `InspectorSection`, `EmptyState`, `Skeleton`, `SourceBadge` (domain + confidence dot), `Segmented` (view toggles).
- `src/lib/viz/`: palette helpers, scales (linear, log, sqrt for size), axis formatters.
- Internal style-guide route `/lab` showing every primitive in both themes.
- Checks: lint, typecheck, test; one screenshot of `/lab`.

### S1 — Shell, menu and navigation ☑
- **Left menu (rail)**, 232px, collapsible to 64px icons (persisted):
  - Command
  - VC Math → Round builder, Cap table, Option pool, SAFE, Convertible note, Liquidation, VC method, Fund math, Power law, India
  - Investors → Directory, Thesis map, Capital, Network
  - Competitors
  - Strategy
  - Sub-items expand under the active section only; active item = `--accent-soft` background + 2px accent bar on the left. Keyboard: ↑/↓ moves, → expands.
- **Top bar**: page title + sub-tab segmented control, global search button (`⌘K`), filter summary ("Western · Seed–A · Fresh funds · 3 more"), theme toggle.
- **Command palette** (`cmdk`): jump to any page, search investors / companies / competitors by name, run actions ("Open SAFE calculator", "Show investors who backed Tandem").
- **Filter bar** (collapsible row under top bar): region, stage, investor type (VC, CVC, accelerator, incubator, family office, angel, sovereign, strategic), freshness, maturity, sector, tier. Chips show counts. Filters live in the URL (use `nuqs`) so every view is shareable.
- **Inspector**: right drawer, 420px, resizable 360–640, opens on any entity click, Esc closes, back/forward history inside the drawer.
- Responsive: <1024px rail becomes a top hamburger sheet; inspector becomes a bottom sheet.
- Shortcuts: `⌘K` palette, `/` focus search, `[` toggle rail, `F` filters, `Esc` close.
- Checks: keyboard-only walkthrough of all routes; screenshots desktop + mobile.

### S2 — Command (overview) ☑
- Stat strip: investors tracked, Western share, fresh funds, total fresh dry powder, deals mapped, competitors.
- Small multiples (2×2): funds closed by year (bar, stacked fresh/older), fresh capital by region (bar), top 10 by fit score (ranked bar with feature-contribution segments), recent deals in our layers (dot timeline).
- Every tile links to the full view with matching filters.

### S3 — VC Math I: Round builder, Cap table, Option pool, SAFE ☑
Common layout: inputs panel left (sliders + number fields kept in sync, ⓘ hints), visual centre, "How this is calculated" collapsible with the formula and the worked example, "Reset to example" button. All math from `src/lib/finance` only.
- Round builder: pre ↔ post toggle; ownership donut is not allowed — use a horizontal 100% bar; price per share as a big `Stat`.
- Cap table: add / remove rounds (SAFE, note, priced, pool top-up) as a step list; **step chart** of ownership by class across rounds; table under it; founder % at each step highlighted.
- Option pool: side-by-side bars "headline pre-money" vs "effective pre-money"; the gap labelled in dollars.
- SAFE: post-money vs pre-money tabs plus "compare both" view; conversion table; dilution waterfall bar.

### S4 — VC Math II + game layer ☑
- Convertible note: accrued value line over time, conversion marker at the round date; cap vs discount price comparison.
- Liquidation: payout curve per class across exit values (x log toggle); breakpoints as dashed verticals with labels ("investor converts above $20M").
- VC method and Fund math: required-exit gauge ("$781M exit returns the fund"), and a fund-size slider showing why a $50M and a $1B fund want different outcomes.
- Power law: histogram of fund multiples with median and p90 markers. Monte Carlo runs in a Web Worker; seeded; shows trial count.
- India: `LegalNote` cards with sources and "not legal advice" line.
- **Game layer** (tasteful, opt-in toggle "Practice"):
  - Scenario mode: build a 3-round path to exit; outcome card shows founder % and payout at three exit values; save up to 5 scenarios locally and compare them in a small table.
  - Challenges: "Guess the post-money ownership" style prompts generated from the finance engine; answer within ±1 point to score; streak counter in `localStorage`.
  - Shareable scenario via URL.

### S5 — Investors: Directory + Inspector profile ☑
- TanStack table, virtualised (`@tanstack/react-virtual`), sticky header, column chooser, density toggle, CSV export of the current view.
- Default columns: name, type, region, stages, check range, latest fund (size, year), freshness chip, tier, fit score (mini bar), sources count.
- Inspector profile: header (name, type, HQ, website), fit score breakdown (horizontal stacked bar + flags), thesis (paraphrased), sector-weight bars, funds timeline, partners, portfolio list (sortable), co-investors (top 10), competitor exposure, sources list with confidence.
- Accelerators and incubators get their own filter chips and a distinct marker shape in later charts.

### S6 — Thesis map + Capital bubbles (use Opus) ☑
- **Thesis map** (D3 + SVG, or canvas if > 2,000 points): positions from `layout_thesis.json`; colour = cluster; generalists = hollow rings; cluster hulls as 8%-opacity fills with the cluster name at the centroid; zoom/pan; labels only for top 30 by fit plus hovered/selected.
  - Toggle **Fit view**: x = industrial affinity, y = stage earliness, light quadrant guides, labelled corner "Sweet spot".
  - Hover = tooltip; click = Inspector; brushing a region filters the Directory.
- **Capital bubbles** (Plotly `scatter3d`, dynamic import, client-only): x = typical check (log), y = stage earliness, z = industrial affinity, size = latest fund size (area), colour = cluster. Camera presets (front, top, side), reset, and **"Show as 2D"** toggle with three linked 2D projections, because 3D distorts perceived position. Hover card matches `VizTooltip`; click opens Inspector.

### S7 — Network graph (use Opus) ☐
Sigma.js with precomputed ForceAtlas2 positions from `graph.json`.
- Nodes: investors coloured by cluster (or by type via toggle), size = √weighted degree; companies grey by capital raised; competitors grey + accent ring; accelerators/incubators drawn with a square marker.
- Edges: participation; lead edges darker; alpha 0.15 default; hidden while panning/zooming for smoothness.
- Hover: highlight the node and its neighbours, fade everything else to 10%. Click: Inspector + lock highlight.
- Modes (segmented): Full graph · Ego network (1–2 hops from selection) · Co-investors (VC↔VC, edge weight = shared deals) · Competitor lens (only competitors, their investors, and those investors' other deals).
- Controls: search-to-focus (camera animates to node), date range slider for rounds, stage filter, label density slider, legend, fullscreen.
- Performance target: 60fps pan/zoom on the full dataset on a mid-range laptop. Use node reducers, not re-creating the graph on filter change.

### S8 — Competitors ☐
- Table: name, category, layer, founded, HQ, total raised, last round (date, amount, lead), headcount (approx.), revenue (reported only, else "—"), investors.
- Charts: founded year vs total raised (scatter, log y, size = headcount when known); funding timeline (dot per round, size = amount, row per company); investor × competitor overlap heatmap (sequential palette, rows sorted by cluster); layer map (horizontal bands: design intent → process planning → plant ops → quality vision → autonomy tooling → robotics → full-stack factory) with companies placed in their band.

### S9 — Strategy ☐
- Weight sliders for the six fit features (normalised to 100, live). Ranked list reorders with a 220ms layout animation; each row shows a stacked contribution bar, flags (conflict, sparse data), fresh-fund chip.
- Tier columns A / B / C with counts; drag to override a tier (stored locally, marked "manual").
- Our raise vs benchmarks: strip plot of median pre-seed and seed round sizes / valuations with our planned raise as a marker; raise size input here feeds the check-fit feature.
- Competitor investors split into "thesis signal" vs "likely conflict".
- Open structural questions panel (India flip etc.) linking to the legal notes.
- Export: target list CSV with fit breakdown and application URLs.

### S10 — Polish, performance, accessibility, deploy ☐
- Performance: dynamic import Plotly and Sigma; route-level code split; Lighthouse ≥ 90 performance on Command and Directory, ≥ 85 on Network; no layout shift on load.
- Accessibility: AA contrast in both themes; every chart has an accessible table alternative ("View as table" toggle in `ChartFrame`); focus visible; screen-reader labels on icon buttons.
- Consistency sweep: copy is sentence case and plain; every empty state says what to do; units everywhere; same formatting across views.
- Run the chart consistency test and the full suite.
- Deploy to Vercel with Deployment Protection; write `docs/RUNBOOK.md` (how to update data: run pipeline → validate → redeploy).
- Final screenshots (desktop + mobile) of each top-level tab into `docs/screens/`.

---

## 4. Dependencies to add (only these)

`cmdk`, `nuqs`, `@tanstack/react-virtual`, `@playwright/test` (dev). Everything else was installed in Phase 0. Log versions in DECISIONS.md.

## 5. Exit criteria

- [ ] S0–S10 ticked
- [ ] All tests pass, including the viz transform and consistency tests
- [ ] Every chart has a source footnote, a not-shown count and a table alternative
- [ ] Light and dark themes both pass AA
- [ ] Protected deployment live; RUNBOOK written
- [ ] `docs/PHASE_2_REPORT.md`: what shipped, known data gaps, and next steps toward real-time data (API behind `src/lib/data/`)
