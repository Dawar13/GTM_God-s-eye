import { accrue, type Compounding, type NoteScenario } from "@/lib/finance";
import { CATEGORICAL } from "@/lib/viz/palette";

export type AccruedPoint = { month: number; value: number; interest: number };

/**
 * Note value month by month from signing (month 0 = principal) to the conversion month,
 * using the same `accrue` the conversion uses, so the last point is the converting amount.
 */
export function accruedSeries(args: {
  principal: number;
  rate: number;
  compounding: Compounding;
  months: number;
}): AccruedPoint[] {
  const { principal, rate, compounding, months } = args;
  if (!Number.isInteger(months) || months < 0)
    throw new RangeError("months must be a whole number");
  return Array.from({ length: months + 1 }, (_, month) => {
    const value = accrue({ principal, rate, compounding, years: month / 12 });
    return { month, value, interest: value - principal };
  });
}

export type PriceBar = {
  key: "round" | "discount" | "cap";
  label: string;
  /** Price per share. Bars start at zero. */
  price: number;
  /** True for the price the note actually converts at. */
  applies: boolean;
};

const APPLIES = { round_price: "round", discount: "discount", cap: "cap" } as const;

/** The prices the note could convert at: the round price, the discounted price and the cap price. */
export function priceComparison(s: NoteScenario, hasDiscount: boolean): PriceBar[] {
  const winner = APPLIES[s.conversion.method];
  const bars: PriceBar[] = [
    { key: "round", label: "Round price", price: s.roundPrice, applies: winner === "round" },
  ];
  if (hasDiscount)
    bars.push({
      key: "discount",
      label: "Discounted price",
      price: s.conversion.discountPrice,
      applies: winner === "discount",
    });
  if (s.conversion.capPrice !== null)
    bars.push({
      key: "cap",
      label: "Cap price",
      price: s.conversion.capPrice,
      applies: winner === "cap",
    });
  return bars;
}

/** One plain sentence saying which price applies and why. */
export function noteWhy(s: NoteScenario, hasDiscount: boolean): string {
  const { method, capPrice } = s.conversion;
  const other = hasDiscount ? "discounted round price" : "round price";
  if (method === "cap") return `The cap price is lower than the ${other}, so the cap applies.`;
  if (method === "discount")
    return capPrice === null
      ? "There is no cap, so the discounted round price applies."
      : "The discounted round price is lower than the cap price, so the discount applies.";
  return capPrice === null
    ? "There is no cap or discount, so the note converts at the round price."
    : "The cap price is above the round price and there is no discount, so the note converts at the round price.";
}

export type NoteOwnershipSegment = {
  key: "existing" | "note" | "new";
  label: string;
  fraction: number;
  color: string;
};

export function noteOwnership(s: NoteScenario): NoteOwnershipSegment[] {
  return [
    {
      key: "existing",
      label: "Existing holders",
      fraction: s.ownership.existing,
      color: CATEGORICAL[0],
    },
    { key: "note", label: "Note holder", fraction: s.ownership.note, color: CATEGORICAL[1] },
    {
      key: "new",
      label: "New investors",
      fraction: s.ownership.newInvestors,
      color: CATEGORICAL[2],
    },
  ];
}
