"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { OUTREACH_TIERS, type OutreachTier, type TierOverrides } from "@/lib/viz/transforms/strategy";

/** localStorage key for manual tier changes: a JSON object of investor id to "A" | "B" | "C". */
export const TIER_OVERRIDES_KEY = "atlas.strategy.tierOverrides";

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

/** Text last written this visit; used when storage is blocked, and as the live value after a write. */
let memory: string | null | undefined;
const listeners = new Set<() => void>();

function snapshot(): string | null {
  if (memory !== undefined) return memory;
  try {
    return window.localStorage.getItem(TIER_OVERRIDES_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(value: TierOverrides) {
  const text = Object.keys(value).length === 0 ? null : JSON.stringify(value);
  memory = text;
  try {
    if (text === null) window.localStorage.removeItem(TIER_OVERRIDES_KEY);
    else window.localStorage.setItem(TIER_OVERRIDES_KEY, text);
  } catch {
    /* storage blocked: the changes last for this visit only */
  }
  listeners.forEach((l) => l());
}

/**
 * Manual tier changes. Stored in this browser only (never written to data). The server render
 * and the first client render see none; the stored ones appear after hydration.
 */
export function useTierOverrides() {
  const text = useSyncExternalStore(subscribe, snapshot, () => null);
  const overrides = useMemo(() => parseOverrides(text), [text]);

  const move = useCallback((id: string, tier: OutreachTier | null) => {
    const next = { ...parseOverrides(snapshot()) };
    if (tier === null) delete next[id];
    else next[id] = tier;
    write(next);
  }, []);
  const reset = useCallback(() => write({}), []);
  return { overrides, move, reset };
}
