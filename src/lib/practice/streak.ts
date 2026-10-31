export type LastAnswer = { seed: number; guess: number; correct: boolean };

export type StreakState = {
  /** Correct answers in a row. */
  streak: number;
  best: number;
  answered: number;
  correct: number;
  /** The most recent answer, so a reload cannot score the same challenge twice. */
  last: LastAnswer | null;
};

export const EMPTY_STREAK: StreakState = {
  streak: 0,
  best: 0,
  answered: 0,
  correct: 0,
  last: null,
};

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function isStreakState(v: unknown): v is StreakState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (!(isCount(s.streak) && isCount(s.best) && isCount(s.answered) && isCount(s.correct)))
    return false;
  if (s.last === null) return true;
  if (!s.last || typeof s.last !== "object") return false;
  const last = s.last as Record<string, unknown>;
  return isCount(last.seed) && typeof last.guess === "number" && typeof last.correct === "boolean";
}

/** Records one answer. A challenge that was already answered is not scored again. */
export function recordAnswer(state: StreakState, answer: LastAnswer): StreakState {
  if (state.last?.seed === answer.seed) return state;
  const streak = answer.correct ? state.streak + 1 : 0;
  return {
    streak,
    best: Math.max(state.best, streak),
    answered: state.answered + 1,
    correct: state.correct + (answer.correct ? 1 : 0),
    last: answer,
  };
}

export function isSeed(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 4_294_967_295;
}

export const isFlag = (v: unknown): v is boolean => typeof v === "boolean";
