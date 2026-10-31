import { SECTOR_LABELS } from "@/lib/format/labels";
import type { Investor } from "@/lib/schema";
import type { Sector } from "@/lib/schema/enums";

export type SectorBar = { sector: Sector; label: string; weight: number };

export type SectorBars = {
  /** Sectors with a weight above zero, largest first. Weights sum to 1. */
  bars: SectorBar[];
  method: string | null;
  inputs: string[];
  /** True when the investor has no sector weights at all (nothing is drawn). */
  unknown: boolean;
};

/** An investor's thesis vector as bars from zero. A missing vector is unknown, not all zeros. */
export function sectorBars(weights: Investor["sector_weights"]): SectorBars {
  if (!weights) return { bars: [], method: null, inputs: [], unknown: true };
  const bars = (Object.entries(weights.value) as [Sector, number | undefined][])
    .filter((e): e is [Sector, number] => typeof e[1] === "number" && e[1] > 0)
    .map(([sector, weight]) => ({ sector, label: SECTOR_LABELS[sector], weight }))
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
  return { bars, method: weights.method, inputs: weights.inputs, unknown: false };
}
