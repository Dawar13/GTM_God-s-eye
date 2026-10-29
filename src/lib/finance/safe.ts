import { poolIncreaseForTarget } from "./option-pool";
import {
  FULL_PRECISION,
  assertFraction,
  assertPositive,
  ownershipOf,
  roundPrice,
  roundShares,
  type Rounding,
} from "./rounding";

/**
 * SAFE conversion, following Y Combinator's Post-Money SAFE and its User Guide
 * (https://www.ycombinator.com/documents, "SAFE User Guide", Appendix II):
 *
 * - Post-money SAFE: Safe Price = Post-Money Valuation Cap / Company
 *   Capitalization, where Company Capitalization counts all shares, options,
 *   the unissued pool and every converting security (including these SAFEs),
 *   but not the new money or the pool increase of the round. The holder gets
 *   the lower of Safe Price and the discounted round price.
 * - Pre-money SAFE: Safe Price = Pre-Money Valuation Cap / (pre-financing fully
 *   diluted shares + pool increase); converting securities are excluded.
 * - A SAFE with neither cap nor discount converts at the round price.
 * - MFN: an MFN SAFE takes the lowest cap and highest discount of SAFEs issued
 *   after it (`resolveMfn`).
 */

export type PostMoneySafe = {
  holder: string;
  amount: number;
  postMoneyCap: number | null;
  /** e.g. 0.2 for a 20% discount */
  discount: number | null;
  mfn?: boolean;
};

export type PreMoneySafe = {
  holder: string;
  amount: number;
  preMoneyCap: number | null;
  discount: number | null;
};

/** A note at conversion: accrued value with a pre-money cap basis. */
export type ConvertingNote = {
  holder: string;
  accrued: number;
  cap: number | null;
  discount: number | null;
};

export type Conversion = {
  holder: string;
  instrument: "post_money_safe" | "pre_money_safe" | "note";
  amount: number;
  price: number;
  shares: number;
  method: "cap" | "discount" | "round_price";
};

export type FinancingInput = {
  /** Fully diluted holdings before the round: common, options, and the unissued pool. */
  holdings: Record<string, number>;
  /** Key of the unissued pool in `holdings` (default "pool"). */
  poolKey?: string;
  postMoneySafes?: PostMoneySafe[];
  preMoneySafes?: PreMoneySafe[];
  notes?: ConvertingNote[];
  preMoney: number;
  /** Total new money in the round. */
  investment: number;
  /** New-money buyers by amount; the rest of the round goes to "new investors". */
  investors?: Record<string, number>;
  /** Pro rata rights: holder -> fraction of the round's new shares they buy. */
  proRata?: Record<string, number>;
  /** Pool increase counted in the pre-money: explicit shares or a post-closing target. */
  pool?: { increaseShares: number } | { targetPostPct: number };
  rounding?: Rounding;
};

export type FinancingResult = {
  pricePerShare: number;
  postMoney: number;
  poolIncrease: number;
  /** Company Capitalization used for post-money SAFEs (0 if there are none). */
  companyCapitalization: number;
  conversions: Conversion[];
  /** Fully diluted shares after conversion, before new money and pool increase. */
  postConversionFD: number;
  newShares: number;
  newSharesByInvestor: Record<string, number>;
  holdings: Record<string, number>;
  totalFD: number;
  ownership: Record<string, number>;
};

const NEW_INVESTORS = "new investors";
const MAX_ITERATIONS = 200;

/** MFN SAFEs adopt the best cap (lowest) and discount (highest) of later SAFEs. */
export function resolveMfn(safes: PostMoneySafe[]): PostMoneySafe[] {
  return safes.map((s, i) => {
    if (!s.mfn) return s;
    const later = safes.slice(i + 1);
    const caps = later.map((x) => x.postMoneyCap).filter((c): c is number => c !== null);
    const discounts = later.map((x) => x.discount).filter((d): d is number => d !== null);
    return {
      ...s,
      postMoneyCap: caps.length ? Math.min(...caps, s.postMoneyCap ?? Infinity) : s.postMoneyCap,
      discount: discounts.length ? Math.max(...discounts, s.discount ?? 0) : s.discount,
    };
  });
}

function bestPrice(
  capPrice: number | null,
  roundPricePerShare: number,
  discount: number | null,
  r: Rounding,
): { price: number; method: Conversion["method"] } {
  const discounted = roundPrice(roundPricePerShare * (1 - (discount ?? 0)), r);
  const roundMethod = discount ? "discount" : "round_price";
  if (capPrice !== null && capPrice <= discounted) return { price: capPrice, method: "cap" };
  return { price: discounted, method: roundMethod };
}

