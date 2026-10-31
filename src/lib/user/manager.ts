import { BrowserBackend, MemoryBackend, type KeyValueBackend } from "./backend";
import { legacyTarget } from "./legacy";
import {
  cleanName,
  DEFAULT_PROFILE_NAME,
  isProfileId,
  makeProfile,
  parseProfiles,
  type Profile,
} from "./profile";

export const PROFILES_KEY = "gge.profiles";
export const ACTIVE_PROFILE_KEY = "gge.activeProfile";
const PROFILE_PREFIX = "gge.p.";

/** The full storage key for a person's setting. */
export const scopedKey = (profileId: string, key: string) => `${PROFILE_PREFIX}${profileId}.${key}`;

/**
 * Per-person storage: every setting a person makes is read and written through this, scoped to
 * the active profile. Keys are short names ("round", "practice.on"); the profile prefix is added
 * here.
 *
 * This is the seam for later. Saved work and calculation history will need a server: put an
 * auth provider in front of the app, map the signed-in account to a profile, and supply a
 * `UserStore` backed by the server instead of the browser. Callers do not change.
 *
 * Profile ids are labels for keeping settings apart on one browser. They are not secrets and
 * not access control.
 */
export interface UserStore {
  /** The active profile's id; null before one exists (the server render). */
  readonly profileId: string | null;
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** The active profile's keys, without the prefix. */
  keys(): string[];
}

export type ProfileState = { profiles: readonly Profile[]; activeId: string | null };

/**
 * The profile list, the active profile, and the scoped store. Change events fire on any profile
 * change and any stored value change, so open views re-read.
 */
export class ProfileManager {
  readonly store: UserStore;
  private state: ProfileState = { profiles: [], activeId: null };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly backend: KeyValueBackend,
    private readonly uuid?: () => string,
    private readonly now?: () => Date,
  ) {
    this.refresh(false);
    const activeId = () => this.state.activeId;
    this.store = {
      get profileId() {
        return activeId();
      },
      get: (key) => {
        const id = this.state.activeId;
        return id ? this.backend.getItem(scopedKey(id, key)) : null;
      },
      set: (key, value) => {
        const id = this.state.activeId;
        if (!id) return;
        this.backend.setItem(scopedKey(id, key), value);
        this.emit();
      },
      remove: (key) => {
        const id = this.state.activeId;
        if (!id) return;
        this.backend.removeItem(scopedKey(id, key));
        this.emit();
      },
      keys: () => {
        const id = this.state.activeId;
        if (!id) return [];
        const prefix = scopedKey(id, "");
        return this.backend
          .keys()
          .filter((k) => k.startsWith(prefix))
          .map((k) => k.slice(prefix.length));
      },
    };
  }

  getState = (): ProfileState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  /**
   * Re-reads the list from storage (also after another tab changed it). Creates the first
   * profile, and moves legacy `atlas.*` values into it, when there are no profiles yet.
   */
  refresh(notify = true): void {
    let profiles = parseProfiles(this.backend.getItem(PROFILES_KEY));
    if (profiles.length === 0) {
      const first = makeProfile(DEFAULT_PROFILE_NAME, this.uuid, this.now);
      profiles = [first];
      this.writeProfiles(profiles);
      this.backend.setItem(ACTIVE_PROFILE_KEY, first.id);
      this.migrateLegacy(first.id);
    }
    const stored = this.backend.getItem(ACTIVE_PROFILE_KEY);
    let activeId = profiles.find((p) => p.id === stored)?.id ?? null;
    if (!activeId) {
      activeId = profiles[0]!.id;
      this.backend.setItem(ACTIVE_PROFILE_KEY, activeId);
    }
    const prev = this.state;
    const same =
      prev.activeId === activeId &&
      prev.profiles.length === profiles.length &&
      prev.profiles.every((p, i) => {
        const q = profiles[i]!;
        return p.id === q.id && p.name === q.name && p.createdAt === q.createdAt;
      });
    if (!same) this.state = { profiles, activeId };
    if (notify) this.emit();
  }

  private writeProfiles(profiles: Profile[]) {
    this.backend.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }

  /** Copies every pre-profile key into the profile and removes the old one. Safe to repeat. */
  private migrateLegacy(profileId: string) {
    for (const key of this.backend.keys()) {
      const target = legacyTarget(key);
      if (!target) continue;
      const value = this.backend.getItem(key);
      const dest = scopedKey(profileId, target);
      if (value !== null && this.backend.getItem(dest) === null) this.backend.setItem(dest, value);
      this.backend.removeItem(key);
    }
  }

  /** Adds a person and, unless told otherwise, switches to them. */
  create(name: string, opts: { activate?: boolean } = {}): Profile {
    const profile = makeProfile(name, this.uuid, this.now);
    this.writeProfiles([...this.state.profiles, profile]);
    if (opts.activate ?? true) this.backend.setItem(ACTIVE_PROFILE_KEY, profile.id);
    this.refresh();
    return profile;
  }

  /** False when the name is empty or the profile does not exist. */
  rename(id: string, name: string): boolean {
    const clean = cleanName(name);
    if (!clean || !this.state.profiles.some((p) => p.id === id)) return false;
    this.writeProfiles(this.state.profiles.map((p) => (p.id === id ? { ...p, name: clean } : p)));
    this.refresh();
    return true;
  }

  switchTo(id: string): boolean {
    if (!isProfileId(id) || !this.state.profiles.some((p) => p.id === id)) return false;
    if (this.state.activeId !== id) {
      this.backend.setItem(ACTIVE_PROFILE_KEY, id);
      this.refresh();
    }
    return true;
  }

  /**
   * Deletes a person and their settings. The last profile cannot be deleted. Deleting the
   * active one switches to the first remaining.
   */
  remove(id: string): boolean {
    const { profiles, activeId } = this.state;
    if (profiles.length <= 1 || !profiles.some((p) => p.id === id)) return false;
    const rest = profiles.filter((p) => p.id !== id);
    const prefix = scopedKey(id, "");
    for (const k of this.backend.keys()) if (k.startsWith(prefix)) this.backend.removeItem(k);
    this.writeProfiles(rest);
    if (activeId === id) this.backend.setItem(ACTIVE_PROFILE_KEY, rest[0]!.id);
    this.refresh();
    return true;
  }
}

let instance: ProfileManager | undefined;

/**
 * The app's manager: browser storage in the browser, memory on the server. It starts lazily, so
 * the first client read creates the first profile and runs the legacy migration.
 */
export function getProfileManager(): ProfileManager {
  if (instance) return instance;
  if (typeof window === "undefined") {
    instance = new ProfileManager(new MemoryBackend());
  } else {
    const m = new ProfileManager(new BrowserBackend());
    // Another tab changed the profiles or a setting: re-read and tell open views.
    window.addEventListener("storage", () => m.refresh());
    instance = m;
  }
  return instance;
}

/** The scoped store for the active profile (follows profile switches). */
export const userStore: UserStore = {
  get profileId() {
    return getProfileManager().store.profileId;
  },
  get: (k) => getProfileManager().store.get(k),
  set: (k, v) => getProfileManager().store.set(k, v),
  remove: (k) => getProfileManager().store.remove(k),
  keys: () => getProfileManager().store.keys(),
};
