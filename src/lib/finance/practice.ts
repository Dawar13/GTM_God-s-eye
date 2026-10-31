import { pricedRound } from "./priced-round";
import { mulberry32 } from "./power-law";

/**
 * Practice challenges: ownership questions generated from the pricing engine with a seeded
 * generator, so a seed always gives the same question and answer. Every answer comes from
 * `pricedRound`, not from a separate formula.
 */

/** Shares before the first round; only the ratios matter, so any positive number works. */
const START_SHARES = 10_000_000;

export type Challenge =
  | { kind: "investor_post"; seed: number; preMoney: number; investment: number; answer: number }
  | {
      kind: "founder_after";
      seed: number;
      founderBefore: number;
      preMoney: number;
      investment: number;
      answer: number;
    }
  | {
      kind: "two_rounds";
      seed: number;
      founderBefore: number;
      rounds: [{ preMoney: number; investment: number }, { preMoney: number; investment: number }];
      answer: number;
    };

const M = 1_000_000;
const RAISES = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10].map((x) => x * M);
const PRE_MONEYS = [4, 5, 6, 8, 10, 12, 15, 20, 24, 30, 40, 50].map((x) => x * M);
const FOUNDER_STAKES = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
const STEP_UPS = [1.5, 2, 3];

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)] as T;
}

function roundTo(value: number, unit: number): number {
  return Math.max(unit, Math.round(value / unit) * unit);
}

/** A raise and a pre-money where the raise is at most 40% of the pre-money. */
function drawRound(rand: () => number, minPre = 0) {
  const investment = pick(rand, RAISES);
  const options = PRE_MONEYS.filter((p) => p >= investment * 2.5 && p > minPre);
  return {
    preMoney: pick(
      rand,
      options.length > 0 ? options : [PRE_MONEYS[PRE_MONEYS.length - 1] as number],
    ),
    investment,
  };
}

function existingShare(preMoney: number, investment: number): number {
  return pricedRound({ preMoney, investment, preMoneyFDShares: START_SHARES }).ownership.existing;
}

export function generateChallenge(seed: number): Challenge {
  const s = Math.abs(Math.trunc(seed)) >>> 0;
  const rand = mulberry32(s);
  const kind = pick(rand, ["investor_post", "founder_after", "two_rounds"] as const);

  if (kind === "investor_post") {
    const { preMoney, investment } = drawRound(rand);
    const answer = pricedRound({ preMoney, investment, preMoneyFDShares: START_SHARES }).ownership
      .newInvestors;
    return { kind, seed: s, preMoney, investment, answer };
  }
  if (kind === "founder_after") {
    const founderBefore = pick(rand, FOUNDER_STAKES);
    const { preMoney, investment } = drawRound(rand);
    return {
      kind,
      seed: s,
      founderBefore,
      preMoney,
      investment,
      answer: founderBefore * existingShare(preMoney, investment),
    };
  }
  const founderBefore = pick(rand, FOUNDER_STAKES);
  const first = drawRound(rand);
  const postFirst = first.preMoney + first.investment;
  const preMoney2 = roundTo(postFirst * pick(rand, STEP_UPS), M);
  const second = {
    preMoney: preMoney2,
    investment: roundTo(preMoney2 * pick(rand, [0.1, 0.2, 0.25]), 0.5 * M),
  };
  return {
    kind,
    seed: s,
    founderBefore,
    rounds: [first, second],
    answer:
      founderBefore *
      existingShare(first.preMoney, first.investment) *
      existingShare(second.preMoney, second.investment),
  };
}

export type GuessScore = { correct: boolean; errorPoints: number };

/** A guess scores when it is within `tolerancePoints` percentage points (default 1) of the answer. */
export function scoreGuess(guess: number, answer: number, tolerancePoints = 1): GuessScore {
  if (!Number.isFinite(guess) || !Number.isFinite(answer))
    throw new RangeError("guess and answer must be finite");
  const errorPoints = Math.abs(guess - answer) * 100;
  return { correct: errorPoints <= tolerancePoints + 1e-9, errorPoints };
}