function validate(input: FinancingInput): void {
  assertPositive("preMoney", input.preMoney);
  assertPositive("investment", input.investment);
  for (const s of input.postMoneySafes ?? []) {
    assertPositive("SAFE amount", s.amount);
    if (s.postMoneyCap !== null) assertPositive("postMoneyCap", s.postMoneyCap);
    if (s.discount !== null) assertFraction("discount", s.discount);
  }
  for (const s of input.preMoneySafes ?? []) {
    assertPositive("SAFE amount", s.amount);
    if (s.preMoneyCap !== null) assertPositive("preMoneyCap", s.preMoneyCap);
    if (s.discount !== null) assertFraction("discount", s.discount);
  }
  for (const n of input.notes ?? []) {
    assertPositive("note accrued", n.accrued);
    if (n.discount !== null) assertFraction("discount", n.discount);
  }
  const capped = (input.postMoneySafes ?? []).filter((s) => s.postMoneyCap !== null);
  const sold = capped.reduce((a, s) => a + s.amount / (s.postMoneyCap as number), 0);
  if (sold >= 1) throw new RangeError("post-money SAFEs sell 100% or more of the company");
}

/**
 * An equity financing in which outstanding SAFEs and notes convert. Solves the
 * circular dependency (round price depends on conversion shares, which depend
 * on the round price) by fixed-point iteration on the price.
 */
export function equityFinancing(input: FinancingInput): FinancingResult {
  validate(input);
  const r = input.rounding ?? FULL_PRECISION;
  const poolKey = input.poolKey ?? "pool";
  const base = Object.values(input.holdings).reduce((a, b) => a + b, 0);
  assertPositive("existing fully diluted shares", base);
  const availablePool = input.holdings[poolKey] ?? 0;
  const postMoney = input.preMoney + input.investment;
  const postSafes = resolveMfn(input.postMoneySafes ?? []);

  let price = roundPrice(input.preMoney / base, r);
  let poolIncrease =
    "increaseShares" in (input.pool ?? {})
      ? (input.pool as { increaseShares: number }).increaseShares
      : 0;
  let state = convertAll(input, postSafes, base, price, poolIncrease, r);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    state = convertAll(input, postSafes, base, price, poolIncrease, r);
    if (input.pool && "targetPostPct" in input.pool) {
      poolIncrease = roundShares(
        poolIncreaseForTarget({
          preMoney: input.preMoney,
          postMoney,
          fdSharesBeforeIncrease: state.postConversionFD,
          existingAvailablePool: availablePool,
          targetPostPoolPct: input.pool.targetPostPct,
        }),
        r,
      );
    }
    const next = roundPrice(input.preMoney / (state.postConversionFD + poolIncrease), r);
    if (Math.abs(next - price) <= 1e-12 * Math.max(1, price)) {
      price = next;
      break;
    }
    price = next;
  }
  state = convertAll(input, postSafes, base, price, poolIncrease, r);

  const newShares = roundShares(input.investment / price, r);
  const newSharesByInvestor: Record<string, number> = {};
  let assigned = 0;
  for (const [holder, fraction] of Object.entries(input.proRata ?? {})) {
    const s = roundShares(newShares * fraction, r);
    newSharesByInvestor[holder] = (newSharesByInvestor[holder] ?? 0) + s;
    assigned += s;
  }
  for (const [holder, amount] of Object.entries(input.investors ?? {})) {
    const s = roundShares(amount / price, r);
    newSharesByInvestor[holder] = (newSharesByInvestor[holder] ?? 0) + s;
    assigned += s;
  }
  if (assigned > newShares + 1e-6) throw new RangeError("named investors buy more than the round");
  if (newShares - assigned > 1e-9)
    newSharesByInvestor[NEW_INVESTORS] =
      (newSharesByInvestor[NEW_INVESTORS] ?? 0) + newShares - assigned;

  const holdings: Record<string, number> = { ...input.holdings };
  holdings[poolKey] = availablePool + poolIncrease;
  for (const c of state.conversions) holdings[c.holder] = (holdings[c.holder] ?? 0) + c.shares;
  for (const [holder, s] of Object.entries(newSharesByInvestor))
    holdings[holder] = (holdings[holder] ?? 0) + s;
  const totalFD = Object.values(holdings).reduce((a, b) => a + b, 0);

  return {
    pricePerShare: price,
    postMoney,
    poolIncrease,
    companyCapitalization: state.companyCapitalization,
    conversions: state.conversions,
    postConversionFD: state.postConversionFD,
    newShares,
    newSharesByInvestor,
    holdings,
    totalFD,
    ownership: ownershipOf(holdings),
  };
}

