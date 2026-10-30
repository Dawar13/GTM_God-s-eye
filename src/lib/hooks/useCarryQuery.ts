"use client";

import { useSearchParams } from "next/navigation";
import { FILTER_KEYS } from "@/lib/filters";

/**
 * Appends the current filter query string to an internal href, so filters
 * follow you between views. The inspector selection is deliberately dropped.
 */
export function useCarryQuery(): (href: string) => string {
  const params = useSearchParams();
  const carried = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    for (const v of params.getAll(key)) carried.append(key, v);
  }
  const q = carried.toString();
  return (href) => (q ? `${href}?${q}` : href);
}
