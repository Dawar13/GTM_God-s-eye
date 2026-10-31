"use client";

import { startTransition, useEffect, useState } from "react";
import { API } from "@/lib/api-routes";
import type { FilterableInvestor } from "@/lib/filters";
import { fromColumns, joinFilterable, type Columns, type Detail } from "@/lib/data/columns";
import type { DirectoryRow } from "@/lib/data/directory";
import type { EntityHeader, PaletteEntry } from "@/lib/data/entities";
import type { StrategyRow } from "@/lib/viz/transforms/strategy";
import type { InvestorProfile } from "@/lib/data/profile";
import type { GraphPayload } from "@/lib/viz/transforms/graphPayload";

/** Run once per page load and share the promise. A failed run is retried on next use. */
function memo<T>(run: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    promise ??= run();
    promise.catch(() => {
      promise = null;
    });
    return promise;
  };
}

function memoJson<T>(url: string): () => Promise<T> {
  return memo(() =>
    fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url} returned ${r.status}`);
      return r.json() as Promise<T>;
    }),
  );
}

const loadFilterColumns = memoJson<Columns<FilterableInvestor>>(API.filterIndex);

/** About 3,300 small rows (sent column-wise); loaded when the filter bar mounts. */
export const loadFilterIndex = memo(() => loadFilterColumns().then(fromColumns));

const loadDirectoryDetail = memoJson<Columns<Detail<DirectoryRow>>>(API.directoryRows);

/** The Directory's rows, kept out of page HTML and route prefetches: detail joined to the filter index. */
export const loadDirectoryRows = memo(() =>
  Promise.all([loadFilterIndex(), loadDirectoryDetail()]).then(([index, detail]) =>
    joinFilterable<DirectoryRow>(index, fromColumns(detail)),
  ),
);

const loadStrategyDetail = memoJson<Columns<Detail<StrategyRow>>>(API.strategyRows);

/** Strategy's rows, the same way. */
export const loadStrategyRows = memo(() =>
  Promise.all([loadFilterIndex(), loadStrategyDetail()]).then(([index, detail]) =>
    joinFilterable<StrategyRow>(index, fromColumns(detail)),
  ),
);

/** About 4,400 names; loaded the first time the palette opens, never in page HTML. */
export const loadPaletteIndex = memoJson<PaletteEntry[]>(API.paletteIndex);

/** The network graph (about 3,900 nodes); loaded by the Network view only. */
export const loadGraph = memoJson<GraphPayload>(API.graph);

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

/**
 * Runs a loader whenever `key` changes. State is tagged with its key, so a stale result is never
 * shown. The result renders as a transition, so a big list arriving (3,300 rows) is drawn in
 * slices that let input through instead of one long task.
 */
export function useLoaded<T>(key: string | null, load: () => Promise<T>): Loaded<T> {
  const [result, setResult] = useState<{ key: string; value: Loaded<T> } | null>(null);
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    load().then(
      (data) =>
        !cancelled &&
        startTransition(() => setResult({ key, value: { status: "ready", data } })),
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