function convertAll(
  input: FinancingInput,
  postSafes: PostMoneySafe[],
  base: number,
  price: number,
  poolIncrease: number,
  r: Rounding,
): { conversions: Conversion[]; companyCapitalization: number; postConversionFD: number } {
  const conversions: Conversion[] = [];

  // Pre-money SAFEs: cap over pre-financing FD plus the pool increase.
  for (const s of input.preMoneySafes ?? []) {
    const capPrice =
      s.preMoneyCap === null ? null : roundPrice(s.preMoneyCap / (base + poolIncrease), r);
    const best = bestPrice(capPrice, price, s.discount, r);
    conversions.push({
      holder: s.holder,
      instrument: "pre_money_safe",
      amount: s.amount,
      price: best.price,
      shares: roundShares(s.amount / best.price, r),
      method: best.method,
    });
  }
  // Notes: pre-money cap basis, like pre-money SAFEs.
  for (const n of input.notes ?? []) {
    const capPrice = n.cap === null ? null : roundPrice(n.cap / (base + poolIncrease), r);
    const best = bestPrice(capPrice, price, n.discount, r);
    conversions.push({
      holder: n.holder,
      instrument: "note",
      amount: n.accrued,
      price: best.price,
      shares: roundShares(n.accrued / best.price, r),
      method: best.method,
    });
  }

  const fixed = base + conversions.reduce((a, c) => a + c.shares, 0);
  if (postSafes.length === 0)
    return { conversions, companyCapitalization: 0, postConversionFD: fixed };

  // Post-money SAFEs: those converting at their cap own amount/cap of Company
  // Capitalization; the rest take a fixed number of shares at the round price.
  let atCap = new Set(postSafes.filter((s) => s.postMoneyCap !== null).map((_, i) => i));
  atCap = new Set(postSafes.flatMap((s, i) => (s.postMoneyCap !== null ? [i] : [])));
  let cc = 0;
  let others: { i: number; price: number; method: Conversion["method"] }[] = [];
  for (let pass = 0; pass <= postSafes.length; pass++) {
    others = postSafes.flatMap((s, i) => {
      if (atCap.has(i)) return [];
      const b = bestPrice(null, price, s.discount, r);
      return [{ i, price: b.price, method: b.method }];
    });
    const fixedOthers = others.reduce(
      (a, o) => a + roundShares((postSafes[o.i] as PostMoneySafe).amount / o.price, r),
      0,
    );
    const frac = [...atCap].reduce(
      (a, i) =>
        a +
        (postSafes[i] as PostMoneySafe).amount /
          ((postSafes[i] as PostMoneySafe).postMoneyCap as number),
      0,
    );
    cc = roundShares((fixed + fixedOthers) / (1 - frac), r);
    const leaving = [...atCap].filter((i) => {
      const s = postSafes[i] as PostMoneySafe;
      const capPrice = roundPrice((s.postMoneyCap as number) / cc, r);
      return bestPrice(capPrice, price, s.discount, r).method !== "cap";
    });
    if (leaving.length === 0) break;
    for (const i of leaving) atCap.delete(i);
  }

  for (const [i, s] of postSafes.entries()) {
    if (atCap.has(i)) {
      conversions.push({
        holder: s.holder,
        instrument: "post_money_safe",
        amount: s.amount,
        price: roundPrice((s.postMoneyCap as number) / cc, r),
        shares: roundShares((cc * s.amount) / (s.postMoneyCap as number), r),
        method: "cap",
      });
    } else {
      const o = others.find((x) => x.i === i) as { price: number; method: Conversion["method"] };
      conversions.push({
        holder: s.holder,
        instrument: "post_money_safe",
        amount: s.amount,
        price: o.price,
        shares: roundShares(s.amount / o.price, r),
        method: o.method,
      });
    }
  }
  const postConversionFD = base + conversions.reduce((a, c) => a + c.shares, 0);
  return { conversions, companyCapitalization: cc, postConversionFD };
}

/** Post-money SAFEs alone, at their caps: the ownership they lock in (amount / cap each). */
export function convertPostMoneySafes(args: {
  holdings: Record<string, number>;
  safes: PostMoneySafe[];
  rounding?: Rounding;
}): {
  companyCapitalization: number;
  shares: Record<string, number>;
  ownership: Record<string, number>;
} {
  const r = args.rounding ?? FULL_PRECISION;
  const safes = resolveMfn(args.safes).filter((s) => s.postMoneyCap !== null);
  const base = Object.values(args.holdings).reduce((a, b) => a + b, 0);
  assertPositive("existing fully diluted shares", base);
  const frac = safes.reduce((a, s) => a + s.amount / (s.postMoneyCap as number), 0);
  if (frac >= 1) throw new RangeError("post-money SAFEs sell 100% or more of the company");
  const cc = roundShares(base / (1 - frac), r);
  const shares: Record<string, number> = {};
  for (const s of safes)
    shares[s.holder] =
      (shares[s.holder] ?? 0) + roundShares((cc * s.amount) / (s.postMoneyCap as number), r);
  return {
    companyCapitalization: cc,
    shares,
    ownership: ownershipOf({ ...args.holdings, ...shares }),
  };
}

