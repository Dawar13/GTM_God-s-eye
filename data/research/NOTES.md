## Notes

### 2026-10-30 — Pilot (PHASE_1 §3): five investors end to end

| Investor | Pick | Time | Fetches | Pages cited | Rounds | Funds | Partners |
|---|---|---|---|---|---|---|---|
| Supply Change Capital | industrial / physical-AI seed hint | ~38 min | ~50 | 23 | 12 | 2 | 3 |
| Mavka Ventures | industrial / physical-AI seed hint | ~25 min | ~28 | 11 | 0 | 0 | 2 |
| Haystack | generalist seed fund | ~40 min | ~50 | 36 | 10 | 8 | 3 |
| Seven Stars | debut fund | ~25 min | ~55 | 26 | 10 | 2 | — |
| ajvc | India fund | ~35 min | ~55 | 45 | 16 | 1 | 1 |

About 32 minutes and 50 fetches per Tier A investor; one research agent per investor.

**Sources that worked:** the firm's own site (FAQ, thesis, portfolio, team pages), the firm's blog or Substack, SEC EDGAR Form D filings (fund vehicles, sizes, dates — the best fund source for US managers), PR Newswire, TechCrunch, Pulse 2.0, HIT Consultant; for India, Entrackr and Inc42's weekly funding tables. **Blocked or unusable:** Business Wire (403), Crunchbase (403), YourStory (403), X posts, the SEBI register query, Cloudflare-protected sites.

**Fields that were unfindable:**

- `invests_in_indian_founders`: unknown for all four Western firms (found only for ajvc). Unfindable for 4 of 5, so per §3 it moves from "required" to "record if stated" for Western Tier A. Left `unknown` otherwise.
- `requires_us_entity`: found for 2 of 5 (Supply Change Capital: US incorporation required; ajvc: no). Kept as required-if-stated.
- `application_url`: missing for 2 of 5 (Haystack, Seven Stars use email). Kept.
- Check size: missing for 2 of 5. Kept. ajvc states it in INR, which led to the new `check_range` fact (any currency, converted by the pipeline).
- Partner LinkedIn URLs: rarely linked from firm sites. Already optional.
- ≥ 8 rounds: met by 4 of 5. Mavka Ventures is still forming and names no portfolio companies, so 0 rounds; a firm like this is profiled but does not count toward the ≥ 60 Western Tier A with 8 rounds. The Western Tier A list (70) leaves a buffer for such cases.

**What the pilot corrected in the seed data:** Supply Change Capital is a food-supply-chain fund, not physical AI (its old domain is parked; the live site is supplychange.fund). Haystack's Goldman rows mislabel Fund VII as VIII and list one Fund V twice. ajvc's "28 deals a year" claim was not found anywhere (stated targets: 12–15 a year; ~90 by Feb 2028). Seven Stars now says it invests up to Series A and filed a Form D for a $65M Fund II (nothing sold yet).

**Calibration taken forward:** Tier A = one agent per investor with the brief above; Tier B = several investors per agent with the shallower field list; every file must pass `pnpm research:check` before merge.

## Batches 3–5 (2026-10-30)

**Web-search caps.** Most agents exhaust their web-search allowance after a few queries, so they now get known URLs (firm news and portfolio pages, Entrackr / Inc42 / TechCrunch articles) and spend searches only on finding round articles. Co-investor lists are thinner as a result; every recorded fact still has its page.

**Tier B yield.** After four Tier B batches, 8 of 19 profiles have 3 or more sourced rounds. The misses are mostly small funds closed in 2025–26 (TheFounderVC, Hyperstition, Park Rangers Capital, Baobab Ventures, Belief Capital), which have announced 0–2 deals; a Tier B agent now stops at about 15 tool calls per investor and records what exists. Expect well under 200 Tier B investors to reach 3 rounds even with full coverage of the 200; the coverage report counts both.

