/**
 * Where the VC math calculators start. When a calculator's own URL param is absent it starts
 * from our round; a param in the link always wins, and "Reset to example" writes the example
 * into the link so it stays the example.
 */
import { SAFE_DEFAULTS } from "@/lib/calculators/examples";
import { safeTabFor, type Instrument } from "./index";

export type SafeTab = "post" | "pre" | "both";

/** An amount from the link, else our raise. */
export function startingAmount(param: number | null, raiseUsd: number): number {
  return param ?? raiseUsd;
}

/** The SAFE tab from the link, else the one matching our instrument, else the example's. */
export function startingSafeTab(param: SafeTab | null, inst: Instrument): SafeTab {
  return param ?? safeTabFor(inst) ?? SAFE_DEFAULTS.st;
}
