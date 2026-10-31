"use client";

import { useEffect, useId } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NumberField } from "@/components/ui-atlas";
import {
  DEFAULT_ROUND,
  formatRound,
  INSTRUMENT_LABELS,
  INSTRUMENTS,
  isDefaultRound,
  isInstrument,
  RAISE_MAX_USD,
  RAISE_MIN_USD,
} from "@/lib/round";
import { readStoredRound, useRound } from "@/lib/round/use-round";

/**
 * A page that opens without `?raise=` or `?inst=` starts from the round the user last set
 * (remembered in localStorage). Writing the params into the URL lets the server-rendered
 * Command page and every link see the same round.
 */
function useRestoreRound() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { setRound } = useRound();
  const hasRaise = params.has("raise");
  const hasInst = params.has("inst");
  useEffect(() => {
    if (hasRaise && hasInst) return;
    const stored = readStoredRound();
    if (!stored) return;
    const patch: Partial<typeof stored> = {};
    if (!hasRaise && stored.raise !== DEFAULT_ROUND.raise) patch.raise = stored.raise;
    if (!hasInst && stored.inst !== DEFAULT_ROUND.inst) patch.inst = stored.inst;
    if (Object.keys(patch).length) setRound(patch, { remember: false });
    // Runs when the page or the presence of the params changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRaise, hasInst, pathname]);
}

/** "Our round: $1.0M · Post-money SAFE", in the top bar of every page; opens the editor. */
export function RoundControl() {
  const round = useRound();
  const selectId = useId();
  useRestoreRound();
  const label = formatRound(round);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Our round: ${label}. Change the raise and instrument`}
          className="h-8 gap-2 border-rule bg-panel text-ink-2 hover:text-ink"
        >
          <Coins aria-hidden />
          <span className="hidden whitespace-nowrap md:inline">
            Our round: <span className="text-ink tabular-nums">{label}</span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">Our round</h2>
          <p className="text-xs text-muted">
            Used across the app and kept in the link. The raise moves every investor&apos;s check
            size fit. The instrument does not change any fit score, because no fit feature depends
            on it; it highlights matching benchmarks on Strategy and sets where the SAFE, note and
            round builder calculators start.
          </p>
        </div>
        <NumberField
          label="Raise"
          kind="usd"
          value={round.raise}
          onChange={(raise) => round.setRound({ raise })}
          min={RAISE_MIN_USD}
          max={RAISE_MAX_USD}
          slider="log"
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">
            Instrument
          </label>
          <select
            id={selectId}
            value={round.inst}
            onChange={(e) => {
              if (isInstrument(e.target.value)) round.setRound({ inst: e.target.value });
            }}
            className="h-8 w-full rounded-md border border-rule bg-panel px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i}>
                {INSTRUMENT_LABELS[i]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={round.reset}
            disabled={isDefaultRound(round)}
          >
            Reset to {formatRound(DEFAULT_ROUND)}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
