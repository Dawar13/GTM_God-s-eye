import { accrue, type Compounding } from "./note";
import { FULL_PRECISION, ownershipOf, roundShares, type Rounding } from "./rounding";
import {
  equityFinancing,
  type ConvertingNote,
  type FinancingResult,
  type PostMoneySafe,
  type PreMoneySafe,
} from "./safe";

export type CapTableStep =
  | ({ kind: "post_money_safe"; label?: string } & PostMoneySafe)
  | ({ kind: "pre_money_safe"; label?: string } & PreMoneySafe)
  | {
      kind: "note";
      label?: string;
      holder: string;
      principal: number;
      rate: number;
      compounding: Compounding;
      /** Years from issue until it converts at the next priced round. */
      yearsToConversion: number;
      cap: number | null;
      discount: number | null;
    }
  | {
      kind: "pool_top_up";
      label?: string;
      /** Add this many shares, or top the available pool up to this share of FD. */
      shares?: number;
      targetPct?: number;
    }
  | {
      kind: "priced_round";
      label?: string;
      preMoney: number;
      investment: number;
      investors?: Record<string, number>;
      proRata?: Record<string, number>;
      pool?: { increaseShares: number } | { targetPostPct: number };
    };

export type Snapshot = {
  label: string;
  holdings: Record<string, number>;
  totalFD: number;
  ownership: Record<string, number>;
  /** SAFEs and notes issued but not yet converted. */
  pendingConvertibles: number;
  /** Set for priced rounds. */
  financing?: FinancingResult;
};

export const POOL = "pool";

/** The cap table before any step: the starting holdings, fully diluted, nothing pending. */
export function initialSnapshot(holdings: Record<string, number>, label = "Start"): Snapshot {
  const totalFD = Object.values(holdings).reduce((a, b) => a + b, 0);
  return {
    label,
    holdings: { ...holdings },
    totalFD,
    ownership: ownershipOf(holdings),
    pendingConvertibles: 0,
  };
}

/**
 * Applies SAFEs, notes, pool top-ups and priced rounds in order; outstanding
 * SAFEs and notes convert at the next priced round. Returns one snapshot per
 * step. Ownership is fully diluted and counts the unissued pool.
 */
export function simulate(args: {
  holdings: Record<string, number>;
  steps: CapTableStep[];
  rounding?: Rounding;
}): Snapshot[] {
  const rounding = args.rounding ?? FULL_PRECISION;
  let holdings = { ...args.holdings };
  let postSafes: PostMoneySafe[] = [];
  let preSafes: PreMoneySafe[] = [];
  let notes: (ConvertingNote & {
    years: number;
    principal: number;
    rate: number;
    compounding: Compounding;
  })[] = [];
  const out: Snapshot[] = [];

  const snapshot = (label: string, financing?: FinancingResult): Snapshot => {
    const totalFD = Object.values(holdings).reduce((a, b) => a + b, 0);
    return {
      label,
      holdings: { ...holdings },
      totalFD,
      ownership: ownershipOf(holdings),
      pendingConvertibles: postSafes.length + preSafes.length + notes.length,
      ...(financing ? { financing } : {}),
    };
  };

  for (const [i, step] of args.steps.entries()) {
    const label = step.label ?? `${step.kind.replace(/_/g, " ")} ${i + 1}`;
    switch (step.kind) {
      case "post_money_safe": {
        postSafes.push({
          holder: step.holder,
          amount: step.amount,
          postMoneyCap: step.postMoneyCap,
          discount: step.discount,
          mfn: step.mfn,
        });
        out.push(snapshot(label));
        break;
      }
      case "pre_money_safe": {
        preSafes.push({
          holder: step.holder,
          amount: step.amount,
          preMoneyCap: step.preMoneyCap,
          discount: step.discount,
        });
        out.push(snapshot(label));
        break;
      }
      case "note": {
        notes.push({
          holder: step.holder,
          principal: step.principal,
          rate: step.rate,
          compounding: step.compounding,
          years: step.yearsToConversion,
          accrued: 0,
          cap: step.cap,
          discount: step.discount,
        });
        out.push(snapshot(label));
        break;
      }
      case "pool_top_up": {
        const total = Object.values(holdings).reduce((a, b) => a + b, 0);
        const available = holdings[POOL] ?? 0;
        let add = step.shares ?? 0;
        if (step.targetPct !== undefined) {
          if (!(step.targetPct >= 0 && step.targetPct < 1))
            throw new RangeError("targetPct must be in [0, 1)");
          add = Math.max(0, (step.targetPct * total - available) / (1 - step.targetPct));
        }
        holdings[POOL] = available + roundShares(add, rounding);
        out.push(snapshot(label));
        break;
      }
      case "priced_round": {
        const financing = equityFinancing({
          holdings,
          poolKey: POOL,
          postMoneySafes: postSafes,
          preMoneySafes: preSafes,
          notes: notes.map((n) => ({
            holder: n.holder,
            accrued: accrue({
              principal: n.principal,
              rate: n.rate,
              compounding: n.compounding,
              years: n.years,
            }),
            cap: n.cap,
            discount: n.discount,
          })),
          preMoney: step.preMoney,
          investment: step.investment,
          investors: step.investors,
          proRata: step.proRata,
          pool: step.pool,
          rounding,
        });
        holdings = financing.holdings;
        postSafes = [];
        preSafes = [];
        notes = [];
        out.push(snapshot(label, financing));
        break;
      }
    }
  }
  return out;
}
