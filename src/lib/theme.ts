export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "atlas-theme";

/**
 * Runs inline in <head> before first paint so a stored light theme doesn't
 * flash dark. Keep it dependency-free.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
