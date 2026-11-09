"use client";

import { useEffect, useMemo, useRef } from "react";
import { FindBox } from "@/components/ui-atlas/FindBox";
import { useFindQuery, useFindSteps } from "@/lib/search/find-state";
import { rankMatches, type Searchable } from "@/lib/search/match";

/** What a chart paints: the matching ids (null when no query is applied) and the active one. */
export type MarkFindState = { found: ReadonlySet<string> | null; activeId: string | null };
export const NO_FIND: MarkFindState = { found: null, activeId: null };

/** Keeps the previous state object when nothing changed, so a parent can skip a render. */
export function sameFind(prev: MarkFindState, next: MarkFindState): MarkFindState {
  return prev.found === next.found && prev.activeId === next.activeId ? prev : next;
}

/**
 * A chart's find box. Keystrokes re-render only this component; the chart hears about a new
 * match set (debounced) or a new active match through `onChange`, once each. `getId` and
 * `toSearchable` should be stable (module-level) functions.
 */
export function FindForMarks<T>({
  label,
  items,
  getId,
  toSearchable,
  onFocus,
  onOpen,
  onChange,
}: {
  label: string;
  items: readonly T[];
  getId: (item: T) => string;
  toSearchable: (item: T) => Searchable;
  /** Bring the match into view (Enter, arrows). */
  onFocus: (id: string) => void;
  /** Enter on a focused match: open it in the Inspector. */
  onOpen: (id: string) => void;
  onChange: (state: MarkFindState) => void;
}) {
  const { input, setInput, query } = useFindQuery();
  const matches = useMemo(
    () => rankMatches(items, query, toSearchable).map((r) => r.item),
    [items, query, toSearchable],
  );
  const steps = useFindSteps(matches, {
    focus: (item) => onFocus(getId(item)),
    open: (item) => onOpen(getId(item)),
  });
  const found = useMemo(
    () => (query.trim() ? new Set(matches.map(getId)) : null),
    [matches, query, getId],
  );
  const activeId = found && steps.activeItem ? getId(steps.activeItem) : null;

  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  });
  useEffect(() => {
    changed.current({ found, activeId });
  }, [found, activeId]);

  const pending = input.trim() !== "" && input !== query;
  return (
    <FindBox
      label={label}
      value={input}
      onValueChange={setInput}
      matches={pending ? null : matches.length}
      active={steps.active}
      onStep={steps.step}
      onSubmit={steps.submit}
    />
  );
}
