import { FULL_PRECISION, assertPositive, roundPrice, roundShares, type Rounding } from "./rounding";

export type PricedRoundInput = {
  /** Give exactly one of preMoney or postMoney. */
  preMoney?: number;
  postMoney?: number;
  investment: number;
  /** Fully diluted shares before the round (common, options, pool, converted securities). */
  preMoneyFDShares: number;
  rounding?: Rounding;
};

export type PricedRoundResult = {
  preMoney: number;
  postMoney: number;
  pricePerShare: number;
  newShares: number;
  postMoneyFDShares: number;
  ownership: { existing: number; newInvestors: number };
};

/**
 * A priced equity round.
 *
 * post = pre + investment; price = pre / pre-money FD shares;
 * new shares = investment / price; new investors own investment / post.
 *
 * Assumes the pre-money includes every existing share and option (no pool
 * shuffle; see option-pool.ts). Source: Feld & Mendelson, *Venture Deals*,
 * ch. 4 "Valuation".
 */
export function pricedRound(input: PricedRoundInput): PricedRoundResult {
  const { investment, preMoneyFDShares, rounding = FULL_PRECISION } = input;
  assertPositive("investment", investment);
  assertPositive("preMoneyFDShares", preMoneyFDShares);
  if ((input.preMoney === undefined) === (input.postMoney === undefined))
    throw new RangeError("give exactly one of preMoney or postMoney");
  const preMoney = input.preMoney ?? (input.postMoney as number) - investment;
  assertPositive("preMoney", preMoney);
  const postMoney = preMoney + investment;
  const pricePerShare = roundPrice(preMoney / preMoneyFDShares, rounding);
  // A price that rounds to zero would issue infinite shares.
  assertPositive("pricePerShare", pricePerShare);
  const newShares = roundShares(investment / pricePerShare, rounding);
  const postMoneyFDShares = preMoneyFDShares + newShares;
  return {
    preMoney,
    postMoney,
    pricePerShare,
    newShares,
    postMoneyFDShares,
    ownership: {
      existing: preMoneyFDShares / postMoneyFDShares,
      newInvestors: newShares / postMoneyFDShares,
    },
  };
}
