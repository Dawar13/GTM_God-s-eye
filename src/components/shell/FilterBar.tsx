"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { filtersApply } from "@/lib/nav";
import {
  FILTER_DEFS,
  facetCounts,
  isDefaultState,
  type FilterDef,
  type FilterableInvestor,
} from "@/lib/filters";
import { useFilters } from "@/lib/filters/use-filters";
import { loadFilterIndex } from "@/lib/client-index";
import { useUi } from "@/store/ui";
import { Chip } from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Collapsible row under the top bar. Each filter opens a chip list with counts. */
export function FilterBar() {
  const open = useUi((s) => s.filtersOpen);
  const applies = filtersApply(usePathname());
  const { filters, toggle, setValues, reset, clearAll } = useFilters();
  const [index, setIndex] = useState<FilterableInvestor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFilterIndex().then(
      (rows) => !cancelled && setIndex(rows),
      () => undefined, // Counts are an enhancement; the filters still work without them.
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = index ? facetCounts(index, filters) : null;

  // Filters do not apply to the VC math calculators. The URL keeps them, so they are
  // still there when you go back to an investor view.
  if (!applies) return null;

  return (
    <div
      id="filter-bar"
      role="group"
      aria-label="Filters"
      hidden={!open}
      className="shrink-0 border-b border-rule bg-canvas px-3 py-2 lg:px-4 [&:not([hidden])]:flex [&:not([hidden])]:items-center [&:not([hidden])]:gap-2 [&:not([hidden])]:overflow-x-auto"
    >
      {FILTER_DEFS.map((def) => (
        <FilterMenu
          key={def.key}
          def={def}
          selected={filters[def.key]}
          counts={counts?.[def.key] ?? null}
          onToggle={(value) => toggle(def.key, value)}
          onClear={() => setValues(def.key, [])}
        />
      ))}
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {index && (
          <span className="text-xs text-ink-2">
            <span className="num">{index.length.toLocaleString("en-US")}</span> investors in the
            data
          </span>
        )}
        {!isDefaultState(filters) && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden />
            Reset
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-ink-2">
          Clear all
        </Button>
      </div>
    </div>
  );
}

function FilterMenu({
  def,
  selected,
  counts,
  onToggle,
  onClear,
}: {
  def: FilterDef;
  selected: readonly string[];
  counts: Record<string, number> | null;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const label = (v: string) => def.options.find((o) => o.value === v)?.label ?? v;
  const shown =
    selected.length === 0
      ? null
      : selected.length === 1
        ? label(selected[0]!)
        : `${selected.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors duration-(--dur-open) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
            shown
              ? "border-accent bg-accent-soft text-ink"
              : "border-rule bg-panel text-ink-2 hover:bg-panel-sunk hover:text-ink",
          )}
        >
          <span>{def.label}</span>
          {shown && <span className="text-ink">{shown}</span>}
          <ChevronDown aria-hidden className="size-3.5 text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn(def.options.length > 8 ? "w-[22rem]" : "w-72")}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">{def.label}</p>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              Show all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {def.options.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              count={counts ? (counts[o.value] ?? 0) : undefined}
              selected={selected.includes(o.value)}
              onClick={() => onToggle(o.value)}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-2">
          {def.key === "sector"
            ? "An investor counts for a sector at 15% thesis weight or more."
            : "Counts show the investors listed if only that chip is selected here."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
