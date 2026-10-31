import { describe, expect, it } from "vitest";
import { generateChallenge, scenarioOutcome, type Challenge } from "@/lib/finance";
import { challengePrompt, challengeWorked } from "@/lib/practice/copy";
import {
  MAX_SAVED,
  SCENARIO_DEFAULTS,
  addSaved,
  decodeExits,
  decodeRounds,
  encodeExits,
  encodeRounds,
  isSavedList,
  nextName,
  removeSaved,
  type SavedScenario,
} from "@/lib/practice/scenarios";
import { EMPTY_STREAK, isStreakState, recordAnswer } from "@/lib/practice/streak";
import { readStored, writeStored } from "@/lib/practice/storage";
import { finalOwnershipSegments, roundRows } from "@/lib/viz/transforms/calcScenario";

const saved = (n: number): SavedScenario => ({
  id: `id${n}`,
  name: `Scenario ${n}`,
  rounds: SCENARIO_DEFAULTS.rounds,
  exits: SCENARIO_DEFAULTS.exits,
});

describe("scenario URL codec", () => {
  it("round-trips the default path and exits", () => {
    expect(decodeRounds(encodeRounds(SCENARIO_DEFAULTS.rounds))).toEqual(SCENARIO_DEFAULTS.rounds);
    expect(decodeExits(encodeExits(SCENARIO_DEFAULTS.exits))).toEqual(SCENARIO_DEFAULTS.exits);
  });

  it("encodes a path as pre_inv joined by ~", () => {
    expect(encodeRounds(SCENARIO_DEFAULTS.rounds)).toBe(
      "10000000_2000000~30000000_6000000~86400000_21600000",
    );
  });

  it.each(["", "1_2", "1_2~3_4", "1_2~3_4~5_x", "1_2~3_4~5_0", "1_2_3~3_4~5_6", "1_2~3_4~5_6~7_8"])(
    "rejects a bad path %j",
    (text) => {
      expect(decodeRounds(text)).toBeNull();
    },
  );

  it.each(["", "1_2", "1_2_x", "1_2_-3", "1_2_3_4"])("rejects bad exits %j", (text) => {
    expect(decodeExits(text)).toBeNull();
  });
});

describe("saved scenarios", () => {
  it("saves up to five and refuses the sixth", () => {
    let list: SavedScenario[] = [];
    for (let i = 1; i <= MAX_SAVED; i++) {
      const r = addSaved(list, saved(i));
      expect(r.saved).toBe(true);
      list = r.list;
    }
    const sixth = addSaved(list, saved(6));
    expect(sixth.saved).toBe(false);
    expect(sixth.list).toHaveLength(5);
  });

  it("removes by id and names the next scenario without clashing", () => {
    const list = [saved(1), saved(2), saved(3)];
    expect(removeSaved(list, "id2").map((s) => s.id)).toEqual(["id1", "id3"]);
    expect(nextName(removeSaved(list, "id2"))).toBe("Scenario 2");
    expect(nextName(list)).toBe("Scenario 4");
  });

  it("accepts only well-formed stored lists", () => {
    expect(isSavedList([saved(1)])).toBe(true);
    expect(isSavedList([{ ...saved(1), exits: [1, 2] }])).toBe(false);
    expect(isSavedList([{ ...saved(1), rounds: [] }])).toBe(false);
    expect(isSavedList("nope")).toBe(false);
    expect(isSavedList(Array.from({ length: 6 }, (_, i) => saved(i)))).toBe(false);
  });
});

