import { assertFraction, assertPositive } from "./rounding";

/**
 * The VC method: work back from the exit an investor needs.
 *
 * post-money = exitValue × retention / targetMultiple; the investor must own
 * investment / post-money at entry (and investment × multiple / exit at exit).
 * Source: Feld & Mendelson, *Venture Deals*, ch. 4; Harvard Business School
 * note 9-288-006 "The Venture Capital Method".
 */
export function vcMethod(args: {
  exitValue: number;
  targetMultiple: number;
  /** Fraction of entry ownership left at exit after later rounds, e.g. 0.5. */
  retention: number;
  investment: number;
}): { postMoney: number; preMoney: number; requiredOwnership: number; ownershipAtExit: number } {
  assertPositive("exitValue", args.exitValue);
  assertPositive("targetMultiple", args.targetMultiple);
  assertPositive("investment", args.investment);
  assertFraction("retention", args.retention, true);
  if (args.retention === 0) throw new RangeError("retention must be above 0");
  const postMoney = (args.exitValue * args.retention) / args.targetMultiple;
  if (postMoney <= args.investment) throw new RangeError("exit too small for this investment");
  return {
    postMoney,
    preMoney: postMoney - args.investment,
    requiredOwnership: args.investment / postMoney,
    ownershipAtExit: (args.investment * args.targetMultiple) / args.exitValue,
  };
}
