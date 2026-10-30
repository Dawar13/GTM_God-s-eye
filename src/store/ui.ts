import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

type UiState = {
  /** null until the client has read the theme the init script applied. */
  theme: Theme | null;
  railCollapsed: boolean;
  filtersOpen: boolean;
  /** Below 1024px the rail lives in a sheet; this is its open state. Not persisted. */
  mobileNavOpen: boolean;
  paletteOpen: boolean;
  syncThemeFromDocument: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleRail: () => void;
  toggleFilters: () => void;
  setFiltersOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
};

/**
 * Rail and filter-row state persist in localStorage. Hydration is manual
 * (`useUi.persist.rehydrate()` in Providers) so the server render and the first
 * client render agree.
 */
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
      setTheme: (theme) => {
        document.documentElement.dataset.theme = theme;
        try {
          localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
          // Storage can be blocked (private mode); the theme still applies for this visit.
        }
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
      name: "atlas-ui",
      skipHydration: true,
      partialize: (s) => ({ railCollapsed: s.railCollapsed, filtersOpen: s.filtersOpen }),
    },
  ),
);
