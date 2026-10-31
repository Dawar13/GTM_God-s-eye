# Capital Atlas — Project Context

Working name: **Capital Atlas** (rename freely). Owner: Utopian Autonomy, finance & fundraising function.
One line: *Palantir for our fundraise* — an internal, data-dense, interactive dashboard that maps venture capital (who has money, what they back, who they co-invest with), teaches and computes VC math, benchmarks our competitors, and ranks which investors we should raise from.

This file is the source of truth. Read it fully before any phase. When reality changes, update this file and log the change in `docs/DECISIONS.md`.

---

## 1. The company this serves

Facts only. Do not embellish.

| Item | Value |
|---|---|
| Company | Utopian Autonomy — industrial / manufacturing AI |
| Entities | Delaware C-Corp (US customers, US investors) and Utopian Autonomy Pvt Ltd (India customers, Indian investors). Sister companies, **no** parent–subsidiary link |
| Product direction | Platform of AI agents specialised per factory function (procurement, maintenance, process stability, RFQ / BOM / engineering drawings) that plant staff use through WhatsApp |
| Adjacent work | Requirements / design-intent tooling for hardware teams (Tandem / Flow Engineering style); EV client relationship (Ather Energy) |
| Vision | Dark factories. Path: wedge workflow → factory OS → autonomous factory. Prefers "shovels" (tools for physical AI) over building end machines |
| GTM | Sell in India now (Mumbai, Navi Mumbai, Pune, Bangalore mid-size manufacturers); US sales after ~1 year; later sensors/cameras, then robotics |
| Raise plan | Pre-seed in ~2–3 months (from Oct 2026); move to the US in ~4–5 months to raise seed. **Main target market and investor pool: US / Western** |
| Traction | No paid deal closed yet (Oct 2026) |
| Raise size | **Unknown — user input in the app.** Never hard-code. Placeholder default: $1.0M pre-seed, labelled "assumption" |

Implication the Strategy tab must surface (as an open question, not advice): US institutional investors usually expect a Delaware parent that owns the Indian operating company (an "India flip"). The current sister-company setup may limit what a US investor actually owns. Research and present the trade-off; do not decide.

---

## 2. Information architecture

Left rail = top-level tabs. Each view = **canvas + inspector** (main visual on the left, detail drawer on the right that opens on click). Global filter bar on top: region, stage, investor type, fund vintage, sector.

### Tab 1 — Command (overview)
Headline numbers computed from data, never typed in: investors tracked, Western vs India split, fresh-capital funds count and total dry powder, deals mapped, competitors tracked, top 10 fit-scored investors. Small multiples, not prose.

### Tab 2 — VC Math (interactive lab)
Each sub-tab = one calculator with sliders + live chart + "show the formula" toggle + one worked example preloaded.

| Sub-tab | Inputs | Output visual |
|---|---|---|
| Round builder | pre-money or post-money, new money | ownership bars, price per share |
| Cap table simulator | founders, pool, rounds 1..n (each: amount, valuation, pool top-up) | stacked area of ownership over rounds; founder % at exit |
| Option pool shuffle | target post-money pool %, pre-money | headline vs effective pre-money |
| SAFE (post-money & pre-money) | amounts, caps, discount, MFN, next priced round | conversion table, dilution waterfall, side-by-side pre vs post SAFE |
| Convertible note | principal, interest (simple/compound), term, cap, discount, conversion date | accrued value curve, conversion shares |
| Liquidation waterfall | prefs (1x/2x), participating / non-participating / capped, seniority vs pari passu, exit value | payout-by-class chart across exit values (the classic "who gets what" curve) |
| VC method | target exit value, target multiple, expected dilution | implied post / pre-money |
| Fund math | fund size, ownership at entry, follow-on dilution, exit value | "does this company return the fund?" gauge; why a $50M fund and a $1B fund want different outcomes |
| Power law sim | portfolio size, outcome distribution | Monte Carlo histogram of fund multiples |
| India instruments | CCPS / CCD / iSAFE basics, FEMA fair-value pricing floor for non-resident investment | explainer + check (Phase 1 must verify current rules, including angel-tax status) |

Gamified layer (Phase 2): scenario mode (build a 3-round path, see founder outcome score), "guess the number" challenges with streaks, shareable scenario links via URL hash.

