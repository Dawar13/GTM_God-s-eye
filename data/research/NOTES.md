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
| Forgepoint | forgepoint.ai | AI agent automating RFQ-to-quote for manufacturers | siliconangle.com (2026-10-14) | to profile |
| Maneva | maneva.ai | "AI line supervisor" on existing factory cameras | parsers.vc (2026-06-16) | to profile |
| Edmund | not confirmed | Maintenance root-cause agents down to PLC level (Prague) | inforcapital.com | to profile |
| Aerchain | not stated | AI-agent procurement platform (Bengaluru) | whalesbook.com | to profile |
| Uptool | uptool.com | AI quoting for machine and fab shops | uptool.com | to profile |
| 1Buy.AI | 1buy.ai | AI procurement for electronics makers (Delhi); INR 32.5 Cr (Jan 2026) | india.entrepreneur.com | to profile |
| IndustrialMind.ai | industrialmind.ai | Agents turning industrial knowledge into workflows | antler-india research; trysignalbase.com | profiled: direct, process_planning |
| Procol | procol.ai | Procurement and finance agents for Indian manufacturers | blume-ventures.json | profiled: direct, plant_ops |
| Noetive | not confirmed | Plant AI (Eclipse portfolio) | eclipse-ventures.json | to profile |
| Vinci | not confirmed | Hardware design tooling (Eclipse portfolio) | eclipse-ventures.json | to profile |
| Sea12 | not confirmed | AI automation for heavy industry (Also Capital portfolio) | also-capital.json | to profile |
| Spector.ai | spector.ai | Maintenance and reliability agents; INR 58 Cr (Jan 2026) | inc42.com | to profile |
| UGX.AI | ugx.ai | Shop-floor data and agents (Gurugram); $1M seed (Nov 2025) | yourstory.com | to profile |
| ThirdAI Automation | thirdaiautomation.com | Root-cause copilot for chip fabs; $3M (Feb 2026) | inc42.com | to profile |
| FactoStack | factostack.com | Factory software with quote and PO agents | factostack.com | to profile |
| Intellithink | intellithink.in | Predictive maintenance; INR 17 Cr (Apr 2026) | newskart | to profile |
| Workroom Automation | not confirmed | AI planning engine; INR 6.2 Cr (Mar 2026) | Indian Chemical News | to profile |
