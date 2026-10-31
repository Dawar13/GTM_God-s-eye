"use client";

import { useEffect, useState } from "react";
import type { FilterableInvestor } from "@/lib/filters";
import type { EntityHeader, PaletteEntry } from "@/lib/data/entities";
import type { InvestorProfile } from "@/lib/data/profile";
import type { GraphPayload } from "@/lib/viz/transforms/graphPayload";

/** Fetch once per page load and share the promise. A failed fetch is retried on next use. */
function memoJson<T>(url: string): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    promise ??= fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url} returned ${r.status}`);
      return r.json() as Promise<T>;
    });
    promise.catch(() => {
      promise = null;
    });
    return promise;
  };
}

/** About 3,300 small rows; loaded when the filter bar mounts. */
export const loadFilterIndex = memoJson<FilterableInvestor[]>("/api/filter-index");

/** About 4,400 names; loaded the first time the palette opens, never in page HTML. */
export const loadPaletteIndex = memoJson<PaletteEntry[]>("/api/palette-index");

/** The network graph (about 3,900 nodes); loaded by the Network view only. */
export const loadGraph = memoJson<GraphPayload>("/api/graph");

const entityCache = new Map<string, Promise<EntityHeader>>();
export function loadEntity(id: string): Promise<EntityHeader> {
  let p = entityCache.get(id);
  if (!p) {
    p = fetch(`/api/entity/${encodeURIComponent(id)}`).then((r) => {
      if (!r.ok) throw new Error(r.status === 404 ? "not-found" : `entity ${r.status}`);
      return r.json() as Promise<EntityHeader>;
    });
    p.catch(() => entityCache.delete(id));
    entityCache.set(id, p);
  }
  return p;
}

const profileCache = new Map<string, Promise<InvestorProfile>>();
export function loadProfile(id: string): Promise<InvestorProfile> {
  let p = profileCache.get(id);
  if (!p) {
    p = fetch(`/api/entity/${encodeURIComponent(id)}/profile`).then((r) => {
      if (!r.ok) throw new Error(r.status === 404 ? "not-found" : `profile ${r.status}`);
      return r.json() as Promise<InvestorProfile>;
    });
    p.catch(() => profileCache.delete(id));
    profileCache.set(id, p);
  }
  return p;
}

export type Loaded<T> =
  { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** Runs a loader whenever `key` changes. State is tagged with its key, so a stale result is never shown. */
export function useLoaded<T>(key: string | null, load: () => Promise<T>): Loaded<T> {
  const [result, setResult] = useState<{ key: string; value: Loaded<T> } | null>(null);
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    load().then(
      (data) => !cancelled && setResult({ key, value: { status: "ready", data } }),
      (err: unknown) =>
        !cancelled &&
        setResult({
          key,
          value: { status: "error", message: err instanceof Error ? err.message : "failed" },
        }),
    );
    return () => {
      cancelled = true;
    };
    // `load` is a stable module-level function or a closure over `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result && result.key === key ? result.value : { status: "loading" };
}
