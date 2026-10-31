import { exitNeededToReturnFund, vcMethod } from "@/lib/finance";

export type FundBar = {
  key: string;
  label: string;
  fundSize: number;
  /** Exit that returns the fund at the given ownership. Bars start at zero. */
  exitNeeded: number;
  selected: boolean;
};

export const FUND_SIZE_PRESETS = [50e6, 100e6, 250e6, 500e6, 1e9] as const;

/**
 * Exit needed to return the fund (× multiple) at one ownership, for a ladder of fund sizes
 * plus the selected size. Same ownership in every bar, so the only thing that changes is
 * the fund. `formatSize` labels each bar, passed in so this stays free of display code.
 */
export function exitByFundSize(args: {
  selectedFundSize: number;
  ownershipAtExit: number;
  multiple: number;
  presets?: readonly number[];
  formatSize: (n: number) => string;
}): FundBar[] {
  const { selectedFundSize, ownershipAtExit, multiple, formatSize } = args;
  const sizes = [...new Set([...(args.presets ?? FUND_SIZE_PRESETS), selectedFundSize])].sort(
    (a, b) => a - b,
  );
  return sizes.map((fundSize) => ({
    key: String(fundSize),
    label: formatSize(fundSize),
    fundSize,
    exitNeeded: exitNeededToReturnFund(fundSize, ownershipAtExit, multiple),
    selected: fundSize === selectedFundSize,
  }));
}

export type Gauge = {
  /** Scale end: a little past the larger of the two values. The scale starts at 0. */
  max: number;
  /** Where the assumed exit ends, 0..1 of the scale. */
  assumedFrac: number;
  /** Where the required exit sits, 0..1 of the scale. */
  requiredFrac: number;
  /** True when the assumed exit is at or above the required exit. */
  reaches: boolean;
};

/** Geometry for the required-exit bullet bar: both marks on one linear scale from zero. */
export function exitGauge(required: number, assumed: number): Gauge {
  if (!(required > 0) || !(assumed > 0) || !Number.isFinite(required + assumed))
    throw new RangeError("required and assumed exit must be positive");
  const max = Math.max(required, assumed) * 1.1;
  return {
    max,
    assumedFrac: assumed / max,
    requiredFrac: required / max,
    reaches: assumed >= required,
  };
}

export type PostMoneyBar = { multiple: number; postMoney: number; selected: boolean };

/**
 * Implied post-money at several target multiples, same exit, retention and investment.
 * A preset multiple the exit cannot support (post-money would not exceed the investment)
 * is left out; the selected multiple still throws so the page can show the message.
 */
export function postMoneyByMultiple(args: {
  exitValue: number;
  retention: number;
  investment: number;
  selectedMultiple: number;
  multiples?: readonly number[];
}): PostMoneyBar[] {
  const all = [...new Set([...(args.multiples ?? [3, 5, 10, 20, 30]), args.selectedMultiple])].sort(
    (a, b) => a - b,
  );
  const bars: PostMoneyBar[] = [];
  for (const multiple of all) {
    try {
      const r = vcMethod({
        exitValue: args.exitValue,
        targetMultiple: multiple,
        retention: args.retention,
        investment: args.investment,
      });
      bars.push({ multiple, postMoney: r.postMoney, selected: multiple === args.selectedMultiple });
    } catch (e) {
      if (!(e instanceof RangeError) || multiple === args.selectedMultiple) throw e;
    }
  }
  return bars;
}