### Tab 3 — Investors
| Sub-tab | What it is |
|---|---|
| Directory | Sortable, filterable table. Category chips: Western/India/Other × Fresh/Older fund × Debut/Emerging/Established × stage × type |
| Thesis map | 2D scatter of investors by thesis vector (UMAP or PCA) with k-means clusters. Generalists drawn as hollow rings. Toggle to **Fit view**: x = industrial/physical-AI affinity, y = stage earliness |
| Capital bubbles | 3D bubble: x = typical check (log), y = stage earliness, z = industrial/physical-AI affinity, size = latest fund size (or AUM), colour = cluster. Hover = card, click = inspector |
| Network | Bipartite graph: investors (coloured) ↔ portfolio companies (grey shades). Edge = participated in a round. Lead edges solid, participant edges thinner. Modes: full graph, ego network on click, VC↔VC co-investment projection (edge weight = shared deals), competitor highlight |
| Profile (inspector) | Thesis, stage, check range, fund history (vintage, size), notable portfolio, co-investors, competitor exposure, fit score breakdown, sources |

Western investors are the default filter; India is a toggle, not hidden.

### Tab 4 — Competitors
Table + charts: founded vs total raised (scatter, log y), funding timeline per company, investor overlap matrix (which investors back multiple competitors), layer map (where each sits: design intent / process planning / plant ops / quality vision / autonomy tooling / robotics / full-stack factory). Category: direct / adjacent / remote. Size class.

### Tab 5 — Raise Strategy
Data-driven, minimal prose.
- Fit score ranking (formula in §4) with user-adjustable weights (sliders).
- Tiered target list (Tier A: reach out first, B, C) with reasons as chips, not paragraphs.
- Investors who backed our competitors: split into "signal of thesis interest" vs "likely conflict" (backed a direct competitor at a recent stage).
- Benchmarks: median pre-seed / seed round size, valuation, dilution from published datasets (Carta, PitchBook-NVCA, etc. — Phase 1 research), shown against our planned raise.
- Open structural questions (India flip, which entity raises).

---

## 3. Data model

All app data lives in `data/processed/*.json`, validated by Zod schemas in `src/lib/schema/`. Every record carries provenance.

### Entities
- **Investor**: id, name, aliases, type (`vc | cvc | angel | syndicate | family_office | sovereign | asset_manager | accelerator | strategic | individual`), region (`western | india | other`), hq_country, hq_city, stages (array), check_min_usd, check_max_usd, leads (bool|null), thesis_text (short, paraphrased), sector_weights (map over taxonomy, sums to 1), website, linkedin, funds (array of Fund ids), sources, confidence.
- **Fund**: id, investor_id, name, number (I, II…), size_usd, currency_original, size_original, close_date, vintage_year, location, sources.
- **Company**: id, name, hq_country, founded_year, sector (taxonomy), description_short, total_raised_usd, is_competitor (bool), sources.
- **Round**: id, company_id, date, stage (`pre_seed | seed | series_a | series_b | series_c_plus | growth | strategic | undisclosed`), amount_usd, valuation_post_usd (nullable), lead_investor_ids, participant_investor_ids, sources.
- **Competitor** (extends Company): category (`direct | adjacent | remote`), layer, size_class, headcount_est (nullable, with source), revenue_usd (nullable, **only if publicly reported**), revenue_basis (`reported | none`), product_summary, pricing (nullable).
- **Source**: url, title, publisher, retrieved_at (ISO date), kind (`primary | secondary | user_supplied`).

### Sector taxonomy (fixed; change only via DECISIONS.md)
`ai_infra, ai_apps_agents, industrial_manufacturing, robotics_physical_ai, defense_dual_use, hardware_deeptech, space, climate_energy, mobility_ev, supply_chain_logistics, enterprise_saas, dev_tools, fintech, health_bio, consumer, crypto_web3`

### Categorisation rules (deterministic, computed in pipeline)
- **Region**: western = US, Canada, UK, EU, Switzerland, Nordics, Israel, Australia/NZ. india = India HQ or India-dedicated fund. other = everything else (China, Japan, Korea, Middle East, SEA, LatAm).
- **Fund freshness**: `fresh` if latest fund closed on/after 2024-10-29 (≤24 months before 2026-10-29); `older` otherwise; `unknown` if no fund data. Make the cutoff a config value.
- **Manager maturity**: `debut` = latest fund is Fund I; `emerging` = Fund II–III; `established` = Fund IV+ or firm ≥10 years old.
- **Early-stage**: stages include pre_seed, seed or series_a.
- **Generalist (agnostic)**: normalised Shannon entropy of sector_weights ≥ 0.85, or thesis explicitly says sector-agnostic. Stored as a flag, not a cluster.

---

## 4. Analytics definitions

