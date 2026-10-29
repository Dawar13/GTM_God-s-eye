import { create } from "zustand";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

type UiState = {
  /** null until the client has read the theme the init script applied. */
  theme: Theme | null;
  railCollapsed: boolean;
  syncThemeFromDocument: () => void;
  setTheme: (theme: Theme) => void;
  toggleRail: () => void;
};

export const useUi = create<UiState>()((set) => ({
  theme: null,
  railCollapsed: false,
  syncThemeFromDocument: () =>
    set({ theme: document.documentElement.dataset.theme === "light" ? "light" : "dark" }),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be blocked (private mode); the theme still applies for this visit.
    }
    set({ theme });
  },
  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
}));
