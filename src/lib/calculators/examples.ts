/**
 * Example inputs for the VC math calculators. They are illustrative, not data: no real
 * company is behind them, and the UI labels them "Example".
 */

/** The app's assumed raise: a $1.0M post-money SAFE (DECISIONS, Phase 2 start; editable in Strategy). */
export const EXAMPLE_RAISE_USD = 1_000_000;

export const ROUND_BUILDER_DEFAULTS = {
  mode: "pre" as "pre" | "post",
  val: 9_000_000,
  inv: EXAMPLE_RAISE_USD,
  fd: 10_000_000,
};

export const OPTION_POOL_DEFAULTS = {
  pre: 9_000_000,
  inv: EXAMPLE_RAISE_USD,
  fsh: 9_000_000,
  pool: 1_000_000,
  tgt: 0.1,
};

export const SAFE_DEFAULTS = {
  st: "post" as "post" | "pre" | "both",
  amt: EXAMPLE_RAISE_USD,
  cap: 10_000_000,
  /** 1 = the SAFE has no valuation cap. */
  nc: 0,
  disc: 0,
  rpre: 20_000_000,
  rinv: 5_000_000,
  fsh: 9_000_000,
  pool: 1_000_000,
  ptgt: 0,
};

export const CAP_TABLE_DEFAULTS = {
  fsh: 9_000_000,
  pool: 1_000_000,
  /** Encoded steps (see capTableCodec): a $1.0M post-money SAFE, then a priced round. */
  steps: "ps_1000000_10000000_0~r_20000000_5000000_0.1",
};
