"use client";

import { useCallback } from "react";
import { useQueryStates } from "nuqs";
import { DEFAULT_FILTER_STATE, type FilterKey, type FilterState } from "./index";
import { rememberFilters } from "@/lib/user/view-store";
import { filterParsers, filterUrlOptions } from "./url";

/**
 * Filter state from the URL (nuqs is the source of truth). Any view reads
 * `filters` and passes it to `applyFilters`; the filter bar writes through
 * `setValues`. Call it under a Suspense boundary (the root layout has one).
 */
export function useFilters() {
  const [filters, setFiltersRaw] = useQueryStates(filterParsers, filterUrlOptions);
  // The person's own edit: remember it as their last-used filters (a link they open is not remembered).
  const setFilters = useCallback(
    (...args: Parameters<typeof setFiltersRaw>) =>
      setFiltersRaw(...args).then((search) => {
        rememberFilters(search);
        return search;
      }),
    [setFiltersRaw],
  );

  const setValues = useCallback(
    <K extends FilterKey>(key: K, values: FilterState[K]) => {
      void setFilters({ [key]: values } as Partial<FilterState>);
    },
    [setFilters],
  );
  const toggle = useCallback(
    (key: FilterKey, value: string) => {
      void setFilters((prev) => {
        const current = prev[key] as string[];
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { [key]: next } as Partial<FilterState>;
      });
    },
    [setFilters],
  );
  const reset = useCallback(() => {
    void setFilters(DEFAULT_FILTER_STATE);
  }, [setFilters]);
  const clearAll = useCallback(() => {
    void setFilters({
      region: [],
      stage: [],
      type: [],
      freshness: [],
      maturity: [],
      sector: [],
      tier: [],
      tag: [],
    });
  }, [setFilters]);

  return { filters: filters as FilterState, setValues, toggle, reset, clearAll };
}