- **Thesis vector** = sector_weights. Derived from (a) stated thesis on the firm's own site, (b) share of known portfolio by sector. Default blend 0.5 / 0.5; record which inputs existed.
- **Clustering**: k-means on thesis vectors (k chosen by silhouette score, k in 4–10), excluding generalists from fitting, then assign generalists to nearest cluster for colour only. 2D layout via UMAP (fallback PCA). Store coordinates in `data/processed/layout.json` so the app doesn't compute at runtime.
- **Industrial affinity** = weight on industrial_manufacturing + robotics_physical_ai + 0.5 × (hardware_deeptech + supply_chain_logistics + mobility_ev). Clamp 0–1.
- **Stage earliness** = mean of stage scores (pre_seed 1.0, seed 0.8, series_a 0.6, series_b 0.4, series_c_plus 0.2, growth 0.1).
- **Fit score (0–100)**, weights user-adjustable, defaults:
  - thesis fit 30 (industrial affinity, + AI weight)
  - stage fit 20 (earliness vs our stage)
  - check fit 15 (does our round size fall inside their check range; leads preferred)
  - portfolio adjacency 15 (backed companies in our layer or neighbouring layers)
  - geography / structure 10 (US-focused or invests in Indian founders / cross-border)
  - dry powder 10 (fresh fund, fund size appropriate for our stage)
  - Flags (not scored): conflict (backed a direct competitor in last 24 months), unknown data share > 40%.
- **Graph**: nodes = investors + companies; edges from rounds. Compute degree, weighted degree, betweenness (for "connector" investors), and VC↔VC co-investment counts in the pipeline (networkx) and export.

---

## 5. Data integrity — non-negotiable

1. **No fact without a source URL.** If you can't find it, the field is `null` and the UI shows "—". Never fill from memory.
2. Prefer primary sources: firm website, fund announcements, SEC Form D, company press releases, regulator filings. Secondary (TechCrunch, Axios, Fortune, Crunchbase public pages, LinkedIn posts) allowed; amounts from a single secondary source get `confidence: medium`.
3. User-supplied lists (the infographics and the PDF in `data/raw/sources/`) are `kind: user_supplied`. They are leads to verify, not facts. Logo-read names may be misspelled.
4. No estimated revenue. Revenue only when publicly reported. Headcount estimates allowed only with a source (e.g. LinkedIn company page) and labelled.
5. Dates: record `retrieved_at` on every source. Data after Jun 2026 is outside Claude's training — always verify by web.
6. Conflicts between sources: keep both in `sources`, pick the primary one, note it in `data/RESEARCH_LOG.md`.
7. The UI must show provenance: source icon on every number in the inspector, a "data confidence" meter per investor.

---

## 6. Source inventory (provided by the user)

Put originals in `data/raw/sources/`. Transcribed seeds are in `data/seed/`.

| source_id | What | Use |
|---|---|---|
| goldman_sub200m_funds | Shai Goldman (Brex) list of ~971 VC funds ≤$200M, 2011–2026, with size, date, fund number, location, link | Parse fully → Fund + Investor records. Best source for vintage & emerging managers |
| freesbee_q3_2026_fund_closes | Treemap: who raised $19.9B in Q3 2026 (103 funds; 22 debut, $774M) + stats text | Fresh-capital funds |
| freesbee_ai_megaseeds_2026 | 30 AI mega-seed rounds 2026, leads + strategic co-investors | Rounds + edges |
| startupriders_robotics_20m_plus_2026 | Top 20 of 40 robotics rounds ≥$20M in 2026 with investors | Rounds + edges (high relevance) |
| multiples_frontier_lab_investors_2026-10-28 | Top 10 investors per frontier AI lab | Late-stage / strategic context |
| 4dev_us_robotics_map | 190+ US robot makers, most funded, top investors (SoftBank, Alumni Ventures, NVIDIA, In-Q-Tel, a16z) | Robotics investor signal |
| li_sheetventure_30_funds | 30 early-stage funds with check size and focus | Directory seeds |
| cremades_ai_relevant_investors | 15 AI-relevant investors incl. family offices (Premji Invest: physical AI; Pritzker: industrial tech; Bezos Expeditions: robotics) | Directory seeds |
| li_20_b2b_ai_funds_2026 | 20 US/UK/EU funds that raised in 2026 and write pre-seed/seed B2B AI checks | High-priority seeds |
| one_way_summit_sf_2026_list2 | 24 early-stage VCs at One Way Summit SF (Oct 28–29) incl. Supply Change Capital (physical AI), Mavka (embodied AI), Riceberg, OneSixOne (deep tech) | Seeds; list 1 of 2 missing |
| ny_venture_summit_2026_30_firms | 30 early-stage firms, NY Venture Summit Nov 18–19 2026 | Seeds + event to attend |
| li_ajvc_post | ajvc (India): ₹1.5 Cr for 9% pre-seed, AI/defence/consumer | India seed |
| Industrial_AI_Target_List*.xlsx | **Customer** target lists (Mumbai/Pune, Bangalore). Not investors | Not used for VC data; optional for "portfolio adjacency" later |
| incoming spreadsheets | Two more investor spreadsheets to come | Drop in `data/raw/incoming/`; ingest in Phase 1 |

