import { create } from "zustand";
import type { Freshness, InvestorStage, InvestorType, Region, Sector } from "@/lib/schema/enums";

export type Filters = {
  region: Region | "all";
  stage: InvestorStage | "all";
  type: InvestorType | "all";
  freshness: Freshness | "all";
  sector: Sector | "all";
};

/** Western is the default view; India is a toggle, not hidden (PROJECT_CONTEXT §2). */
export const DEFAULT_FILTERS: Filters = {
  region: "western",
  stage: "all",
  type: "all",
  freshness: "all",
  sector: "all",
};

type FiltersState = Filters & {
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  reset: () => void;
};

export const useFilters = create<FiltersState>()((set) => ({
  ...DEFAULT_FILTERS,
  setFilter: (key, value) => set({ [key]: value } as Pick<Filters, typeof key>),
  reset: () => set(DEFAULT_FILTERS),
}));
