"use client";

import { useCallback, useMemo } from "react";
import { userStore } from "@/lib/user/manager";
import { useUserRaw } from "@/lib/user/use-profile";
import { OUTREACH_TIERS, type OutreachTier, type TierOverrides } from "@/lib/viz/transforms/strategy";

/** Per-profile key (see src/lib/user) for manual tier changes: a JSON object of investor id to "A" | "B" | "C". */
export const TIER_OVERRIDES_KEY = "strategy.tierOverrides";

/** Reads the stored JSON; anything malformed or with an unknown tier is dropped. */
export function parseOverrides(text: string | null): TierOverrides {
  if (!text) return {};
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
    const out: Record<string, OutreachTier> = {};
    for (const [id, tier] of Object.entries(raw)) {
      if (id.startsWith("inv_") && OUTREACH_TIERS.includes(tier as OutreachTier)) {
        out[id] = tier as OutreachTier;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function write(value: TierOverrides) {
  if (Object.keys(value).length === 0) userStore.remove(TIER_OVERRIDES_KEY);
  else userStore.set(TIER_OVERRIDES_KEY, JSON.stringify(value));
}

/**
 * Manual tier changes. Stored for the active person in this browser only (never written to data). The server render
 * and the first client render see none; the stored ones appear after hydration.
 */
export function useTierOverrides() {
  const text = useUserRaw(TIER_OVERRIDES_KEY);
  const overrides = useMemo(() => parseOverrides(text), [text]);

  const move = useCallback((id: string, tier: OutreachTier | null) => {
    const next = { ...parseOverrides(userStore.get(TIER_OVERRIDES_KEY)) };
    if (tier === null) delete next[id];
    else next[id] = tier;
    write(next);
  }, []);
  const reset = useCallback(() => write({}), []);
  return { overrides, move, reset };
}