describe("streak", () => {
  it("counts a run, resets on a miss, keeps the best", () => {
    let s = recordAnswer(EMPTY_STREAK, { seed: 1, guess: 0.2, correct: true });
    s = recordAnswer(s, { seed: 2, guess: 0.2, correct: true });
    expect(s).toMatchObject({ streak: 2, best: 2, answered: 2, correct: 2 });
    s = recordAnswer(s, { seed: 3, guess: 0.9, correct: false });
    expect(s).toMatchObject({ streak: 0, best: 2, answered: 3, correct: 2 });
    s = recordAnswer(s, { seed: 4, guess: 0.2, correct: true });
    expect(s).toMatchObject({ streak: 1, best: 2 });
  });

  it("does not score the same challenge twice", () => {
    const once = recordAnswer(EMPTY_STREAK, { seed: 9, guess: 0.2, correct: true });
    expect(recordAnswer(once, { seed: 9, guess: 0.2, correct: true })).toBe(once);
  });

  it("validates stored state", () => {
    expect(isStreakState(EMPTY_STREAK)).toBe(true);
    expect(isStreakState({ ...EMPTY_STREAK, streak: -1 })).toBe(false);
    expect(isStreakState({ streak: 1 })).toBe(false);
  });
});

describe("storage without a browser", () => {
  it("falls back to memory when localStorage is not there, and ignores corrupt values", () => {
    const isNum = (v: unknown): v is number => typeof v === "number";
    expect(readStored("t.missing", 7, isNum)).toBe(7);
    writeStored("t.value", 12);
    expect(readStored("t.value", 7, isNum)).toBe(12);
    writeStored("t.value", "text");
    expect(readStored("t.value", 7, isNum)).toBe(7);
  });
});

describe("challenge copy", () => {
  const investorPost: Challenge = {
    kind: "investor_post",
    seed: 1,
    preMoney: 8e6,
    investment: 2e6,
    answer: 0.2,
  };
  it("writes the question and the worked answer (hand-checked)", () => {
    expect(challengePrompt(investorPost)).toContain("$2M at a $8M pre-money");
    expect(challengeWorked(investorPost)).toEqual([
      "Post-money = pre-money + investment = $8M + $2M = $10M",
      "New investors own investment ÷ post-money = $2M ÷ $10M = 20.0%",
    ]);
  });

  it("works through founders after one round: 70% x 80% = 56%", () => {
    const c: Challenge = {
      kind: "founder_after",
      seed: 1,
      founderBefore: 0.7,
      preMoney: 12e6,
      investment: 3e6,
      answer: 0.56,
    };
    const lines = challengeWorked(c);
    expect(lines[1]).toContain("= 80.0%");
    expect(lines[2]).toBe("Founders own 70.0% × 80.0% = 56.0%");
  });

  it("every generated challenge has a prompt and a worked answer ending in its answer", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const c = generateChallenge(seed);
      expect(challengePrompt(c).length).toBeGreaterThan(20);
      const lines = challengeWorked(c);
      expect(lines[lines.length - 1]).toMatch(/\d+\.\d%$/);
    }
  });
});

describe("scenario chart transforms", () => {
  const rounds = SCENARIO_DEFAULTS.rounds;
  const out = scenarioOutcome({
    founderShares: 9_000_000,
    poolShares: 1_000_000,
    rounds,
    exitValues: SCENARIO_DEFAULTS.exits,
  });

  it("ownership segments sum to 100% and name the founders first", () => {
    const segs = finalOwnershipSegments(out);
    expect(segs[0]?.key).toBe("founders");
    expect(segs.reduce((a, s) => a + s.fraction, 0)).toBeCloseTo(1, 9);
    // Hand-checked: founders hold 9,000,000 of 18,000,000 shares after three rounds.
    expect(segs[0]?.fraction).toBe(0.5);
  });

  it("round rows carry the terms, post-money and founder stake after each round", () => {
    const rows = roundRows(out, rounds);
    expect(rows.map((r) => r.founderOwnership)).toEqual([0.75, 0.625, 0.5]);
    expect(rows[0]).toMatchObject({ postMoney: 12e6, pricePerShare: 1 });
    expect(rows[1]).toMatchObject({ postMoney: 36e6, pricePerShare: 2.5 });
  });
});
