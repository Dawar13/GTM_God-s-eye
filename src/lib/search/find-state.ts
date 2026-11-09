"use client";

import { useEffect, useRef, useState } from "react";

/** Idle time after the last keystroke before a find box query is applied. */
export const FIND_DEBOUNCE_MS = 120;

/**
 * The text in a find box and the query applied from it, `delay` ms after the last keystroke.
 * Clearing applies at once. `initial` pre-fills both (a link that opens a page on a match).
 */
export function useFindQuery(delay = FIND_DEBOUNCE_MS, initial = "") {
  const [input, setInput] = useState(initial);
  const [query, setQuery] = useState(initial);
  useEffect(() => {
    if (!input.trim()) {
      // Clearing should restore the view at once, without waiting for the debounce.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      return;
    }
    const t = setTimeout(() => setQuery(input), delay);
    return () => clearTimeout(t);
  }, [input, delay]);
  return { input, setInput, query };
}

/**
 * Stepping through a chart's matches. Arrows (and Shift+Enter) move and focus the active
 * match; Enter focuses it, and Enter again on a focused match opens it (the Inspector).
 * A new match list starts again at the best match, unfocused.
 */
export function useFindSteps<T>(
  matches: readonly T[],
  handlers: { focus: (item: T) => void; open: (item: T) => void },
) {
  const [state, setState] = useState<{
    list: readonly T[];
    active: number;
    focused: number | null;
  }>({
    list: matches,
    active: 0,
    focused: null,
  });
  const current = state.list === matches ? state : { list: matches, active: 0, focused: null };
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const n = matches.length;
  const active = n ? Math.min(current.active, n - 1) : 0;

  function step(delta: 1 | -1) {
    if (!n) return;
    const next = (active + delta + n) % n;
    setState({ list: matches, active: next, focused: next });
    h.current.focus(matches[next]!);
  }

  function submit() {
    if (!n) return;
    const item = matches[active]!;
    if (current.focused === active) h.current.open(item);
    else {
      setState({ list: matches, active, focused: active });
      h.current.focus(item);
    }
  }

  return {
    active,
    activeItem: n ? matches[active]! : null,
    focused: current.focused === active && n > 0,
    step,
    submit,
  };
}

type Box = { el: HTMLElement; focus: () => void };
const boxes = new Set<Box>();

/** Find boxes register here so `/` can focus the current view's box. */
export function registerFindBox(box: Box): () => void {
  boxes.add(box);
  return () => {
    boxes.delete(box);
  };
}

/**
 * Focuses the page's find box: the first one in document order that is on screen, else the
 * first visible one. Returns false when the page has none.
 */
export function focusFindBox(): boolean {
  const visible = [...boxes].filter((b) => b.el.isConnected && b.el.getClientRects().length > 0);
  if (!visible.length) return false;
  visible.sort((a, b) =>
    a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
  const onScreen = visible.find((b) => {
    const r = b.el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });
  (onScreen ?? visible[0]!).focus();
  return true;
}
