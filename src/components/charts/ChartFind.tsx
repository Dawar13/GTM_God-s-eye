"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { FindBox } from "@/components/ui-atlas";
import { useInspector } from "@/lib/hooks/useInspector";
import { useFindQuery, useFindSteps } from "@/lib/search/find-state";
import { rankMatches } from "@/lib/search/match";
import { paintFind } from "@/lib/viz/paintFind";

/** Something a chart can find: an investor or competitor drawn in it. */
export type FindEntity = { id: string; name: string; aliases?: readonly string[] | null };

/**
 * Scrolls the match's anchor (`data-find-anchor`, else its first `data-find-id` mark) into view
 * and pulses it, without moving focus out of the find box.
 */
export function focusFindAnchor(root: Element | null, id: string): void {
  if (!root) return;
  const q = CSS.escape(id);
  const el =
    root.querySelector(`[data-find-anchor~="${q}"]`) ??
    root.querySelector(`[data-find-id~="${q}"]`);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  if (!reduce)
    el.animate([{ opacity: 0.3 }, { opacity: 1 }], {
      duration: 420,
      iterations: 2,
      easing: "ease-out",
    });
}

/**
 * A chart's find box, for ChartFrame's `find` slot. It owns the query, so typing re-renders only
 * this box; the chart is highlighted by `paintFind` over `root` (marks tagged `data-find-id`).
 * Marks the chart adds or re-tags later (hover, a Recharts redraw) start unpainted, so a
 * MutationObserver repaints them before the frame is drawn. Pass `root` as state from a
 * callback ref so a remounted chart (back from "View as table") repaints.
 * Enter focuses the active match, Enter again opens it in the Inspector.
 */
export function ChartFind({
  label,
  entities,
  root,
}: {
  label: string;
  /** Stable (memoised) list of what the chart draws. */
  entities: readonly FindEntity[];
  root: Element | null;
}) {
  const { input, setInput, query } = useFindQuery();
  const { open } = useInspector();
  const matches = useMemo(
    () =>
      rankMatches(entities, query, (e) => ({ name: e.name, aliases: e.aliases })).map(
        (r) => r.item,
      ),
    [entities, query],
  );
  const found = useMemo(
    () => (query.trim() ? new Set(matches.map((m) => m.id)) : null),
    [matches, query],
  );
  const steps = useFindSteps(matches, {
    focus: (e) => focusFindAnchor(root, e.id),
    open: (e) => open(e.id),
  });
  const activeId = found && steps.activeItem ? steps.activeItem.id : null;

  const painted = useRef({ found, activeId });
  useLayoutEffect(() => {
    painted.current = { found, activeId };
    paintFind(root, found, activeId);
  }, [root, found, activeId]);

  useEffect(() => {
    if (!root) return;
    // Synchronous in the observer's microtask, so a new mark never shows unpainted. paintFind
    // writes only data-found / data-find-active, which this does not observe.
    const mo = new MutationObserver(() => {
      const { found: f, activeId: a } = painted.current;
      if (f) paintFind(root, f, a);
    });
    mo.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-find-id"],
    });
    return () => mo.disconnect();
  }, [root]);

  return (
    <FindBox
      label={label}
      value={input}
      onValueChange={setInput}
      matches={input === query ? matches.length : null}
      active={steps.active}
      onStep={steps.step}
      onSubmit={steps.submit}
    />
  );
}
