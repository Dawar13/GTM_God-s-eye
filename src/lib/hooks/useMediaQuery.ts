"use client";

import { useSyncExternalStore } from "react";

/** Tracks a CSS media query. Server and first client render report `false`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The layout breakpoint: the rail and inspector change shape below it. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
