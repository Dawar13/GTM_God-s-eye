export type Theme = "dark" | "light";

/** The per-profile key the theme is stored under (see src/lib/user). */
export const THEME_STORAGE_KEY = "theme";

export { THEME_INIT_SCRIPT } from "@/lib/user/theme-init";

/** Light is the default (PHASE_2 §1); dark is opt-in and remembered. */
export const DEFAULT_THEME: Theme = "light";
