/**
 * Which saved view settings to apply when a page opens. The URL wins: a shared link carries
 * its own settings, and only a group the URL does not mention is filled from the profile.
 * Pure, so it is tested without a browser.
 */
import { FILTER_KEYS } from "@/lib/filters";
import { ROUND_KEYS } from "@/lib/round/url";

export type ViewGroup = "round" | "weights" | "filters";

/** The URL parameters each group owns. */
export const GROUP_PARAMS: Record<ViewGroup, readonly string[]> = {
  round: ROUND_KEYS,
  weights: ["w"],
  filters: FILTER_KEYS,
};

/** A saved value per group, as a query string ("" is a saved "all defaults"). */
export type StoredViews = Partial<Record<ViewGroup, string>>;

export function urlHasGroup(search: URLSearchParams, group: ViewGroup): boolean {
  return GROUP_PARAMS[group].some((k) => search.has(k));
}

/**
 * The groups to apply. Normally a group is applied only when the URL lacks it and the profile
 * has a saved value. With `ignoreUrl` (just switched profile, so the URL still shows the
 * previous person's settings) every wanted group is applied, falling back to "" (defaults).
 */
export function viewsToApply(
  search: URLSearchParams,
  stored: StoredViews,
  opts: { ignoreUrl?: boolean; groups?: readonly ViewGroup[] } = {},
): StoredViews {
  const out: StoredViews = {};
  for (const g of opts.groups ?? (["round", "weights", "filters"] as const)) {
    if (!opts.ignoreUrl && urlHasGroup(search, g)) continue;
    const saved = stored[g];
    if (saved !== undefined) out[g] = saved;
    else if (opts.ignoreUrl) out[g] = "";
  }
  return out;
}
