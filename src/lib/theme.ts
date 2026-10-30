export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "atlas-theme";

/**
 * Runs inline in <head> before first paint so a stored dark theme doesn't
 * flash light. Keep it dependency-free.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

/** Light is the default (PHASE_2 §1); dark is opt-in and remembered. */
export const DEFAULT_THEME: Theme = "light";
