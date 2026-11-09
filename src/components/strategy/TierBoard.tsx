"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FindBox, FindMark, Panel } from "@/components/ui-atlas";
import { formatCount } from "@/lib/format";
import { useInspector } from "@/lib/hooks/useInspector";
import { useFindQuery } from "@/lib/search/find-state";
import { matchRecord } from "@/lib/search/match";
import {
  liveOverrides,
  OUTREACH_TIERS,
  TIER_A_MIN,
  TIER_B_MIN,
  toTierBoard,
  type OutreachTier,
  type Ranked,
  type TierOverrides,
} from "@/lib/viz/transforms/strategy";
import { cn } from "@/lib/utils";
import { FlagChips } from "./RankedList";

const PAGE = 10;

const TIER_NOTE: Record<OutreachTier, string> = {
  A: `Fit ${TIER_A_MIN} or more: reach out first`,
  B: `Fit ${TIER_B_MIN} to ${TIER_A_MIN}: next`,
  C: `Fit under ${TIER_B_MIN}, or sparse data: later`,
};

/**
 * Tier columns A, B and C. A card starts in the tier its score gives it; drag it to another
 * column, or use its "Move to tier" menu (the keyboard route), to override. Overrides are kept
 * in this browser and marked "manual"; they never touch the data.
 */
export function TierBoard({
  ranked,
  overrides,
  onMove,
  onReset,
}: {
  ranked: readonly Ranked[];
  overrides: TierOverrides;
  /** `null` puts the investor back in the tier its score gives it. */
  onMove: (id: string, tier: OutreachTier | null) => void;
  onReset: () => void;
}) {
  const { open } = useInspector();
  const board = toTierBoard(ranked, overrides);
  const manual = liveOverrides(ranked, overrides);
  const [shown, setShown] = useState<Record<OutreachTier, number>>({ A: PAGE, B: PAGE, C: PAGE });
  const [over, setOver] = useState<OutreachTier | null>(null);
  const [announce, setAnnounce] = useState("");
  const byId = new Map(ranked.map((r) => [r.row.id, r]));
  // The find box narrows each column by name; tiers and overrides are unchanged.
  const find = useFindQuery();
  const q = find.query.trim();
  const keep = (r: Ranked) => !q || matchRecord(q, r.row.name) !== null;
  const found = q ? ranked.filter(keep).length : ranked.length;

  function move(id: string, tier: OutreachTier) {
    const r = byId.get(id);
    if (!r) return;
    onMove(id, tier === r.autoTier ? null : tier);
    setAnnounce(
      `${r.row.name} moved to tier ${tier}${tier === r.autoTier ? ", the tier its score gives" : ", manual"}.`,
    );
  }

  return (
    <Panel className="flex flex-col gap-3" aria-labelledby="tiers-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="tiers-title" className="text-lg font-semibold">
            Outreach tiers
          </h3>
          <p className="text-sm text-ink-2">
            Drag a card to another column, or use the Move to tier menu on it. Changes are kept in
            this browser and marked manual.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FindBox
            label="Find in tiers"
            value={find.input}
            onValueChange={find.setInput}
            matches={found}
            total={ranked.length}
          />
          <Button variant="outline" size="sm" onClick={onReset} disabled={manual === 0}>
            Reset manual tiers{manual > 0 ? ` (${formatCount(manual)})` : ""}
          </Button>
        </div>
      </header>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {OUTREACH_TIERS.map((tier) => {
          const list = q ? board[tier].filter(keep) : board[tier];
          const visible = list.slice(0, shown[tier]);
          return (
            <section
              key={tier}
              aria-label={`Tier ${tier}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(tier);
              }}
              onDragLeave={() => setOver((t) => (t === tier ? null : t))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) move(id, tier);
              }}
              className={cn(
                "flex min-h-40 flex-col gap-2 rounded-lg border border-rule bg-panel-sunk p-2 transition-colors",
                over === tier && "border-accent bg-accent-soft",
              )}
            >
              <header className="px-1">
                <h4 className="flex items-baseline justify-between text-sm font-semibold">
                  <span>Tier {tier}</span>
                  <span className="tabular-nums">{formatCount(list.length)}</span>
                </h4>
                <p className="text-xs text-ink-2">{TIER_NOTE[tier]}</p>
              </header>
              <ul className="flex flex-col gap-1.5">
                {visible.map((r) => {
                  const isManual = overrides[r.row.id] !== undefined;
                  return (
                    <li
                      key={r.row.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", r.row.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="flex cursor-grab flex-col gap-1.5 rounded-md border border-rule bg-panel p-2 active:cursor-grabbing"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 truncate rounded-sm text-left text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                          onClick={() => open(r.row.id)}
                        >
                          <FindMark text={r.row.name} query={q} />
                        </button>
                        <span className="text-sm tabular-nums">{r.score.total.toFixed(1)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <FlagChips row={r.row} />
                        {isManual && (
                          <span className="rounded-md border border-accent px-1.5 py-0.5 text-xs">
                            manual
                          </span>
                        )}
                      </div>
                      <select
                        aria-label={`Move ${r.row.name} to tier`}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) move(r.row.id, e.target.value as OutreachTier);
                        }}
                        className="h-7 rounded-md border border-rule bg-panel px-1.5 text-xs text-ink-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                      >
                        <option value="">Move to tier…</option>
                        {OUTREACH_TIERS.filter((t) => t !== tier).map((t) => (
                          <option key={t} value={t}>
                            Tier {t}
                            {t === r.autoTier ? " (back to score)" : ""}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
              {visible.length < list.length && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShown((s) => ({ ...s, [tier]: s[tier] + PAGE }))}
                >
                  Show {formatCount(Math.min(PAGE, list.length - visible.length))} more (
                  {formatCount(list.length - visible.length)} left)
                </Button>
              )}
              {list.length === 0 && (
                <p className="px-1 text-sm text-ink-2">
                  {q ? "No name here matches." : "Nobody here. Drag a card in."}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}
