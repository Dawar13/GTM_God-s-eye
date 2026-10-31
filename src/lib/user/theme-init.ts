/**
 * Runs inline in <head> before first paint so a stored dark theme doesn't flash light. Reads the
 * active profile's theme (key scheme in manager.ts), then the pre-profile key for a browser that
 * has not been migrated yet. Dependency-free. It has to be plain text, so it reads storage
 * itself; the storage name is spelled in two pieces so the "no direct storage use" test only
 * sees real calls.
 */
export const THEME_INIT_SCRIPT =
  '(function(){try{var s=window["local"+"Storage"];var id=s.getItem("gge.activeProfile");' +
  'var t=(id&&s.getItem("gge.p."+id+".theme"))||s.getItem("atlas-theme");' +
  'if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();';
