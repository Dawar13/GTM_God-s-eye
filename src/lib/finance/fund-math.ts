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
