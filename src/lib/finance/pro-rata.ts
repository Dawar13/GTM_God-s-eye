import { assertFraction, assertPositive } from "./rounding";

/**
 * Pro rata: the amount an investor must put into a round to keep its
 * ownership, and its ownership with and without doing so.
 * amount = ownership × roundSize; without it, ownership × (1 − sold).
 */
export function proRata(args: {
  ownership: number;
  roundSize: number;
  /** Fraction of the company the round sells, e.g. 0.2. */
  roundOwnershipSold: number;
}): { amount: number; ownershipWith: number; ownershipWithout: number } {
  assertFraction("ownership", args.ownership, true);
  assertPositive("roundSize", args.roundSize);
  assertFraction("roundOwnershipSold", args.roundOwnershipSold);
  return {
    amount: args.ownership * args.roundSize,
    ownershipWith: args.ownership,
    ownershipWithout: args.ownership * (1 - args.roundOwnershipSold),
  };
}
