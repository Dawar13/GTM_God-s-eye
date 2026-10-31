import { parseAsFloat } from "nuqs";

/**
 * URL options shared by every calculator: defaults are left out of the URL (so the
 * example is a clean link), edits replace the history entry, and the page does not scroll.
 */
export const CALC_URL_OPTIONS = {
  clearOnDefault: true,
  history: "replace" as const,
  scroll: false,
};

/** A number param with a default; invalid text in the URL falls back to the default. */
export const numberParam = (fallback: number) => parseAsFloat.withDefault(fallback);

/** True when every parsed value equals its example default. */
export function matchesDefaults<T extends Record<string, string | number>>(
  values: T,
  defaults: T,
): boolean {
  return (Object.keys(defaults) as (keyof T)[]).every((k) => values[k] === defaults[k]);
}