**Seed-list corrections so far.** Mind Robotics' $900M is two rounds ($500M Series A and $400M); LimX Dynamics' $400M is a six-month total (about $200M round); Pudu's investors are Longgang Financial Holding and Ya Capital, not Longping Financial; River AI's $1.1B combines seed and Series A; Elorian AI has no named lead; Merge Labs has no named lead (OpenAI wrote the largest check, Bain participated); AMI Labs' five co-leads include Bezos Expeditions, and Toyota is on no page read; Inherent's lead structure is contested.

## Competitor discovery (2026-10-30)

Candidates beyond PROJECT_CONTEXT §7, found during investor research or by discovery agents. Unverified until profiled; the page where each was seen is listed.

| Candidate | Domain | What it does (as described) | Seen at | Status |
|---|---|---|---|---|
| Didero | didero.ai | AI agents for manufacturing procurement, POs, quoting, AP | construct-capital.json | profiled: direct, plant_ops |
| Nexxa.ai | nexxa.ai | Agent platform for heavy industry (RFQ, demand planning) | construct-capital.json | profiled: adjacent |
| Forgepoint | forgepoint.ai | AI agent automating RFQ-to-quote for manufacturers | siliconangle.com (2026-10-14) | profiled: direct, process_planning |
| Maneva | maneva.ai | "AI line supervisor" on existing factory cameras | parsers.vc (2026-06-16) | profiled: adjacent, quality_vision |
| Edmund | not confirmed | Maintenance root-cause agents down to PLC level (Prague) | inforcapital.com | profiled: direct, plant_ops (HQ Ostrava) |
| Aerchain | not stated | AI-agent procurement platform (Bengaluru) | whalesbook.com | profiled: adjacent, plant_ops |
| Uptool | uptool.com | AI quoting for machine and fab shops | uptool.com | profiled: direct, process_planning |
| 1Buy.AI | 1buy.ai | AI procurement for electronics makers (Delhi); INR 32.5 Cr (Jan 2026) | india.entrepreneur.com | profiled: adjacent, plant_ops |
| IndustrialMind.ai | industrialmind.ai | Agents turning industrial knowledge into workflows | antler-india research; trysignalbase.com | profiled: direct, process_planning |
| Procol | procol.ai | Procurement and finance agents for Indian manufacturers | blume-ventures.json | profiled: direct, plant_ops |
| Noetive | not confirmed | Plant AI (Eclipse portfolio) | eclipse-ventures.json | profiled: adjacent, plant_ops |
| Vinci | not confirmed | Hardware design tooling (Eclipse portfolio) | eclipse-ventures.json | profiled: adjacent, design_intent |
| Sea12 | not confirmed | AI automation for heavy industry (Also Capital portfolio) | also-capital.json | profiled: adjacent, plant_ops |
| Spector.ai | spector.ai | Maintenance and reliability agents; INR 58 Cr (Jan 2026) | inc42.com | profiled: direct, plant_ops (HQ Santa Clara) |
| UGX.AI | ugx.ai | Shop-floor data and agents (Gurugram); $1M seed (Nov 2025) | yourstory.com | profiled: adjacent, plant_ops |
| ThirdAI Automation | thirdaiautomation.com | Root-cause copilot for chip fabs; $3M (Feb 2026) | inc42.com | profiled: adjacent, plant_ops (chip fabs) |
| FactoStack | factostack.com | Factory software with quote and PO agents | factostack.com | profiled: adjacent (no funding found) |
| Intellithink | intellithink.in | Predictive maintenance; INR 17 Cr (Apr 2026) | newskart | profiled: adjacent, plant_ops |
| Workroom Automation | not confirmed | AI planning engine; INR 6.2 Cr (Mar 2026) | Indian Chemical News | profiled: adjacent, plant_ops (onworkroom.com) |
| Magentic | not confirmed | Procurement agents for manufacturers (Sequoia portfolio) | sequoia-capital.json | profiled: direct, plant_ops (London; works over Teams and email) |

