import {
  FULL_PRECISION,
  assertFraction,
  assertPositive,
  roundPrice,
  roundShares,
  type Rounding,
} from "./rounding";

/**
 * Pool increase so the *available* pool is `targetPct` of post-closing fully
 * diluted shares, when the increase is counted in the pre-money (the "option
 * pool shuffle").
 *
 * With S = fully diluted shares before the increase, k = post / pre,
 * available pool after = existingAvailable + inc = t · k · (S + inc), so
 * inc = (t·k·S − existingAvailable) / (1 − t·k), floored at 0.
 * Source: Feld & Mendelson, *Venture Deals*, "The option pool"; YC SAFE User
 * Guide, Appendix II (pre-money includes the post-closing pool).
 */
export function poolIncreaseForTarget(args: {
  preMoney: number;
  postMoney: number;
  fdSharesBeforeIncrease: number;
  existingAvailablePool: number;
  targetPostPoolPct: number;
}): number {
  const { preMoney, postMoney, fdSharesBeforeIncrease: s, existingAvailablePool: avail } = args;
  assertFraction("targetPostPoolPct", args.targetPostPoolPct);
  const tk = (args.targetPostPoolPct * postMoney) / preMoney;
  if (tk >= 1) throw new RangeError("target pool is too large for this round");
  return Math.max(0, (tk * s - avail) / (1 - tk));
}

export type PoolShuffleInput = {
  headlinePreMoney: number;
  investment: number;
  /** Shares held by founders and other existing holders, excluding the pool. */
  existingShares: number;
  /** Unissued pool already available before the round. */
  existingPool: number;
  targetPostPoolPct: number;
  rounding?: Rounding;
};

export type PoolShuffleResult = {
  poolIncrease: number;
  pricePerShare: number;
  newShares: number;
  postFDShares: number;
  /** Headline pre-money less the value of the new pool: what existing holders really get. */
  effectivePreMoney: number;
  /** Headline less effective pre-money: the dollar value of the pool top-up, taken from existing holders. */
  gap: number;
  capTable: { existing: number; pool: number; investors: number };
  ownership: { existing: number; pool: number; investors: number };
};

/**
 * The option pool shuffle: the pool top-up is created before the round, so it
 * dilutes only existing holders and the effective pre-money falls by the
 * value of the new pool.
 */
export function poolShuffle(input: PoolShuffleInput): PoolShuffleResult {
  const { headlinePreMoney: pre, investment, existingShares, existingPool } = input;
  const rounding = input.rounding ?? FULL_PRECISION;
  assertPositive("headlinePreMoney", pre);
  assertPositive("investment", investment);
  assertPositive("existingShares", existingShares);
  const fdBefore = existingShares + existingPool;
  const poolIncrease = roundShares(
    poolIncreaseForTarget({
      preMoney: pre,
      postMoney: pre + investment,
      fdSharesBeforeIncrease: fdBefore,
      existingAvailablePool: existingPool,
      targetPostPoolPct: input.targetPostPoolPct,
    }),
    rounding,
  );
  const preMoneyShares = fdBefore + poolIncrease;
  const pricePerShare = roundPrice(pre / preMoneyShares, rounding);
  assertPositive("pricePerShare", pricePerShare);
  const newShares = roundShares(investment / pricePerShare, rounding);
  const postFDShares = preMoneyShares + newShares;
  const pool = existingPool + poolIncrease;
  return {
    poolIncrease,
    pricePerShare,
    newShares,
    postFDShares,
    effectivePreMoney: pre - poolIncrease * pricePerShare,
    gap: poolIncrease * pricePerShare,
    capTable: { existing: existingShares, pool, investors: newShares },
    ownership: {
      existing: existingShares / postFDShares,
      pool: pool / postFDShares,
      investors: newShares / postFDShares,
    },
  };
}
