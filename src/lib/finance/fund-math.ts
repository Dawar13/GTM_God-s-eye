import { assertFraction, assertPositive } from "./rounding";

/** Ownership left after a series of dilutive rounds: entry × Π(1 − dᵢ). */
export function exitOwnership(entry: number, dilutions: number[]): number {
  assertFraction("entry", entry, true);
  return dilutions.reduce((own, d) => {
    assertFraction("dilution", d);
    return own * (1 - d);
  }, entry);
}

/**
 * Exit value at which one company returns `multiple` × the fund:
 * fundSize × multiple / exitOwnership. Why a $50M and a $1B fund want
 * different outcomes. Source: Feld & Mendelson, *Venture Deals*, ch. 12.
 */
export function exitNeededToReturnFund(
  fundSize: number,
  ownershipAtExit: number,
  multiple = 1,
): number {
  assertPositive("fundSize", fundSize);
  assertPositive("ownershipAtExit", ownershipAtExit);
  assertPositive("multiple", multiple);
  return (fundSize * multiple) / ownershipAtExit;
}

export type FundScenario = {
  ownershipAtExit: number;
  /** Exit value at which one company returns `multiple` × the fund. */
  exitNeeded: number;
  /** What the fund gets back from `assumedExit`, as a multiple of the fund. */
  returnAtAssumedExit: number;
};

/**
 * One company's effect on a fund: entry ownership diluted by `laterRounds` rounds of
 * `dilutionPerRound` each (`exitOwnership`), the exit that returns the fund
 * (`exitNeededToReturnFund`), and the fund multiple from an assumed exit.
 */
export function fundScenario(args: {
  fundSize: number;
  entryOwnership: number;
  laterRounds: number;
  dilutionPerRound: number;
  multiple: number;
  assumedExit: number;
}): FundScenario {
  assertPositive("assumedExit", args.assumedExit);
  if (!Number.isInteger(args.laterRounds) || args.laterRounds < 0)
    throw new RangeError("laterRounds must be a whole number, 0 or more");
  const ownershipAtExit = exitOwnership(
    args.entryOwnership,
    Array.from({ length: args.laterRounds }, () => args.dilutionPerRound),
  );
  return {
    ownershipAtExit,
    exitNeeded: exitNeededToReturnFund(args.fundSize, ownershipAtExit, args.multiple),
    returnAtAssumedExit: (args.assumedExit * ownershipAtExit) / args.fundSize,
  };
}
