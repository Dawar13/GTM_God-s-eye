import { POOL, initialSnapshot, simulate, type Snapshot } from "./cap-table";
import { CAP_TABLE_ROUNDING, assertPositive, type Rounding } from "./rounding";
import { distribute, type PreferredClass } from "./waterfall";

/**
 * A path from the founders to an exit for the Practice scenario mode: a few priced rounds
 * run through the cap-table `simulate`, then the payout at each exit value through the
 * liquidation `distribute`.
 *
 * Conventions: every round's investors hold one class of 1x non-participating preferred;
 * the latest round is paid first (seniority rises with the round); the unissued option pool
 * is not paid at an exit (nobody holds those shares), so a founder's payout share can be a
 * little above their fully diluted ownership.
 */
export const SCENARIO_FOUNDERS = "founders";

export type ScenarioRound = { preMoney: number; investment: number };

export type ScenarioInput = {
  founderShares: number;
  /** Unissued pool at the start. */
  poolShares: number;
  rounds: readonly ScenarioRound[];
  exitValues: readonly number[];
  rounding?: Rounding;
};

export type ExitOutcome = {
  exitValue: number;
  founderPayout: number;
  /** Founder payout as a share of the exit value. */
  founderShareOfExit: number;
  investors: { name: string; total: number; converted: boolean }[];
};

export type ScenarioOutcome = {
  /** The start, then one snapshot per round. */
  snapshots: Snapshot[];
  /** Founders' fully diluted ownership at the start and after each round. */
  founderOwnership: number[];
  finalFounderOwnership: number;
  totalRaised: number;
  exits: ExitOutcome[];
};

export function roundName(index: number): string {
  return `Round ${index + 1}`;
}

export function scenarioOutcome(input: ScenarioInput): ScenarioOutcome {
  const { founderShares, poolShares, rounds, exitValues } = input;
  const rounding = input.rounding ?? CAP_TABLE_ROUNDING;
  assertPositive("founderShares", founderShares);
  assertPositive("poolShares", poolShares);
  if (rounds.length === 0) throw new RangeError("a scenario needs at least one round");
  const holdings = { [SCENARIO_FOUNDERS]: founderShares, [POOL]: poolShares };
  const steps = rounds.map((r, i) => ({
    kind: "priced_round" as const,
    label: roundName(i),
    preMoney: r.preMoney,
    investment: r.investment,
    investors: { [roundName(i)]: r.investment },
  }));
  const snapshots = [initialSnapshot(holdings), ...simulate({ holdings, steps, rounding })];
  const final = snapshots[snapshots.length - 1] as Snapshot;

  const classes: PreferredClass[] = rounds.map((r, i) => ({
    name: roundName(i),
    invested: r.investment,
    shares: final.holdings[roundName(i)] as number,
    multiple: 1,
    participation: "none",
    seniority: i + 1,
  }));

  return {
    snapshots,
    founderOwnership: snapshots.map((s) => s.ownership[SCENARIO_FOUNDERS] as number),
    finalFounderOwnership: final.ownership[SCENARIO_FOUNDERS] as number,
    totalRaised: rounds.reduce((a, r) => a + r.investment, 0),
    exits: exitValues.map((exitValue) => {
      const r = distribute({
        exitValue,
        commonShares: final.holdings[SCENARIO_FOUNDERS] as number,
        classes,
      });
      return {
        exitValue,
        founderPayout: r.common,
        founderShareOfExit: exitValue > 0 ? r.common / exitValue : 0,
        investors: r.classes.map((c) => ({
          name: c.name,
          total: c.total,
          converted: c.converted,
        })),
      };
    }),
  };
}
