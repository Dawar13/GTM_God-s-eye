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
