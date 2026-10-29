import { create } from "zustand";

export type SelectionKind = "investor" | "fund" | "company" | "round";

export type Selection = {
  kind: SelectionKind;
  id: string;
  title: string;
  /** The record behind the selection; the inspector renders it. */
  payload: unknown;
};

export const INSPECTOR_WIDTH = { min: 280, max: 720, initial: 380 } as const;

type SelectionState = {
  selection: Selection | null;
  inspectorWidth: number;
  select: (selection: Selection) => void;
  clear: () => void;
  setInspectorWidth: (width: number) => void;
};

export const useSelection = create<SelectionState>()((set) => ({
  selection: null,
  inspectorWidth: INSPECTOR_WIDTH.initial,
  select: (selection) => set({ selection }),
  clear: () => set({ selection: null }),
  setInspectorWidth: (width) =>
    set({ inspectorWidth: Math.min(INSPECTOR_WIDTH.max, Math.max(INSPECTOR_WIDTH.min, width)) }),
}));
