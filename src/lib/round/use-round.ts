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
import { userStore } from "@/lib/user/manager";

/** Per-profile key (see src/lib/user) for the last round the person set. */
export const ROUND_STORAGE_KEY = "round";

export function readStoredRound(): Round | null {
  return parseStoredRound(userStore.get(ROUND_STORAGE_KEY));
}

function writeStoredRound(round: Round) {
  userStore.set(ROUND_STORAGE_KEY, serializeStoredRound(round));
}

/**
 * Our round from the URL (nuqs is the source of truth; `?raise=` and `?inst=`). Edits are also
 * remembered for the active person, which the top bar applies when a page opens without the params.
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
