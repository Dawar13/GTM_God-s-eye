"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { debounce, useQueryStates } from "nuqs";
import {
  clampRaise,
  DEFAULT_ROUND,
  parseStoredRound,
  serializeStoredRound,
  type Round,
} from "./index";
import { roundParsers, roundUrlOptions } from "./url";

const STORAGE_KEY = "atlas.round";

export function readStoredRound(): Round | null {
  try {
    return parseStoredRound(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredRound(round: Round) {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeStoredRound(round));
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

/**
 * Our round from the URL (nuqs is the source of truth; `?raise=` and `?inst=`). Edits are also
 * remembered in localStorage, which the top bar applies when a page opens without the params.
 * Command renders on the server from the URL, so edits there refetch it (debounced).
 */
export function useRound() {
  const pathname = usePathname();
  const [values, setValues] = useQueryStates(roundParsers, roundUrlOptions);
  const round: Round = { raise: clampRaise(values.raise), inst: values.inst };

  const setRound = useCallback(
    (patch: Partial<Round>, { remember = true }: { remember?: boolean } = {}) => {
      const next = { raise: round.raise, inst: round.inst, ...patch };
      if (remember) writeStoredRound(next);
      void setValues(
        patch,
        pathname === "/" ? { shallow: false, limitUrlUpdates: debounce(300) } : undefined,
      );
    },
    [setValues, pathname, round.raise, round.inst],
  );
  const reset = useCallback(() => setRound({ ...DEFAULT_ROUND }), [setRound]);

  return { ...round, setRound, reset };
}