/** Pre-money SAFEs at a priced round, with the pool increase counted in the cap basis. */
export function convertPreMoneySafes(args: {
  preFinancingFD: number;
  poolIncrease: number;
  safes: PreMoneySafe[];
  roundPricePerShare: number;
  rounding?: Rounding;
}): Conversion[] {
  const r = args.rounding ?? FULL_PRECISION;
  assertPositive("preFinancingFD", args.preFinancingFD);
  assertPositive("roundPricePerShare", args.roundPricePerShare);
  return args.safes.map((s) => {
    const capPrice =
      s.preMoneyCap === null
        ? null
        : roundPrice(s.preMoneyCap / (args.preFinancingFD + args.poolIncrease), r);
    const best = bestPrice(capPrice, args.roundPricePerShare, s.discount, r);
    return {
      holder: s.holder,
      instrument: "pre_money_safe" as const,
      amount: s.amount,
      price: best.price,
      shares: roundShares(s.amount / best.price, r),
      method: best.method,
    };
  });
}

/**
 * Post-money SAFEs at a Liquidity Event before any priced round: each holder
 * gets the greater of its Purchase Amount (Cash-Out Amount) and what its
 * Conversion Amount (Purchase Amount / Liquidity Price) would receive.
 * Liquidity Price = cap / Liquidity Capitalization. Cash-outs come first and
 * share pro rata if the proceeds fall short (YC SAFE §1(b), §1(d)).
 */
export function safeLiquidity(args: {
  holdings: Record<string, number>;
  safes: PostMoneySafe[];
  exitValue: number;
  rounding?: Rounding;
}): {
  liquidityCapitalization: number;
  pricePerShare: number;
  payouts: Record<string, { converts: boolean; shares: number; cash: number }>;
  commonPayout: number;
} {
  const r = args.rounding ?? FULL_PRECISION;
  const safes = resolveMfn(args.safes);
  const base = Object.values(args.holdings).reduce((a, b) => a + b, 0);
  const capped = safes.filter((s) => s.postMoneyCap !== null);
  const frac = capped.reduce((a, s) => a + s.amount / (s.postMoneyCap as number), 0);
  const lc = base / (1 - frac);
  const conversionShares = safes.map((s) =>
    s.postMoneyCap === null ? 0 : roundShares(s.amount / ((s.postMoneyCap as number) / lc), r),
  );
  // Decide conversion one safe at a time until stable.
  const converts = safes.map(() => true);
  for (let pass = 0; pass < safes.length + 1; pass++) {
    const { perShare } = settle(base, safes, conversionShares, converts, args.exitValue, r);
    let changed = false;
    safes.forEach((s, i) => {
      const asShares = (conversionShares[i] as number) * perShare;
      const want = (conversionShares[i] as number) > 0 && asShares > s.amount;
      if (want !== converts[i]) {
        converts[i] = want;
        changed = true;
      }
    });
    if (!changed) break;
  }
  const { perShare, cashOut } = settle(base, safes, conversionShares, converts, args.exitValue, r);
  const payouts: Record<string, { converts: boolean; shares: number; cash: number }> = {};
  safes.forEach((s, i) => {
    const shares = converts[i] ? (conversionShares[i] as number) : 0;
    payouts[s.holder] = {
      converts: converts[i] as boolean,
      shares,
      cash: converts[i] ? shares * perShare : (cashOut[i] as number),
    };
  });
  return {
    liquidityCapitalization: base + conversionShares.reduce((a, b) => a + b, 0),
    pricePerShare: perShare,
    payouts,
    commonPayout: base * perShare,
  };
}

function settle(
  base: number,
  safes: PostMoneySafe[],
  conversionShares: number[],
  converts: boolean[],
  exitValue: number,
  r: Rounding,
): { perShare: number; cashOut: number[] } {
  const owed = safes.map((s, i) => (converts[i] ? 0 : s.amount));
  const totalOwed = owed.reduce((a, b) => a + b, 0);
  const scale = totalOwed > exitValue ? exitValue / totalOwed : 1;
  const cashOut = owed.map((o) => o * scale);
  const remaining = Math.max(0, exitValue - totalOwed * scale);
  // All conversion shares count in the per-share price, as in the SAFE's Liquidity
  // Capitalization; cashed-out holders forgo theirs.
  const shares = base + conversionShares.reduce((a, s, i) => a + (converts[i] ? s : 0), 0);
  const perShare = roundPrice(remaining / shares, r);
  return { perShare, cashOut };
}
