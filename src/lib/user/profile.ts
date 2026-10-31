/**
 * Profiles: who is using this browser. A profile is a label and an id that keeps one person's
 * settings apart from another's.
 *
 * These ids are NOT secrets and NOT access control. Anyone with the browser can switch to any
 * profile. Access to the deployed app is controlled by the deployment's sign-in (Vercel
 * Authentication), which gives the app no user identity. Real identity arrives with a login.
 */

export type Profile = { id: string; name: string; createdAt: string };

export const PROFILE_ID_PREFIX = "usr_";
export const DEFAULT_PROFILE_NAME = "You";
export const NEW_PERSON_NAME = "New person";
export const MAX_NAME_LENGTH = 40;

const ID_PATTERN = /^usr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** `usr_` plus a random UUID. */
export function newProfileId(uuid: () => string = () => crypto.randomUUID()): string {
  return `${PROFILE_ID_PREFIX}${uuid()}`;
}

export function isProfileId(v: unknown): v is string {
  return typeof v === "string" && ID_PATTERN.test(v);
}

/** Trimmed, whitespace collapsed, at most 40 characters; null when nothing is left. */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH).trim();
  return name === "" ? null : name;
}

/** True while the person has not yet put their own name in. */
export function isPlaceholderName(name: string): boolean {
  return name === DEFAULT_PROFILE_NAME || name === NEW_PERSON_NAME;
}

/** Up to two letters for the chip: first letters of the first two words, or the first two letters. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

export function makeProfile(
  name: string,
  uuid?: () => string,
  now: () => Date = () => new Date(),
): Profile {
  return {
    id: newProfileId(uuid),
    name: cleanName(name) ?? NEW_PERSON_NAME,
    createdAt: now().toISOString(),
  };
}

/** The stored list; entries that are not well-formed profiles, and repeated ids, are dropped. */
export function parseProfiles(text: string | null): Profile[] {
  if (!text) return [];
  try {
    const raw: unknown = JSON.parse(text);
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: Profile[] = [];
    for (const p of raw as Partial<Profile>[]) {
      if (!p || !isProfileId(p.id) || seen.has(p.id)) continue;
      const name = typeof p.name === "string" ? cleanName(p.name) : null;
      if (!name || typeof p.createdAt !== "string") continue;
      seen.add(p.id);
      out.push({ id: p.id, name, createdAt: p.createdAt });
    }
    return out;
  } catch {
    return [];
  }
}