---

## 7. Competitor universe (seed — verify every row in Phase 1)

From prior research in this project. Category is a starting guess.

| Company | Category | Layer | Why it's here |
|---|---|---|---|
| Tandem (Tandem Intelligence, SF) | direct | design intent | Context layer + agents for hardware engineering; backed by Foundation Capital, Also Capital, Antler, Genius Ventures + angels |
| Flow Engineering | direct | design intent / requirements | Requirements & traceability for hardware; $50M Series B at $750M (Valor, Atreides); $150–300/editor/month |
| Arda | direct | process planning | Bob McGrew (ex-OpenAI) & Augustus Odena; design → manufacturing software |
| Faclon Labs (Mumbai) | direct (India) | plant ops / IIoT | Closest Indian plant-ops competitor |
| Matta | direct | quality vision | Vision-based defect detection, measurement, traceability |
| Qualitas Technologies | adjacent (India) | quality vision | Indian inspection competitor |
| Tractian | adjacent | maintenance / condition monitoring | Plant-ops wedge reference |
| Cognite | adjacent | industrial data platform | Incumbent data layer |
| Seeq | adjacent | process analytics | Incumbent analytics |
| SymphonyAI (Industrial) | adjacent | plant ops AI | Incumbent |
| IFS | remote | ERP / EAM | Incumbent suite |
| Apprentice.io | adjacent | manufacturing execution (pharma) | Agentic MES reference |
| Covalent, Meridian, Galvant, SalesPatriot, Parallax Worlds | adjacent (verify each) | various | Shared by user as reference companies — research what each does |
| NowPurchase (India) | adjacent | foundry procurement / process | Indian manufacturing AI reference |
| SiMa.ai | remote | edge AI chips | Edge hardware layer |
| Applied Intuition | remote (role model) | autonomy tooling | The "shovels" model the founder admires |
| Hadrian | remote | full-stack automated factories | Full-stack operator benchmark |
| Machina Labs | remote | robotic sheet-metal forming | Robotics factory benchmark |
| Atoms, Project Prometheus | remote | physical AI mega-companies | Capital concentration context |

---

## 8. Tech stack and architecture

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript strict, pnpm | Static export now, server routes later for real-time |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives), CSS variables for tokens | Fast, accessible primitives; we own the look |
| State | Zustand (global filters, selection), URL search params for shareable views | |
| Tables | TanStack Table | Large sortable, virtualised tables |
| 2D charts | Recharts for standard charts; D3 for custom (waterfall, payout curves) | |
| 3D bubble | Plotly (`react-plotly.js` + `plotly.js-dist-min`), dynamic import, client-only | Reliable 3D hover/click |
| Network | Sigma.js + graphology (`@react-sigma/core`), ForceAtlas2 layout precomputed in pipeline | WebGL, handles thousands of nodes cleanly |
| Motion | Framer Motion — only for responses to user action | |
| Validation | Zod schemas; `pnpm validate:data` fails the build on bad data | |
| Math | Pure TS functions in `src/lib/finance/`, 100% unit-tested with Vitest | Calculators must be exact |
| Pipeline | Python 3.11+ managed by `uv`: pdfplumber, pandas, scikit-learn, umap-learn, networkx, httpx | Ingest, enrich, cluster, graph, export JSON |
| Deploy | Vercel with Deployment Protection (internal data) | Later: Postgres (e.g. Supabase/Neon) behind `src/lib/data/` |

Real-time later: all reads go through `src/lib/data/*` loaders. Today they import JSON; later they call an API. No component imports JSON directly.

---

## 9. Design direction

Audience: founders and finance team making decisions under time pressure. Job: find the right investor and understand the math fast. Feel: a calm, bright analyst's workspace, not a marketing site. Light surfaces, generous whitespace, colour reserved for data. Full spec in `docs/PHASE_2.md` §1 and §2; this section is the summary.

