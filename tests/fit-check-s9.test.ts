/**
 * S9: the check-size fit feature ported from the pipeline (src/lib/fit/check.ts) reproduces
 * the stored value for every investor at the pipeline's $1M raise, and recomputes cleanly for
 * other raises.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { EXAMPLE_RAISE_USD } from "@/lib/calculators/examples";
import { checkFeature, withRaise } from "@/lib/fit/check";
import { fitScore } from "@/lib/fit/score";
import { getFitFeatures, getInvestors } from "@/lib/data";
import type { FitFeatures, Investor } from "@/lib/schema";

let investors: Map<string, Investor>;
let fits: FitFeatures[];

beforeAll(async () => {
  const [inv, f] = await Promise.all([getInvestors(), getFitFeatures()]);
  investors = new Map(inv.map((i) => [i.id, i]));
  fits = f;
});

const input = (i: Investor) => ({
  checkMinUsd: i.check_min_usd,
  checkMaxUsd: i.check_max_usd,
  leads: i.leads,
});

describe("check feature parity with the pipeline", () => {
  it("the example raise is the pipeline's raise (RAISE_SIZE_USD, $1M)", () => {
    expect(EXAMPLE_RAISE_USD).toBe(1_000_000);
    for (const f of fits) expect(f.raise_size_usd).toBe(EXAMPLE_RAISE_USD);
  });

  it("reproduces the stored check value for every investor with a fit record", () => {
    let compared = 0;
    let known = 0;
    for (const f of fits) {
      const inv = investors.get(f.investor_id);
      expect(inv, f.investor_id).toBeDefined();
      const mine = checkFeature(input(inv!), EXAMPLE_RAISE_USD);
      const stored = f.features.check?.value ?? null;
      if (stored === null) expect(mine, f.investor_id).toBeNull();
      else {
        expect(mine, f.investor_id).not.toBeNull();
        expect(mine as number).toBeCloseTo(stored, 6);
        known += 1;
      }
      compared += 1;
    }
    expect(compared).toBe(fits.length);
    // Not vacuous: some investors have a stored check feature, and some do not.
    expect(known).toBeGreaterThan(100);
    expect(known).toBeLessThan(compared);
    console.info(`check parity: ${compared} investors compared, ${known} with a known check value`);
  });

  it("withRaise at $1M leaves the fit score unchanged for every investor", () => {
    for (const f of fits) {
      const inv = investors.get(f.investor_id)!;
      const again = withRaise(f, input(inv), EXAMPLE_RAISE_USD);
      expect(fitScore(again).total).toBeCloseTo(fitScore(f).total, 9);
      expect(again.flags).toEqual(f.flags);
    }
  });
});

describe("check feature rules", () => {
  const base = { checkMinUsd: null, checkMaxUsd: null, leads: null };
  it("is unknown without a range", () => {
    expect(checkFeature(base, 1e6)).toBeNull();
    expect(checkFeature({ ...base, leads: true }, 1e6)).toBeNull();
  });
  it("is 0 when their minimum is above the whole round", () => {
    expect(checkFeature({ ...base, checkMinUsd: 2e6, checkMaxUsd: 5e6 }, 1e6)).toBe(0);
    expect(checkFeature({ ...base, checkMinUsd: 2e6, checkMaxUsd: 5e6, leads: true }, 1e6)).toBe(0.2);
  });
  it("is 0.3 for tiny checks, 1 inside the range, 0.8 when their largest check exceeds the round", () => {
    expect(checkFeature({ ...base, checkMaxUsd: 49_999 }, 1e6)).toBe(0.3);
    expect(checkFeature({ ...base, checkMinUsd: 100_000, checkMaxUsd: 500_000 }, 1e6)).toBe(1);
    expect(checkFeature({ ...base, checkMinUsd: 100_000, checkMaxUsd: 3e6 }, 1e6)).toBe(0.8);
    expect(checkFeature({ ...base, checkMinUsd: 100_000 }, 1e6)).toBe(1);
  });
  it("adds 0.2 for leads and clamps to 1", () => {
    expect(checkFeature({ ...base, checkMaxUsd: 49_999, leads: true }, 1e6)).toBe(0.5);
    expect(checkFeature({ ...base, checkMaxUsd: 500_000, leads: true }, 1e6)).toBe(1);
    expect(checkFeature({ ...base, checkMaxUsd: 3e6, leads: true }, 1e6)).toBe(1);
  });
  it("moves with the raise", () => {
    const inv = { ...base, checkMinUsd: 500_000, checkMaxUsd: 1_500_000 };
    expect(checkFeature(inv, 1e6)).toBe(0.8);
    expect(checkFeature(inv, 2e6)).toBe(1);
    expect(checkFeature(inv, 250_000)).toBe(0);
  });
  it("withRaise changes only the check feature", () => {
    const f = fits.find((x) => x.features.check && x.features.thesis)!;
    const inv = input(investors.get(f.investor_id)!);
    const changed = withRaise(f, inv, 20_000_000);
    expect(changed.features.thesis).toEqual(f.features.thesis);
    expect(changed.features.stage).toEqual(f.features.stage);
    expect(changed.raise_size_usd).toBe(20_000_000);
    expect(changed.features.check?.value).toBe(checkFeature(inv, 20_000_000));
  });
});
