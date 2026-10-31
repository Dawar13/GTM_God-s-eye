"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getProfileManager, userStore } from "@/lib/user/manager";

/** Per-profile keys Practice mode uses (see src/lib/user). Nothing else is stored. */
export const PRACTICE_KEYS = {
  on: "practice.on",
  scenarios: "practice.scenarios",
  streak: "practice.streak",
  seed: "practice.seed",
} as const;

const cache = new Map<string, { raw: string | null; value: unknown }>();

/** The stored value if it parses and passes `validate`, else the fallback. Stable between changes. */
export function readStored<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  const raw = userStore.get(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (validate(parsed)) value = parsed;
    } catch {
      // Corrupt text: use the fallback.
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function writeStored<T>(key: string, value: T): void {
  userStore.set(key, JSON.stringify(value));
}

/**
 * A per-person stored value that renders the fallback on the server and first paint, then
 * the stored value. `fallback` must be a stable reference (a module constant).
 */
export function useStored<T>(key: string, fallback: T, validate: (v: unknown) => v is T) {
  const value = useSyncExternalStore(
    getProfileManager().subscribe,
    () => readStored(key, fallback, validate),
    () => fallback,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readStored(key, fallback, validate);
      writeStored(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
    },
    [key, fallback, validate],
  );
  return [value, set] as const;
}
