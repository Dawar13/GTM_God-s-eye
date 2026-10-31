import { equityFinancing, type Conversion, type FinancingResult } from "./safe";
import { CAP_TABLE_ROUNDING, assertPositive, type Rounding } from "./rounding";

/**
 * One SAFE converting at one priced round, for the SAFE calculator. Holdings are
 * founders plus the existing unissued pool; ownership is fully diluted and counts
 * the unissued pool. The same cap number can be read as a post-money or a
 * pre-money cap (`compareSafes`), which is the point of the comparison.
 */
export type SafeKind = "post_money" | "pre_money";

export const SAFE_HOLDER = "SAFE holder";
export const FOUNDERS = "founders";
export const NEW_MONEY = "new investors";

export type SafeScenarioInput = {
  kind: SafeKind;
  founderShares: number;
  /** Unissued pool before the round. */
  existingPool: number;
  safeAmount: number;
  /** Valuation cap in dollars, read as post-money or pre-money by `kind`. Null = no cap. */
  cap: number | null;
  /** e.g. 0.2 for a 20% discount; null or 0 = none. */
  discount: number | null;
  roundPreMoney: number;
  roundInvestment: number;
  /** Pool top-up counted in the pre-money, as a post-closing share; null = no top-up. */
  poolTargetPostPct: number | null;
  rounding?: Rounding;
};

/** Founder ownership (fully diluted) as each layer is added, in order. */
export type FounderDilution = {
  start: number;
  afterSafe: number;
  afterPool: number;
  afterNewMoney: number;
};

export type SafeScenario = {
  kind: SafeKind;
  financing: FinancingResult;
  conversion: Conversion;
  /** Fully diluted ownership after the round. */
  ownership: { founders: number; pool: number; safe: number; newInvestors: number };
  dilution: FounderDilution;
};

/** Founder ownership before the SAFE, after it converts, after the pool top-up, and after new money. */
export function founderDilution(
  financing: FinancingResult,
  founderShares: number,
  startingFD: number,
): FounderDilution {
  assertPositive("founderShares", founderShares);
  assertPositive("startingFD", startingFD);
  return {
    start: founderShares / startingFD,
    afterSafe: founderShares / financing.postConversionFD,
    afterPool: founderShares / (financing.postConversionFD + financing.poolIncrease),
    afterNewMoney: founderShares / financing.totalFD,
  };
}

export function safeScenario(input: SafeScenarioInput): SafeScenario {
  assertPositive("founderShares", input.founderShares);
  assertPositive("safeAmount", input.safeAmount);
  if (input.existingPool < 0 || !Number.isFinite(input.existingPool))
    throw new RangeError("existingPool must be zero or more");
  const rounding = input.rounding ?? CAP_TABLE_ROUNDING;
  const discount = input.discount ? input.discount : null;
  const holdings = { [FOUNDERS]: input.founderShares, pool: input.existingPool };
  const financing = equityFinancing({
    holdings,
    postMoneySafes:
      input.kind === "post_money"
        ? [{ holder: SAFE_HOLDER, amount: input.safeAmount, postMoneyCap: input.cap, discount }]
        : [],
    preMoneySafes:
      input.kind === "pre_money"
        ? [{ holder: SAFE_HOLDER, amount: input.safeAmount, preMoneyCap: input.cap, discount }]
        : [],
    preMoney: input.roundPreMoney,
    investment: input.roundInvestment,
    investors: { [NEW_MONEY]: input.roundInvestment },
    pool:
      input.poolTargetPostPct === null || input.poolTargetPostPct === 0
        ? undefined
        : { targetPostPct: input.poolTargetPostPct },
    rounding,
  });
  const conversion = financing.conversions[0] as Conversion;
  const o = financing.ownership;
  return {
    kind: input.kind,
    financing,
    conversion,
    ownership: {
      founders: o[FOUNDERS] ?? 0,
      pool: o.pool ?? 0,
      safe: o[SAFE_HOLDER] ?? 0,
      newInvestors: o[NEW_MONEY] ?? 0,
    },
    dilution: founderDilution(
      financing,
      input.founderShares,
      input.founderShares + input.existingPool,
    ),
  };
}

export type SafeComparison = {
  post: SafeScenario;
  pre: SafeScenario;
  /** Post-money result minus pre-money result, in ownership points (fractions). */
  difference: { founders: number; safe: number };
};

/** The same SAFE terms read both ways. */
export function compareSafes(input: Omit<SafeScenarioInput, "kind">): SafeComparison {
  const post = safeScenario({ ...input, kind: "post_money" });
  const pre = safeScenario({ ...input, kind: "pre_money" });
  return {
    post,
    pre,
    difference: {
      founders: post.ownership.founders - pre.ownership.founders,
      safe: post.ownership.safe - pre.ownership.safe,
    },
  };
}
