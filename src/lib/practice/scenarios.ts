import { createParser } from "nuqs";
import { CAP_TABLE_DEFAULTS } from "@/lib/calculators/examples";
import type { ScenarioRound } from "@/lib/finance";

/** Starting shares and pool for Practice scenarios: the cap-table example's. */
export const SCENARIO_START = {
  founderShares: CAP_TABLE_DEFAULTS.fsh,
  poolShares: CAP_TABLE_DEFAULTS.pool,
};

export const ROUND_COUNT = 3;
export const EXIT_COUNT = 3;
export const MAX_SAVED = 5;

/** Illustrative starting path and exits (an example, not data). */
export const SCENARIO_DEFAULTS = {
  rounds: [
    { preMoney: 10_000_000, investment: 2_000_000 },
    { preMoney: 30_000_000, investment: 6_000_000 },
    { preMoney: 86_400_000, investment: 21_600_000 },
  ] satisfies ScenarioRound[],
  exits: [20_000_000, 100_000_000, 500_000_000],
};

const isPositive = (n: number) => Number.isFinite(n) && n > 0;

/** "10000000_2000000~30000000_6000000~86400000_21600000"; null when not exactly three valid rounds. */
export function decodeRounds(text: string): ScenarioRound[] | null {
  const parts = text.split("~");
  if (parts.length !== ROUND_COUNT) return null;
  const rounds: ScenarioRound[] = [];
  for (const p of parts) {
    const fields = p.split("_").map(Number);
    const [pre, inv] = fields;
    if (fields.length !== 2 || pre === undefined || inv === undefined) return null;
    if (!isPositive(pre) || !isPositive(inv)) return null;
    rounds.push({ preMoney: pre, investment: inv });
  }
  return rounds;
}

export const encodeRounds = (rounds: readonly ScenarioRound[]) =>
  rounds.map((r) => `${r.preMoney}_${r.investment}`).join("~");

/** "20000000_100000000_500000000"; null when not exactly three positive values. */
export function decodeExits(text: string): number[] | null {
  const parts = text.split("_").map(Number);
  if (parts.length !== EXIT_COUNT || !parts.every(isPositive)) return null;
  return parts;
}

export const encodeExits = (exits: readonly number[]) => exits.join("_");

export const roundsParser = createParser<ScenarioRound[]>({
  parse: decodeRounds,
  serialize: encodeRounds,
  eq: (a, b) => encodeRounds(a) === encodeRounds(b),
}).withDefault(SCENARIO_DEFAULTS.rounds);

export const exitsParser = createParser<number[]>({
  parse: decodeExits,
  serialize: encodeExits,
  eq: (a, b) => encodeExits(a) === encodeExits(b),
}).withDefault(SCENARIO_DEFAULTS.exits);

export type SavedScenario = {
  id: string;
  name: string;
  rounds: ScenarioRound[];
  exits: number[];
};

export function isSavedScenario(v: unknown): v is SavedScenario {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (typeof s.id !== "string" || typeof s.name !== "string") return false;
  if (!Array.isArray(s.rounds) || !Array.isArray(s.exits)) return false;
  const rounds = s.rounds as { preMoney?: unknown; investment?: unknown }[];
  if (rounds.length !== ROUND_COUNT) return false;
  const roundsOk = rounds.every(
    (r) =>
      r !== null &&
      typeof r === "object" &&
      typeof r.preMoney === "number" &&
      isPositive(r.preMoney) &&
      typeof r.investment === "number" &&
      isPositive(r.investment),
  );
  const exits = s.exits as unknown[];
  const exitsOk =
    exits.length === EXIT_COUNT && exits.every((x) => typeof x === "number" && isPositive(x));
  return roundsOk && exitsOk;
}

export function isSavedList(v: unknown): v is SavedScenario[] {
  return Array.isArray(v) && v.length <= MAX_SAVED && v.every(isSavedScenario);
}

/** Adds a scenario; a full list (5) is returned unchanged with `saved: false`. */
export function addSaved(
  list: readonly SavedScenario[],
  scenario: SavedScenario,
): { list: SavedScenario[]; saved: boolean } {
  if (list.length >= MAX_SAVED) return { list: [...list], saved: false };
  return { list: [...list, scenario], saved: true };
}

export const removeSaved = (list: readonly SavedScenario[], id: string) =>
  list.filter((s) => s.id !== id);

/** The next default name: "Scenario 1", "Scenario 2", ... skipping names in use. */
export function nextName(list: readonly SavedScenario[]): string {
  const used = new Set(list.map((s) => s.name));
  for (let i = 1; ; i++) if (!used.has(`Scenario ${i}`)) return `Scenario ${i}`;
}
