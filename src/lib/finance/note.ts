import { assertFraction, assertPositive } from "./rounding";

export type Compounding = "simple" | "annual" | "monthly";

/**
 * Year fraction between two ISO dates on the 30/360 convention, which convertible
 * notes commonly use: 2025-01-01 → 2026-07-01 is exactly 1.5 years.
 */
export function yearFraction30360(start: string, end: string): number {
  const [y1, m1, d1] = start.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = end.split("-").map(Number) as [number, number, number];
  const days = (y2 - y1) * 360 + (m2 - m1) * 30 + (Math.min(d2, 30) - Math.min(d1, 30));
  if (days < 0) throw new RangeError("end must not be before start");
  return days / 360;
}

/**
 * Principal plus accrued interest.
 *
 * simple: P(1 + r·t); annual: P(1 + r)^t; monthly: P(1 + r/12)^(12t).
 * Give either `years`, or `start` and `end` (30/360). Source: Feld & Mendelson,
 * *Venture Deals*, ch. 6 "Convertible Debt" (interest accrues and converts).
 */
export function accrue(args: {
  principal: number;
  rate: number;
  compounding: Compounding;
  years?: number;
  start?: string;
  end?: string;
}): number {
  assertPositive("principal", args.principal);
  assertFraction("rate", args.rate);
  const t =
    args.years ?? (args.start && args.end ? yearFraction30360(args.start, args.end) : Number.NaN);
  if (!(t >= 0)) throw new RangeError("give years, or start and end");
  const { principal: p, rate: r } = args;
  if (args.compounding === "simple") return p * (1 + r * t);
  if (args.compounding === "annual") return p * (1 + r) ** t;
  return p * (1 + r / 12) ** (12 * t);
}

export type NoteConversion = {
  capPrice: number | null;
  discountPrice: number;
  conversionPrice: number;
  shares: number;
  method: "cap" | "discount" | "round_price";
};

/**
 * Converts a note's accrued value at the lower of the cap price and the
 * discounted round price.
 *
 * - capBasis "pre_money": cap price = cap / capitalization (pre-money shares).
 * - capBasis "post_money": the note owns accrued / cap of the post-conversion
 *   capitalization, so shares = (accrued/cap)·C / (1 − accrued/cap).
 */
export function convertNote(args: {
  accrued: number;
  cap: number | null;
  capBasis: "pre_money" | "post_money";
  discount: number | null;
  roundPrice: number;
  capitalization: number;
}): NoteConversion {
  const { accrued, cap, roundPrice, capitalization } = args;
  assertPositive("accrued", accrued);
  assertPositive("roundPrice", roundPrice);
  assertPositive("capitalization", capitalization);
  if (args.discount !== null) assertFraction("discount", args.discount);
  const discountPrice = roundPrice * (1 - (args.discount ?? 0));
  let capPrice: number | null = null;
  if (cap !== null) {
    assertPositive("cap", cap);
    if (args.capBasis === "pre_money") {
      capPrice = cap / capitalization;
    } else {
      const f = accrued / cap;
      if (f >= 1) throw new RangeError("accrued value is at or above the post-money cap");
      capPrice = accrued / ((f * capitalization) / (1 - f));
    }
  }
  if (capPrice !== null && capPrice <= discountPrice) {
    return {
      capPrice,
      discountPrice,
      conversionPrice: capPrice,
      shares: accrued / capPrice,
      method: "cap",
    };
  }
  return {
    capPrice,
    discountPrice,
    conversionPrice: discountPrice,
    shares: accrued / discountPrice,
    method: args.discount ? "discount" : "round_price",
  };
}

export type NoteScenario = {
  accrued: number;
  interest: number;
  roundPrice: number;
  conversion: NoteConversion;
  newInvestorShares: number;
  /** Shares outstanding after the note converts and the new money comes in. */
  totalShares: number;
  ownership: { existing: number; note: number; newInvestors: number };
};

/**
 * A convertible note converting at a priced round: principal plus accrued interest
 * (`accrue`), converted at the lower of the cap price and the discounted round price
 * (`convertNote`).
 *
 * Round price = headline pre-money ÷ capitalization, so the conversion shares come on top
 * of the pre-money share count (the note dilutes everyone, the new investors included).
 * New investors buy investment ÷ round price. Ownership is fully diluted after both.
 */
export function noteScenario(args: {
  principal: number;
  rate: number;
  compounding: Compounding;
  years: number;
  cap: number | null;
  capBasis: "pre_money" | "post_money";
  discount: number | null;
  roundPreMoney: number;
  roundInvestment: number;
  /** Fully diluted shares before the note converts. */
  capitalization: number;
}): NoteScenario {
  assertPositive("roundPreMoney", args.roundPreMoney);
  assertPositive("roundInvestment", args.roundInvestment);
  assertPositive("capitalization", args.capitalization);
  const accrued = accrue({
    principal: args.principal,
    rate: args.rate,
    compounding: args.compounding,
    years: args.years,
  });
  const roundPrice = args.roundPreMoney / args.capitalization;
  const conversion = convertNote({
    accrued,
    cap: args.cap,
    capBasis: args.capBasis,
    discount: args.discount,
    roundPrice,
    capitalization: args.capitalization,
  });
  const newInvestorShares = args.roundInvestment / roundPrice;
  const totalShares = args.capitalization + conversion.shares + newInvestorShares;
  return {
    accrued,
    interest: accrued - args.principal,
    roundPrice,
    conversion,
    newInvestorShares,
    totalShares,
    ownership: {
      existing: args.capitalization / totalShares,
      note: conversion.shares / totalShares,
      newInvestors: newInvestorShares / totalShares,
    },
  };
}
