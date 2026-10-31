import { createParser } from "nuqs";
import { CAP_TABLE_DEFAULTS } from "./examples";
import type { CapTableStep } from "@/lib/finance";

/**
 * The cap table's step list as the UI edits it, and its URL form. Steps are joined by "~",
 * fields by "_", an empty field is null. Examples:
 *   ps_1000000_10000000_0      post-money SAFE: amount, cap, discount
 *   rs_500000__0.2             pre-money SAFE with no cap and a 20% discount
 *   n_250000_0.06_18_8000000_0 note: principal, rate, months to conversion, cap, discount
 *   t_0.1                      pool top-up to 10% of fully diluted shares
 *   r_20000000_5000000_0.1     priced round: pre-money, investment, pool target (0 = none)
 */
export type StepDraft =
  | { kind: "ps" | "rs"; amount: number; cap: number | null; discount: number }
  | {
      kind: "n";
      principal: number;
      rate: number;
      months: number;
      cap: number | null;
      discount: number;
    }
  | { kind: "t"; target: number }
  | { kind: "r"; pre: number; inv: number; pool: number };

export const MAX_STEPS = 12;

export const STEP_LABEL: Record<StepDraft["kind"], string> = {
  ps: "Post-money SAFE",
  rs: "Pre-money SAFE",
  n: "Convertible note",
  t: "Pool top-up",
  r: "Priced round",
};

/** What "Add" creates, from the example's numbers. */
export function newStep(kind: StepDraft["kind"]): StepDraft {
  switch (kind) {
    case "ps":
    case "rs":
      return { kind, amount: 500_000, cap: 10_000_000, discount: 0 };
    case "n":
      return { kind, principal: 250_000, rate: 0.06, months: 18, cap: 8_000_000, discount: 0.2 };
    case "t":
      return { kind, target: 0.1 };
    case "r":
      return { kind, pre: 20_000_000, inv: 5_000_000, pool: 0 };
  }
}

const num = (n: number | null) => (n === null ? "" : String(n));

export function encodeSteps(steps: readonly StepDraft[]): string {
  return steps
    .map((s) => {
      switch (s.kind) {
        case "ps":
        case "rs":
          return [s.kind, num(s.amount), num(s.cap), num(s.discount)].join("_");
        case "n":
          return [
            "n",
            num(s.principal),
            num(s.rate),
            num(s.months),
            num(s.cap),
            num(s.discount),
          ].join("_");
        case "t":
          return `t_${num(s.target)}`;
        case "r":
          return ["r", num(s.pre), num(s.inv), num(s.pool)].join("_");
      }
    })
    .join("~");
}

function field(text: string | undefined, nullable: true): number | null | undefined;
function field(text: string | undefined, nullable?: false): number | undefined;
function field(text: string | undefined, nullable = false): number | null | undefined {
  if (text === undefined) return undefined;
  if (text === "") return nullable ? null : undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/** Null when the text is not a valid step list; never throws. */
export function decodeSteps(text: string): StepDraft[] | null {
  if (text === "") return [];
  const out: StepDraft[] = [];
  for (const part of text.split("~")) {
    const [kind, ...f] = part.split("_");
    let step: StepDraft | null = null;
    if (kind === "ps" || kind === "rs") {
      const amount = field(f[0]);
      const cap = field(f[1], true);
      const discount = field(f[2]);
      if (amount !== undefined && cap !== undefined && discount !== undefined)
        step = { kind, amount, cap, discount };
    } else if (kind === "n") {
      const principal = field(f[0]);
      const rate = field(f[1]);
      const months = field(f[2]);
      const cap = field(f[3], true);
      const discount = field(f[4]);
      if (
        principal !== undefined &&
        rate !== undefined &&
        months !== undefined &&
        cap !== undefined &&
        discount !== undefined
      )
        step = { kind: "n", principal, rate, months, cap, discount };
    } else if (kind === "t") {
      const target = field(f[0]);
      if (target !== undefined) step = { kind: "t", target };
    } else if (kind === "r") {
      const pre = field(f[0]);
      const inv = field(f[1]);
      const pool = field(f[2]);
      if (pre !== undefined && inv !== undefined && pool !== undefined)
        step = { kind: "r", pre, inv, pool };
    }
    if (!step) return null;
    out.push(step);
    if (out.length > MAX_STEPS) return null;
  }
  return out;
}

/** nuqs parser for the `steps` param. */
export const stepsParser = createParser<StepDraft[]>({
  parse: decodeSteps,
  serialize: encodeSteps,
  eq: (a, b) => encodeSteps(a) === encodeSteps(b),
}).withDefault(decodeSteps(CAP_TABLE_DEFAULTS.steps) ?? []);

/**
 * Engine steps for the drafts. Labels are numbered per kind ("Post-money SAFE 1", "Round 2");
 * each SAFE or note holder and each priced round's investor group is named after its step, so
 * the chart can tell them apart.
 */
export function toCapTableSteps(drafts: readonly StepDraft[]): CapTableStep[] {
  const counts: Record<StepDraft["kind"], number> = { ps: 0, rs: 0, n: 0, t: 0, r: 0 };
  return drafts.map((d): CapTableStep => {
    const n = ++counts[d.kind];
    switch (d.kind) {
      case "ps": {
        const label = `SAFE ${n}`;
        return {
          kind: "post_money_safe",
          label,
          holder: label,
          amount: d.amount,
          postMoneyCap: d.cap,
          discount: d.discount || null,
        };
      }
      case "rs": {
        const label = `Pre-money SAFE ${n}`;
        return {
          kind: "pre_money_safe",
          label,
          holder: label,
          amount: d.amount,
          preMoneyCap: d.cap,
          discount: d.discount || null,
        };
      }
      case "n": {
        const label = `Note ${n}`;
        return {
          kind: "note",
          label,
          holder: label,
          principal: d.principal,
          rate: d.rate,
          compounding: "simple",
          yearsToConversion: d.months / 12,
          cap: d.cap,
          discount: d.discount || null,
        };
      }
      case "t":
        return { kind: "pool_top_up", label: `Pool ${n}`, targetPct: d.target };
      case "r": {
        const label = `Round ${n}`;
        return {
          kind: "priced_round",
          label,
          preMoney: d.pre,
          investment: d.inv,
          investors: { [`${label} investors`]: d.inv },
          ...(d.pool > 0 ? { pool: { targetPostPct: d.pool } } : {}),
        };
      }
    }
  });
}
