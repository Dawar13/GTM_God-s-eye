# Data issues found in Phase 2

Data is frozen in Phase 2. These are logged, not fixed. Each line: what, how many, where it shows.

- 2026-10-31 (S2): 2,553 of 3,317 investors have `region: null`, so the Western default filter shows 709 and "Western share" is computed over the 764 with a region (92.8% Western). Any region comparison undercounts the unknown group.
- 2026-10-31 (S2): 2,569 of 3,317 investors have no freshness (no fund on record), so "fresh funds" and fresh dry powder cover only the 748 investors with a dated fund.
- 2026-10-31 (S2): 87 of 1,210 funds have no close date or vintage year (not on Funds closed by year); 90 have no size (left out of dollar sums).
- 2026-10-31 (S2): 1 fresh Western investor has a latest fund with no size, so Fresh dry powder is a lower bound by that one fund.
- 2026-10-31 (S2): The top of "Top 10 by fit score" is held by investors flagged `sparse` (only two or three of six features known, rescaled to about 100). The score is correct per `src/lib/fit/score.ts`; the flag is shown, but sparse rows outrank well-evidenced ones. Handled in the view: the tile ranks non-sparse investors only (DECISIONS, S2).
- 2026-10-31 (S2): Only 118 of 1,034 non-competitor companies have a `layer`, so "our layers" covers 118 companies plus 44 competitors; rounds of other companies are not in the Recent deals chart.
