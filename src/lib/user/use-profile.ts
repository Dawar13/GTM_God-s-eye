"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getProfileManager, userStore, type ProfileState } from "./manager";
import { isPlaceholderName, type Profile } from "./profile";

const SERVER_STATE: ProfileState = { profiles: [], activeId: null };

/** The profile list and active id. The server render and first client render see no profile. */
export function useProfileState(): ProfileState {
  const m = getProfileManager();
  return useSyncExternalStore(m.subscribe, m.getState, () => SERVER_STATE);
}

/** The active profile plus the actions. Open views re-render when it changes. */
export function useProfile() {
  const state = useProfileState();
  const active: Profile | null = state.profiles.find((p) => p.id === state.activeId) ?? null;
  const actions = useMemo(() => {
    const m = getProfileManager();
    return {
      create: (name: string) => m.create(name),
      rename: (id: string, name: string) => m.rename(id, name),
      switchTo: (id: string) => m.switchTo(id),
      remove: (id: string) => m.remove(id),
    };
  }, []);
  return {
    active,
    profiles: state.profiles,
    needsName: active !== null && isPlaceholderName(active.name),
    ...actions,
  };
}

/**
 * One stored string for the active profile (null when absent), re-read on profile switches and
 * on every change. The server render and the first client render give null.
 */
export function useUserRaw(key: string): string | null {
  const m = getProfileManager();
  const get = useCallback(() => userStore.get(key), [key]);
  return useSyncExternalStore(m.subscribe, get, () => null);
}
