import type { PoolShuffleResult, PricedRoundResult } from "@/lib/finance";
import { CATEGORICAL } from "@/lib/viz/palette";

/** One piece of a 100% ownership bar. Fractions sum to 1 across a bar. */
export type OwnershipSegment = {
  key: string;
  label: string;
  fraction: number;
  /** Shares behind the fraction, when the calculator tracks them. */
  shares: number | null;
  color: string;
};

const [BLUE, ORANGE, GREEN] = [CATEGORICAL[0], CATEGORICAL[1], CATEGORICAL[2]];

export type RoundOwnership = {
  segments: OwnershipSegment[];
  /** Fully diluted shares after the round. */
  totalShares: number;
};

/** Round builder: existing holders vs new investors, as shares of the post-money fully diluted count. */
export function roundOwnership(r: PricedRoundResult): RoundOwnership {
  return {
    totalShares: r.postMoneyFDShares,
    segments: [
      {
        key: "existing",
        label: "Existing holders",
        fraction: r.ownership.existing,
        shares: r.postMoneyFDShares - r.newShares,
        color: BLUE,
      },
      {
        key: "new",
        label: "New investors",
        fraction: r.ownership.newInvestors,
        shares: r.newShares,
        color: ORANGE,
      },
    ],
  };
}

/** Option pool calculator: existing holders, the unissued pool (old plus top-up) and new investors. */
export function poolOwnership(r: PoolShuffleResult): RoundOwnership {
  return {
    totalShares: r.postFDShares,
    segments: [
      {
        key: "existing",
        label: "Founders and existing holders",
        fraction: r.ownership.existing,
        shares: r.capTable.existing,
        color: BLUE,
      },
      {
        key: "pool",
        label: "Option pool",
        fraction: r.ownership.pool,
        shares: r.capTable.pool,
        color: GREEN,
      },
      {
        key: "new",
        label: "New investors",
        fraction: r.ownership.investors,
        shares: r.capTable.investors,
        color: ORANGE,
      },
    ],
  };
}

export type PoolBars = {
  bars: { key: "headline" | "effective"; label: string; value: number }[];
  /** Headline less effective pre-money, in dollars. */
  gap: number;
  /** Gap as a share of the headline pre-money. */
  gapShare: number;
};

/** Option pool: headline vs effective pre-money. Both bars start at zero. */
export function optionPoolBars(r: PoolShuffleResult, headlinePreMoney: number): PoolBars {
  return {
    bars: [
      { key: "headline", label: "Headline pre-money", value: headlinePreMoney },
      { key: "effective", label: "Effective pre-money", value: r.effectivePreMoney },
    ],
    gap: r.gap,
    gapShare: r.gap / headlinePreMoney,
  };
}
