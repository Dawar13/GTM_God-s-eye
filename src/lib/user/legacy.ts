/**
 * Keys written before profiles existed, and where they go. Every `atlas.<name>` key moves to
 * `<name>`; the older dash-style names are listed. Values are copied as they are.
 */
const DASH_KEYS: Record<string, string> = {
  "atlas-theme": "theme",
  "atlas-ui": "ui",
  "atlas-inspector": "inspector",
};

/** The per-profile key a legacy key becomes, or null when it is not a legacy key. */
export function legacyTarget(legacyKey: string): string | null {
  if (legacyKey in DASH_KEYS) return DASH_KEYS[legacyKey]!;
  if (legacyKey.startsWith("atlas.") && legacyKey.length > "atlas.".length) {
    return legacyKey.slice("atlas.".length);
  }
  return null;
}
