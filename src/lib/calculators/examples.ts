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

export const NOTE_DEFAULTS = {
  /** Note principal. */
  amt: 500_000,
  rate: 0.08,
  cmp: "simple" as "simple" | "annual" | "monthly",
  /** Months from signing to the priced round. */
  mo: 18,
  cap: 6_000_000,
  /** 1 = the note has no valuation cap. */
  nc: 0,
  /** Cap basis: pre-money or post-money. */
  cb: "pre" as "pre" | "post",
  disc: 0.2,
  rpre: 10_000_000,
  rinv: 3_000_000,
  fd: 10_000_000,
};

export const LIQUIDATION_DEFAULTS = {
  cs: 6_000_000,
  ai: 4_000_000,
  ash: 2_000_000,
  am: 1,
  ap: "none" as "none" | "full" | "capped",
  ac: 3,
  bi: 12_000_000,
  bsh: 2_000_000,
  bm: 1,
  bp: "none" as "none" | "full" | "capped",
  bc: 3,
  /** Seniority: Series B paid first, or both classes pari passu. */
  sen: "b" as "b" | "pari",
  max: 100_000_000,
  /** x-axis scale. */
  sc: "lin" as "lin" | "log",
  /** Exit value to read off the curves. */
  x: 40_000_000,
};

export const VC_METHOD_DEFAULTS = {
  ex: 1_000_000_000,
  tm: 10,
  ret: 0.5,
  inv: 5_000_000,
};

export const FUND_MATH_DEFAULTS = {
  fund: 50_000_000,
  own: 0.1,
  rnd: 2,
  dil: 0.2,
  mult: 1,
  ex: 500_000_000,
};
