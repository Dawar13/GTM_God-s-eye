"use client";

import { useCallback, useEffect } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { useInspectorStore } from "@/store/inspector";

/**
 * The Inspector's selection lives in the URL as `?inspect=<id>` so a view is
 * shareable. The drawer keeps its own back/forward history in the store.
 *
 * From a chart mark or table row, call `open(id)`; that is all a view needs.
 */
export function useInspector() {
  const [id, setId] = useQueryState(
    "inspect",
    parseAsString.withOptions({ history: "replace", scroll: false, clearOnDefault: true }),
  );
  const history = useInspectorStore((s) => s.history);
  const index = useInspectorStore((s) => s.index);

  // A selection that arrived from the URL (page load, browser back) restarts the history.
  useEffect(() => {
    const store = useInspectorStore.getState();
    if (id && store.history[store.index] !== id) store.reset(id);
    if (!id && store.index !== -1) store.reset(null);
  }, [id]);

  const open = useCallback(
    (next: string) => {
      useInspectorStore.getState().push(next);
      void setId(next);
    },
    [setId],
  );
  const close = useCallback(() => {
    useInspectorStore.getState().reset(null);
    void setId(null);
  }, [setId]);
  const back = useCallback(() => {
    const target = useInspectorStore.getState().back();
    if (target) void setId(target);
  }, [setId]);
  const forward = useCallback(() => {
    const target = useInspectorStore.getState().forward();
    if (target) void setId(target);
  }, [setId]);

  return {
    id,
    open,
    close,
    back,
    forward,
    canBack: index > 0,
    canForward: index < history.length - 1,
  };
}
