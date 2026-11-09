"use client";

import { useSearchParams } from "next/navigation";
import { FILTER_KEYS } from "@/lib/filters";
import { ROUND_KEYS } from "@/lib/round/url";

/**
 * Appends the current filter query string to an internal href, so filters
 * follow you between views. The inspector selection is deliberately dropped.
 */
export function useCarryQuery(): (href: string) => string {
  const params = useSearchParams();
  const carried = new URLSearchParams();
  for (const key of [...FILTER_KEYS, ...ROUND_KEYS]) {
    for (const v of params.getAll(key)) carried.append(key, v);
  }
  return carryInto(carried.toString());
}

/** Adds query `q` to `href`, after any query it has and before any #hash. */
export function carryInto(q: string): (href: string) => string {
  return (href) => {
    if (!q) return href;
    const at = href.indexOf("#");
    const [path, hash] = at < 0 ? [href, ""] : [href.slice(0, at), href.slice(at)];
    return `${path}${path.includes("?") ? "&" : "?"}${q}${hash}`;
  };
}
