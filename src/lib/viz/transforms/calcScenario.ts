import { POOL, SCENARIO_FOUNDERS, roundName, type ScenarioOutcome } from "@/lib/finance";
import { CATEGORICAL } from "@/lib/viz";

export type OwnershipSegment = { key: string; label: string; fraction: number; color: string };

/** Fully diluted ownership after the last round, as ShareBar segments summing to 100%. */
export function finalOwnershipSegments(outcome: ScenarioOutcome): OwnershipSegment[] {
  const final = outcome.snapshots[outcome.snapshots.length - 1];
  if (!final) return [];
  const own = final.ownership;
  const rounds = outcome.snapshots.slice(1).map((_, i) => ({
    key: roundName(i),
    label: `${roundName(i)} investors`,
    fraction: own[roundName(i)] ?? 0,
    color: CATEGORICAL[(i + 1) % CATEGORICAL.length] as string,
  }));
  return [
    {
      key: SCENARIO_FOUNDERS,
      label: "Founders",
      fraction: own[SCENARIO_FOUNDERS] ?? 0,
      color: CATEGORICAL[0] as string,
    },
    ...rounds,
    {
      key: POOL,
      label: "Option pool (unissued)",
      fraction: own[POOL] ?? 0,
      color: "#C4C9D1",
    },
  ].filter((s) => s.fraction > 0);
}

export type RoundRow = {
  key: string;
  label: string;
  preMoney: number;
  investment: number;
  postMoney: number;
  pricePerShare: number | null;
  founderOwnership: number;
};

/** One row per round for the path table: the terms and the founders' stake after it. */
export function roundRows(
  outcome: ScenarioOutcome,
  rounds: readonly { preMoney: number; investment: number }[],
): RoundRow[] {
  return rounds.map((r, i) => ({
    key: roundName(i),
    label: roundName(i),
    preMoney: r.preMoney,
    investment: r.investment,
    postMoney: r.preMoney + r.investment,
    pricePerShare: outcome.snapshots[i + 1]?.financing?.pricePerShare ?? null,
    founderOwnership: outcome.founderOwnership[i + 1] as number,
  }));
}
