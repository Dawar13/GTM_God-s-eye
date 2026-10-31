import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { userStateStorage } from "@/lib/user/state-storage";
import { userStore } from "@/lib/user/manager";

type UiState = {
  /** null until the client has read the theme the init script applied. */
  theme: Theme | null;
  railCollapsed: boolean;
  filtersOpen: boolean;
  /** Below 1024px the rail lives in a sheet; this is its open state. Not persisted. */
  mobileNavOpen: boolean;
  paletteOpen: boolean;
  syncThemeFromDocument: () => void;
  /** Applies the active person's saved theme, rail and filter-row state (after a profile switch). */
  applyProfile: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleRail: () => void;
  toggleFilters: () => void;
  setFiltersOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
};

/**
 * Rail and filter-row state persist per person (src/lib/user). Hydration is manual
 * (`useUi.persist.rehydrate()` in Providers) so the server render and the first
 * client render agree.
 */
/** Per-profile key for the persisted rail and filter-row state. */
export const UI_STORAGE_KEY = "ui";

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: null,
      railCollapsed: false,
      filtersOpen: true,
      mobileNavOpen: false,
      paletteOpen: false,
      syncThemeFromDocument: () =>
        set({ theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light" }),
      applyProfile: () => {
        const saved = userStore.get(THEME_STORAGE_KEY);
        const theme: Theme = saved === "dark" ? "dark" : "light";
        document.documentElement.dataset.theme = theme;
        const ui = readPersisted(userStore.get(UI_STORAGE_KEY));
        set({
          theme,
          railCollapsed: ui.railCollapsed === true,
          filtersOpen: ui.filtersOpen !== false,
        });
      },
      setTheme: (theme) => {
        document.documentElement.dataset.theme = theme;
        userStore.set(THEME_STORAGE_KEY, theme);
        set({ theme });
      },
      toggleTheme: () =>
        get().setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"),
      toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
      toggleFilters: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
      setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    }),
    {
      name: UI_STORAGE_KEY,
      storage: createJSONStorage(() => userStateStorage),
      skipHydration: true,
      partialize: (s) => ({ railCollapsed: s.railCollapsed, filtersOpen: s.filtersOpen }),
    },
  ),
);

/** The `state` object of a persisted zustand value; empty when absent or corrupt. */
function readPersisted(raw: string | null): { railCollapsed?: unknown; filtersOpen?: unknown } {
  try {
    const v = raw ? (JSON.parse(raw) as { state?: unknown }) : null;
    return v && typeof v.state === "object" && v.state !== null ? v.state : {};
  } catch {
    return {};
  }
}