- **Signature**: every view is a canvas + inspector. The network canvas is the one bold element; everything around it stays quiet.
- **Theme**: light first (default). Dark is optional, under `[data-theme="dark"]`, and any wrapper element can carry `data-theme` to re-theme its subtree.
- **Colour tokens** (`src/styles/tokens.css`, light / dark): canvas `#F6F7F9` / `#16181D`, panel `#FFFFFF` / `#1D2026`, panel-sunk `#F0F2F5` / `#191C21`, rule `#E3E6EB` / `#2C3038`, ink `#1A1F29` / `#E6E8EB`, ink-2 `#4A5160` / `#B4BAC4`, muted `#676C74` / `#8E959F`, accent `#4F5BD5` / `#8B94F0`, accent-soft `#EEF0FB` / `#262A45`, positive `#257B57` / `#2F9E6F`, negative `#B94151` / `#DC7381` (up/down only, never decoration). Muted, positive and negative were darkened (lightened in dark) in S10a so text in them passes AA on every surface.
- **Data colour**: categorical Tableau 10 subset `#4E79A7 #F28E2B #59A14F #E15759 #76B7B2 #EDC948 #B07AA1 #9C755F`, fills at 85% opacity with a 1px stroke of the same hue darkened 15%. Companies: greys `#C4C9D1 → #8A919C` (darker = more capital raised); competitors add a 2px accent ring. Sequential (heatmaps): `#EEF0FB → #4F5BD5`, never rainbow.
- **Type**: IBM Plex Sans (UI), IBM Plex Sans Condensed (tables, axes, dense labels). Scale 12 / 13 / 14 / 16 / 20 / 28, body 14/20. `tabular-nums` on all numbers. Sentence case. No all-caps labels, no monospace for data, no "→" on buttons.
- **Shape and depth**: 4px spacing base. Radius by role: inputs and chips 6px, panels 10px, drawer square on its attached edge. Borders first; one shadow token (`--shadow-float`) for floating things only (menus, palette, tooltips).
- **Motion**: 160ms ease-out for open/close, 220ms for list reorders. Only in response to user actions; no entrance animations; `prefers-reduced-motion` falls back to instant.
- **Layout**: left rail, top bar with filters, main canvas, right inspector (resizable). Panels differ by role, not one card style everywhere.
- **Numbers**: `$1.2M`, `$740M`, `$1.75B`, `₹1.5 Cr`; percentages to 1 dp; dates `Mar 2026`; always show units. All via `src/lib/format`.
- **Charts**: the accuracy contract in `docs/PHASE_2.md` §2 applies to every visual. Primitives live in `src/components/ui-atlas/`, palette and scales in `src/lib/viz/`, and `/lab` shows them in both themes.
- **Quality floor**: responsive to tablet (graphs) and mobile (tables, calculators), keyboard focus visible, `prefers-reduced-motion` respected, WCAG AA contrast.
- Copy: plain verbs, short. Empty states say what to do next.

---

## 10. Phases

| Phase | Goal | Exit criteria |
|---|---|---|
| **0 — Foundation** | Repo, stack, tooling, schemas, design tokens, app shell with all tabs as empty states, seed ingestion, Goldman PDF parsed | `pnpm dev` shows shell with 5 tabs; `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm validate:data` pass; `data/processed/funds.json` has the parsed PDF; seeds normalised |
| **1 — Research, data & engines** | Deep web research into investors, portfolios, rounds, competitors, benchmarks; pipeline computes categories, thesis vectors, clusters, layouts, graph metrics, fit scores; finance math engine built and tested | Tier A ≥ 60 Western early-stage investors fully profiled with ≥ 8 sourced portfolio rounds each; Tier B ≥ 200 shallow profiles; all competitors profiled; every number has a source; finance functions pass worked-example tests; `RESEARCH_LOG.md` complete |
| **2 — Interface & polish** | Build every view, calculator, chart and graph; gamified layer; inspector; responsive; performance; deploy | All tabs functional on real data; Lighthouse perf ≥ 85 on Directory; graph interactive at 60fps with full dataset; accessibility checks pass; protected Vercel deploy |

Phase 1 and Phase 2 instruction files are written at the end of the previous phase, using what was learned.

---

## 11. Open questions (track answers in DECISIONS.md)

1. Target raise size and instrument for pre-seed (post-money SAFE assumed default for US).
2. Which entity raises: Delaware C-Corp only, or flip India under it?
3. Is the company leaning to design-intent tooling or plant-ops agents for the pitch? Changes fit weights.
4. Who on the team uses this, and is any of it shared outside (e.g. with advisors)?
5. Contents of the two incoming investor spreadsheets.
