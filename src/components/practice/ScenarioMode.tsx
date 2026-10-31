"use client";

import { useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { ChartTable } from "@/components/charts/ChartTable";
import { Button } from "@/components/ui/button";
import { NumberField, ShareBar, Stat } from "@/components/ui-atlas";
import { CALC_URL_OPTIONS } from "@/lib/calculators/url";
import { useLastValid } from "@/lib/calculators/useLastValid";
import { scenarioOutcome, type ScenarioRound } from "@/lib/finance";
import { formatPercent, formatPricePerShare, formatUsd } from "@/lib/format";
import {
  EXIT_COUNT,
  MAX_SAVED,
  SCENARIO_DEFAULTS,
  SCENARIO_START,
  addSaved,
  encodeExits,
  encodeRounds,
  exitsParser,
  isSavedList,
  nextName,
  removeSaved,
  roundsParser,
  type SavedScenario,
} from "@/lib/practice/scenarios";
import { PRACTICE_KEYS, useStored } from "@/lib/practice/storage";
import {
  finalOwnershipSegments,
  roundRows,
  type RoundRow,
} from "@/lib/viz/transforms/calcScenario";

const parsers = { prr: roundsParser, prx: exitsParser };
const NO_SCENARIOS: SavedScenario[] = [];

type Inputs = { rounds: ScenarioRound[]; exits: number[] };

function compute({ rounds, exits }: Inputs) {
  const outcome = scenarioOutcome({ ...SCENARIO_START, rounds, exitValues: exits });
  return {
    outcome,
    rows: roundRows(outcome, rounds),
    segments: finalOwnershipSegments(outcome),
  };
}

function outcomeOrNull(s: { rounds: ScenarioRound[]; exits: number[] }) {
  try {
    return scenarioOutcome({ ...SCENARIO_START, rounds: s.rounds, exitValues: s.exits });
  } catch {
    return null;
  }
}

/**
 * Build a three-round path to an exit. The cap table runs through `simulate`, the payouts
 * through the liquidation `distribute`. The path is in the URL, so a link shares it; up to five
 * paths can be saved in this browser and compared.
 */
export function ScenarioMode() {
  const [v, setV] = useQueryStates(parsers, CALC_URL_OPTIONS);
  const inputs = useMemo<Inputs>(() => ({ rounds: v.prr, exits: v.prx }), [v.prr, v.prx]);
  const { result, error, stale } = useLastValid(inputs, compute);
  const [saved, setSaved] = useStored(PRACTICE_KEYS.scenarios, NO_SCENARIOS, isSavedList);
  const [name, setName] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const setRound = (i: number, patch: Partial<ScenarioRound>) =>
    void setV({ prr: v.prr.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setExit = (i: number, value: number) =>
    void setV({ prx: v.prx.map((x, j) => (j === i ? value : x)) });

  const isDefault =
    encodeRounds(v.prr) === encodeRounds(SCENARIO_DEFAULTS.rounds) &&
    encodeExits(v.prx) === encodeExits(SCENARIO_DEFAULTS.exits);

  function save() {
    const r = addSaved(saved, {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || nextName(saved),
      rounds: v.prr,
      exits: v.prx,
    });
    if (r.saved) {
      setSaved(r.list);
      setName("");
      setNote("Saved in this browser.");
    } else {
      setNote(`${MAX_SAVED} scenarios are saved. Remove one to save another.`);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote("Link copied. It carries this path and these exits.");
    } catch {
      setNote("Could not copy. The address bar has the link.");
    }
  }

  const out = result?.outcome;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">
            Founders start with {SCENARIO_START.founderShares.toLocaleString("en-US")} shares and an
            unissued pool of {SCENARIO_START.poolShares.toLocaleString("en-US")}. Each round&apos;s
            investors hold 1× non-participating preferred, and the latest round is paid first.
          </p>
          {v.prr.map((r, i) => (
            <fieldset key={i} className="grid grid-cols-2 gap-3 rounded-lg border border-rule p-3">
              <legend className="px-1 text-sm font-medium">Round {i + 1}</legend>
              <NumberField
                label="Pre-money"
                kind="usd"
                min={100_000}
                max={100_000_000_000}
                slider={false}
                value={r.preMoney}
                onChange={(preMoney) => setRound(i, { preMoney })}
              />
              <NumberField
                label="Raise"
                kind="usd"
                min={50_000}
                max={10_000_000_000}
                slider={false}
                value={r.investment}
                onChange={(investment) => setRound(i, { investment })}
              />
            </fieldset>
          ))}
          <fieldset className="grid grid-cols-3 gap-3 rounded-lg border border-rule p-3">
            <legend className="px-1 text-sm font-medium">Exit values to compare</legend>
            {v.prx.slice(0, EXIT_COUNT).map((x, i) => (
              <NumberField
                key={i}
                label={`Exit ${i + 1}`}
                kind="usd"
                min={100_000}
                max={1_000_000_000_000}
                slider={false}
                value={x}
                onChange={(value) => setExit(i, value)}
              />
            ))}
          </fieldset>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDefault}
              onClick={() => void setV(null)}
            >
              Reset to example
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-negative bg-panel px-3 py-2 text-sm text-ink"
            >
              {error}{" "}
              <span className="text-ink-2">
                {stale ? "Showing the last valid result." : "Reset to the example to start again."}
              </span>
            </p>
          )}
          {result && out && (
            <>
              <div className="grid grid-cols-2 gap-6 rounded-xl border border-rule p-4 md:grid-cols-3">
                <Stat
                  label="Founders after round 3"
                  value={formatPercent(out.finalFounderOwnership)}
                />
                <Stat label="Raised in total" value={formatUsd(out.totalRaised)} />
                <Stat
                  label={`Founder payout at ${formatUsd(out.exits[1]?.exitValue)}`}
                  value={formatUsd(out.exits[1]?.founderPayout)}
                />
              </div>
              <ShareBar
                segments={result.segments}
                ariaLabel="Fully diluted ownership after round 3"
              />
              <ChartTable
                caption="The path, round by round"
                rows={result.rows}
                rowKey={(r: RoundRow) => r.key}
                columns={[
                  { header: "Round", cell: (r) => r.label },
                  { header: "Pre-money", numeric: true, cell: (r) => formatUsd(r.preMoney) },
                  { header: "Raise", numeric: true, cell: (r) => formatUsd(r.investment) },
                  { header: "Post-money", numeric: true, cell: (r) => formatUsd(r.postMoney) },
                  {
                    header: "Price per share",
                    numeric: true,
                    cell: (r) => formatPricePerShare(r.pricePerShare),
                  },
                  {
                    header: "Founders after",
                    numeric: true,
                    highlight: true,
                    cell: (r) => formatPercent(r.founderOwnership),
                  },
                ]}
              />
              <ChartTable
                caption="What the founders receive at each exit"
                rows={out.exits}
                rowKey={(e) => String(e.exitValue)}
                columns={[
                  { header: "Exit value", numeric: true, cell: (e) => formatUsd(e.exitValue) },
                  {
                    header: "Founder payout",
                    numeric: true,
                    highlight: true,
                    cell: (e) => formatUsd(e.founderPayout),
                  },
                  {
                    header: "Share of the exit",
                    numeric: true,
                    cell: (e) => formatPercent(e.founderShareOfExit),
                  },
                ]}
              />
              <p className="text-xs text-ink-2">
                Ownership is fully diluted and counts the unissued pool. Payouts leave the pool out,
                so a founder&apos;s share of an exit can be above their ownership.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="scenario-name" className="text-sm font-medium">
                    Scenario name
                  </label>
                  <input
                    id="scenario-name"
                    type="text"
                    maxLength={30}
                    value={name}
                    placeholder={nextName(saved)}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 w-44 rounded-md border border-rule bg-panel px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
                <Button type="button" onClick={save} disabled={error !== null}>
                  Save scenario
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyLink()}>
                  Copy link
                </Button>
                <span className="text-sm text-ink-2">
                  <span className="num">{saved.length}</span> of {MAX_SAVED} saved
                </span>
              </div>
              {note && (
                <p role="status" className="text-sm text-ink-2">
                  {note}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {saved.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Saved scenarios</h3>
          <ChartTable
            caption="Saved scenarios side by side"
            rows={saved}
            rowKey={(s) => s.id}
            columns={[
              { header: "Name", cell: (s) => s.name },
              {
                header: "Raised",
                numeric: true,
                cell: (s) => formatUsd(outcomeOrNull(s)?.totalRaised),
              },
              {
                header: "Founders after round 3",
                numeric: true,
                highlight: true,
                cell: (s) => formatPercent(outcomeOrNull(s)?.finalFounderOwnership),
              },
              ...[0, 1, 2].map((i) => ({
                header: `Founder payout, exit ${i + 1}`,
                numeric: true,
                cell: (s: SavedScenario) => {
                  const e = outcomeOrNull(s)?.exits[i];
                  return e ? `${formatUsd(e.founderPayout)} at ${formatUsd(e.exitValue)}` : "—";
                },
              })),
              {
                header: "Actions",
                cell: (s) => (
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void setV({ prr: s.rounds, prx: s.exits })}
                      aria-label={`Load ${s.name}`}
                    >
                      Load
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSaved(removeSaved(saved, s.id))}
                      aria-label={`Remove ${s.name}`}
                    >
                      Remove
                    </Button>
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