**Channel.** None of the agent-based competitors profiled delivers through WhatsApp: they work inside the ERP, email, Teams or their own web apps.

**Paraphrased snippets (review finding).** The page-fetch tool can return a summary instead of the page text, and one Tier B file (pillar-vc) recorded a paraphrase as its snippet for a round the page did not support; the round was removed. Prompts from batch 8 on require quoting only text seen verbatim and dropping a fact whose wording can't be quoted. The self-audit re-checks snippets against the live pages.

## EF portfolio additions (2026-10-31)

Eleven companies from the user's list "companies similar to Utopian Autonomy from EF's portfolio" (user-supplied source `ef_portfolio_list_2026_10_31`). Cache files hold the page-backed facts; the user's notes (EF membership, founded years, "most likely dead", "stealth", closeness) sit in each file's `identity_check` because research pages must be http(s) URLs. Research was lean: the company's own site plus one or two press or database pages.

| Company | Category | Layer | Why |
|---|---|---|---|
| Faction | direct | plant_ops | Quoting, order entry and procurement agents for distributors and manufacturers; software only, so not full_stack_factory despite the user's "full-stack" |
| Allude | direct | plant_ops | Expert video to SOPs plus a root-cause assistant for shop-floor staff (user: "seems closer") |
| Interface | adjacent | plant_ops | Planning, field-ops and compliance AI, but for energy operators (user: "close to us") |
| Phasio | adjacent | process_planning | Quoting and production software for contract manufacturers |
| Samp | adjacent | plant_ops | 3D-scan digital twin linked to P&ID and CMMS data |
| SixSense | adjacent | quality_vision | Defect classification and root cause for chip fabs; not 6sense.com |
| Syn2core | adjacent | plant_ops | Stealth; frontline AI co-pilot for automotive, holding page only |
| Lynceus | adjacent | plant_ops | Manufacturing KPI AI; product site unreachable, no first-party page read |
| Hanomi | remote | design_intent | CAD-to-drawing generation (user: "not at all close") |
| sensmore | remote | robotics | Autonomy for mining machinery |
| Converge | remote | plant_ops | Concrete sensors for construction; layer enum has no construction value |

**Status.** Lynceus: lynceus.ai refused connections twice on 2026-10-31; CB Insights shows the last round around 2023 and last news Jan 2024. Not confirmed closed. Converge: user said "most likely dead", but the site is live with news dated 2026-10-23.

**EF as investor.** Sourced by a page read: sensmore (Tech.eu), Interface (Pulse 2.0), Hanomi (EF portfolio page), Phasio (TechCrunch), Lynceus (CB Insights, database). User-supplied only: Converge, Faction (PitchBook and trade press name EF, but those pages were not readable), Allude, Samp, SixSense, Syn2core. A competitor round needs a stage, so EF is recorded only in sourced rounds; no round was invented.

