/**
 * The last-used view settings a person keeps: Strategy fit weights and investor filters (the
 * round has its own key in src/lib/round). They live in the URL; these helpers remember what the
 * person last set so a page opened without them can start from there (see view.ts). Remembering
 * happens only when the person changes something, never when a link is opened.
 */
import { parseFilters, serializeFilters } from "@/lib/filters/url";
import { decodeWeights, encodeWeights } from "@/lib/fit/weights";
import { readStoredRound } from "@/lib/round/use-round";
import { serializeRound } from "@/lib/round/url";
import { userStore } from "./manager";
import type { StoredViews } from "./view";

export const WEIGHTS_VIEW_KEY = "view.weights";
export const FILTERS_VIEW_KEY = "view.filters";

/** Remember the filters in `search` (the URL after the person's edit). */
export function rememberFilters(search: URLSearchParams): void {
  userStore.set(FILTERS_VIEW_KEY, serializeFilters(parseFilters(search)));
}

/** Remember the weights in `search`; absent means the defaults. */
export function rememberWeights(search: URLSearchParams): void {
  userStore.set(WEIGHTS_VIEW_KEY, encodeWeights(decodeWeights(search.get("w"))));
}

/** What the active person last used, by group. */
export function readStoredViews(): StoredViews {
  const out: StoredViews = {};
  const round = readStoredRound();
  if (round) out.round = serializeRound(round);
  const w = userStore.get(WEIGHTS_VIEW_KEY);
  if (w !== null) out.weights = w;
  const f = userStore.get(FILTERS_VIEW_KEY);
  if (f !== null) out.filters = f;
  return out;
}
