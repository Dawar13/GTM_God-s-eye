"use client";

import { RotateCcw } from "lucide-react";
import { FRESHNESS, INVESTOR_STAGES, INVESTOR_TYPES, REGIONS, SECTORS } from "@/lib/schema/enums";
import {
  FRESHNESS_LABELS,
  INVESTOR_STAGE_LABELS,
  INVESTOR_TYPE_LABELS,
  REGION_LABELS,
  SECTOR_LABELS,
} from "@/lib/format/labels";
import { DEFAULT_FILTERS, useFilters, type Filters } from "@/store/filters";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterDef = {
  key: keyof Filters;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
};

const FILTERS: FilterDef[] = [
  {
    key: "region",
    label: "Region",
    allLabel: "All regions",
    options: REGIONS.map((v) => ({ value: v, label: REGION_LABELS[v] })),
  },
  {
    key: "stage",
    label: "Stage",
    allLabel: "All stages",
    options: INVESTOR_STAGES.map((v) => ({ value: v, label: INVESTOR_STAGE_LABELS[v] })),
  },
  {
    key: "type",
    label: "Type",
    allLabel: "All types",
    options: INVESTOR_TYPES.map((v) => ({ value: v, label: INVESTOR_TYPE_LABELS[v] })),
  },
  {
    key: "freshness",
    label: "Fund",
    allLabel: "Any fund age",
    options: FRESHNESS.map((v) => ({ value: v, label: FRESHNESS_LABELS[v] })),
  },
  {
    key: "sector",
    label: "Sector",
    allLabel: "All sectors",
    options: SECTORS.map((v) => ({ value: v, label: SECTOR_LABELS[v] })),
  },
];

export function FilterBar() {
  const filters = useFilters();
  const isDefault = FILTERS.every((f) => filters[f.key] === DEFAULT_FILTERS[f.key]);

  return (
    <div
      role="group"
      aria-label="Filters"
      className="flex h-12 shrink-0 items-center gap-4 overflow-x-auto border-b border-rule bg-canvas px-4"
    >
      {FILTERS.map((f) => {
        const labelId = `filter-${f.key}`;
        return (
          <div key={f.key} className="flex shrink-0 items-center gap-1.5">
            <span id={labelId} className="text-xs text-ink-2">
              {f.label}
            </span>
            <Select
              value={filters[f.key]}
              onValueChange={(value) => filters.setFilter(f.key, value as Filters[typeof f.key])}
            >
              <SelectTrigger
                size="sm"
                aria-labelledby={labelId}
                className="h-7 border-rule text-xs dark:bg-transparent"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value="all">{f.allLabel}</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="text-xs text-ink-2">Filters connect to the views in Phase 2.</span>
        {!isDefault && (
          <Button variant="ghost" size="sm" onClick={filters.reset}>
            <RotateCcw aria-hidden />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
