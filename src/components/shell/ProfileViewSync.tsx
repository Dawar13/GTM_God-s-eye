"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { decodeWeights } from "@/lib/fit/weights";
import { filterParsers, parseFilters } from "@/lib/filters/url";
import { filtersApply } from "@/lib/nav";
import { parseRound, roundParsers, roundUrlOptions } from "@/lib/round/url";
import { weightsParser } from "@/lib/strategy/url";
import { viewsToApply, type ViewGroup } from "@/lib/user/view";
import { useProfile } from "@/lib/user/use-profile";
import { readStoredViews } from "@/lib/user/view-store";
import { useInspectorStore } from "@/store/inspector";
import { useUi } from "@/store/ui";

const parsers = { ...roundParsers, ...filterParsers, w: weightsParser };

/**
 * Applies the active person's remembered view settings. A page that opens without our round,
 * Strategy weights or investor filters in its URL starts from the ones this person last used;
 * a link that carries them wins and nothing stored is overwritten. When the person switches
 * profile, the URL still shows the previous person's settings, so everything is replaced with
 * the new person's (theme, rail and drawer width included) without reloading.
 */
export function ProfileViewSync() {
  const { active } = useProfile();
  const profileId = active?.id ?? null;
  const pathname = usePathname();
  const params = useSearchParams();
  const [, setValues] = useQueryStates(parsers, roundUrlOptions);
  const lastProfile = useRef<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    const switched = lastProfile.current !== null && lastProfile.current !== profileId;
    lastProfile.current = profileId;
    if (switched) {
      useUi.getState().applyProfile();
      useInspectorStore.getState().applyProfile();
    }
    const groups: ViewGroup[] = ["round"];
    if (filtersApply(pathname)) groups.push("filters");
    if (pathname === "/strategy" || pathname.startsWith("/strategy/")) groups.push("weights");

    const todo = viewsToApply(params, readStoredViews(), {
      ignoreUrl: switched,
      groups,
    });
    const patch: Record<string, unknown> = {};
    if (todo.round !== undefined) Object.assign(patch, parseRound(todo.round));
    if (todo.filters !== undefined) Object.assign(patch, parseFilters(todo.filters));
    if (todo.weights !== undefined) patch.w = decodeWeights(todo.weights);
    if (Object.keys(patch).length === 0) return;
    // Command renders on the server from the URL, so it refetches.
    void setValues(patch, pathname === "/" ? { shallow: false } : undefined);
    // Runs when the page or the profile changes, not on every edit or URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, pathname]);

  return null;
}
