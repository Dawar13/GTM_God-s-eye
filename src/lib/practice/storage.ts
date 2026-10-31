"use client";

import { useCallback, useSyncExternalStore } from "react";

/** localStorage keys Practice mode uses. Nothing else is stored. */
export const PRACTICE_KEYS = {
  on: "atlas.practice.on",
  scenarios: "atlas.practice.scenarios",
  streak: "atlas.practice.streak",
  seed: "atlas.practice.seed",
} as const;

const CHANGE_EVENT = "atlas-practice-storage";

/** Kept when localStorage is blocked, so Practice still works for this visit. */
const memory = new Map<string, string>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    // Blocked or unavailable (private mode, server render): fall through to memory.
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, raw: string): void {
  memory.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Storage is full or blocked; the value lives in memory for this visit.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The stored value if it parses and passes `validate`, else the fallback. Stable between changes. */
export function readStored<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  const raw = readRaw(key);
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
  writeRaw(key, JSON.stringify(value));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * A localStorage-backed value that renders the fallback on the server and first paint, then
 * the stored value. `fallback` must be a stable reference (a module constant).
 */
export function useStored<T>(key: string, fallback: T, validate: (v: unknown) => v is T) {
  const value = useSyncExternalStore(
    subscribe,
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
