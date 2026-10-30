import { create } from "zustand";
import { persist } from "zustand/middleware";

export const INSPECTOR_WIDTH = { min: 360, max: 640, initial: 420 } as const;

const clampWidth = (w: number) => Math.min(INSPECTOR_WIDTH.max, Math.max(INSPECTOR_WIDTH.min, w));

type InspectorState = {
  width: number;
  /** Entity ids opened in this drawer, oldest first, and where we are in them. */
  history: string[];
  index: number;
  setWidth: (width: number) => void;
  /** Open an entity: drops any forward entries, then appends it. */
  push: (id: string) => void;
  /** Start a fresh history, for a selection that arrived from the URL. */
  reset: (id: string | null) => void;
  back: () => string | null;
  forward: () => string | null;
};

export const useInspectorStore = create<InspectorState>()(
  persist(
    (set, get) => ({
      width: INSPECTOR_WIDTH.initial,
      history: [],
      index: -1,
      setWidth: (width) => set({ width: clampWidth(width) }),
      push: (id) => {
        const { history, index } = get();
        if (history[index] === id) return;
        const next = [...history.slice(0, index + 1), id];
        set({ history: next, index: next.length - 1 });
      },
      reset: (id) => set(id ? { history: [id], index: 0 } : { history: [], index: -1 }),
      back: () => {
        const { history, index } = get();
        if (index <= 0) return null;
        set({ index: index - 1 });
        return history[index - 1] ?? null;
      },
      forward: () => {
        const { history, index } = get();
        if (index >= history.length - 1) return null;
        set({ index: index + 1 });
        return history[index + 1] ?? null;
      },
    }),
    {
      name: "atlas-inspector",
      skipHydration: true,
      partialize: (s) => ({ width: s.width }),
    },
  ),
);
