"use client";

import { useSyncExternalStore } from "react";

/** Chrome tokens that canvas and WebGL charts need as concrete colour strings. */
export type ThemeColors = {
  ink: string;
  ink2: string;
  muted: string;
  rule: string;
  panel: string;
  accent: string;
};

const LIGHT: ThemeColors = {
  ink: "#1a1f29",
  ink2: "#4a5160",
  muted: "#8a919c",
  rule: "#e3e6eb",
  panel: "#ffffff",
  accent: "#4f5bd5",
};

const TOKENS: Record<keyof ThemeColors, string> = {
  ink: "--ink",
  ink2: "--ink-2",
  muted: "--muted",
  rule: "--rule",
  panel: "--panel",
  accent: "--accent",
};

let cached: ThemeColors = LIGHT;

function snapshot(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const next = { ...LIGHT };
  for (const k of Object.keys(TOKENS) as (keyof ThemeColors)[]) {
    next[k] = s.getPropertyValue(TOKENS[k]).trim() || LIGHT[k];
  }
  // Same values keep the same object, so React sees no change.
  const same = (Object.keys(next) as (keyof ThemeColors)[]).every((k) => next[k] === cached[k]);
  if (!same) cached = next;
  return cached;
}

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/**
 * The tokens in src/styles/tokens.css resolved for the current theme, updated when the
 * `data-theme` attribute on <html> changes. The server render uses the light values.
 */
export function useThemeColors(): ThemeColors {
  return useSyncExternalStore(subscribe, snapshot, () => LIGHT);
}