**Not found.** Faction round (MDM article 403; $3.5M vs $4M unresolved); Allude and Syn2core funding; Hanomi seed date; founders for Hanomi, Faction, Allude, Syn2core; headcount for all eleven; HQ for several (see each file's open_items).

## Additions and robotics rule (2026-11-01)

Three competitors added from user pastes (`user_supplied:frinks_site_paste_2026_11_01`, `user_supplied:horizontal_site_paste_2026_11_01`, `user_supplied:machenta_seed_post_2026_11_01`); research stayed lean (the company site plus one or two other pages each).

| Company | Category | Layer | Why |
|---|---|---|---|
| Frinks AI | adjacent | quality_vision | Inspection vision for quality teams; no sourced root-cause diagnosis (Matta is direct because it adds it). Raised $5.4M pre-Series A (May 2025, Prime Venture Partners lead) per a PR release; its accuracy and savings claims are not stored. frinks.ai is script-rendered and gave no readable text. |
| Horizontal | direct | plant_ops | Multi-agent platform that executes plant operations over ERP/MES/QMS; domain horizontal-tech.com, YC page confirmed. No funding round or founders found. |
| Machenta | remote | robotics | Robot foundation model (robotics rule). $40M seed, co-led by Creandum and USV, Oct 2026 (day unresolved, 27 vs 28). |
| Forgis | direct | plant_ops | Zurich edge AI agents that configure and validate lines and predict failures (`user_supplied:forgis_site_paste_2026_11_01`); forgis.com. Pre-seed $4.5M, 2025-11 (month), led by redalpine (St. Gallen release, Nordic 9). |

**Robotics rule (user, 2026-11-01).** Companies whose core product is robots get category `remote`, with a note in `identity_check` citing `user_supplied:robotics_not_direct_2026_11_01`. Changed: Machina Labs adjacent to remote (robots are the product). Hadrian stays adjacent: it is a parts manufacturer selling Opus factory-autonomy software, and its file does not describe robots as the product. Note added only: Atoms, Parallax Worlds, sensmore (already remote). Revisit all if Utopian moves into robotics.

## Physical-AI investor list (2026-11-01)

User list of 57 investors in four groups (`data/seed/physical_ai_investors_2026-11-01.csv`, source `user_supplied:physical_ai_investor_list_2026_11_01`, retrieved 2026-11-01, low confidence). The groups are kept as `user_tags` and filterable ("Tag" in the filter bar). The user's framing (robotics sits at the intersection of physical AI, foundation models, sensing, edge computing, autonomy and advanced manufacturing) is a list note, not a fact about any firm.

**Matching.** Names go through the normal resolver (exact key, then fuzzy), not loose matching. "SOSV / SOSV HAX" is fed as SOSV; "M12 (Microsoft's venture fund)" as M12; "MISUMI Americas (the new MISUMI Ventures fund)" as MISUMI Ventures. No source was read that says HAX is SOSV's programme, so no HAX alias was added. New DO_NOT_MERGE pairs: bosch / bosch ventures, samsung / samsung ventures (the bare names are the parent companies and stay separate records), momenta ventures / moment ventures (fuzzy merge caught in the dry run). Toyota, Intel, Bain Capital and Samsung NEXT were already separate. Eclipse resolves to the existing Eclipse record (eclipse.capital, the Palo Alto hard-tech fund, researched earlier). Felicis Ventures and SOSV Investments are now displayed as Felicis and SOSV (list names win), so their ids changed; neither was in the research queue.

**New records and what was found** (lean research, 3 to 4 fetches each; cache files in `data/research/cache/`):
- Cybernetix Ventures: confirmed on cybernetix.vc; Boston; pre-seed to A; no check or fund size recorded (sources conflict on whether Fund II is closed).
- Momenta Ventures: confirmed on momenta.vc; Switzerland (one press page); thesis only; no check, stages or fund size.
- Lemnos: site unreachable (certificate error), so domain unverified; San Francisco, seed, Fund III $50M (2017, TechCrunch); check size conflicts, left null.
- MISUMI Ventures: one press article (Robotics247): $50M inaugural fund, pre-seed and seed, $0.5M to $1.5M checks; own site not fetched.
- HCVC (Hardware Club): hcvc.co and TechCrunch; Paris; pre-seed and seed, $260k to $2.6M; Fund II $75M (2023-10).
- JMoon Ventures: Toronto, physical-AI thesis; jmoon.vc gave only a title; stages, checks and funds null; a $20M fund listing is unverified.
- Bosch Ventures: bosch.ventures (writes itself Robert Bosch Venture Capital); cvc; up to EUR 25M checks; HQ and fund size null.
- Physical Fund: not_found (physical.fund is a coming-soon page). Samsung Ventures: not_found (samsungventures.com returned 502 three times); both are tagged records with no profile.
Added to `queue.json` as Tier B (score 0, no computed score) for the seven active firms.
