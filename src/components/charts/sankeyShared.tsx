import type { ReactNode } from "react";
import { Segmented, VizTooltip } from "@/components/ui-atlas";
import { formatCount, formatPartialDate, formatUsd, UNKNOWN } from "@/lib/format";
import { COMPETITOR_CATEGORY_LABELS, LAYER_LABELS } from "@/lib/format/labels";
import { OTHER_GREY, withOpacity } from "@/lib/viz";
import type { FlowRound, FlowTarget, SankeyMode } from "@/lib/viz/transforms/competitorSankey";

/** The two views of "Who funds our competitors". */
export type SankeyView = "overview" | "pairs";

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${formatCount(n)} ${n === 1 ? one : many}`;

export const clip = (s: string, max: number) =>
  s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;

/** Money behind a node or band: split among named investors it is an estimate, "not named" is whole. */
export const moneyText = (usd: number | null, exact: boolean, long = false) =>
  exact
    ? `${formatUsd(usd)}${long ? " disclosed" : ""}`
    : `~${formatUsd(usd)}${long ? " estimated" : ""}`;

/** Rounds as drawn in the rounds view: whole numbers plain, splits to one decimal. */
export const share = (v: number) =>
  Math.abs(v - Math.round(v)) < 1e-9 ? formatCount(Math.round(v)) : v.toFixed(1);

export function dateSpan(rounds: readonly FlowRound[]): string | null {
  const dated = rounds.map((r) => r.date).filter((d): d is string => d !== null);
  if (dated.length === 0) return rounds.length ? "Dates not recorded" : null;
  const first = formatPartialDate(dated[0]);
  const last = formatPartialDate(dated[dated.length - 1]);
  return first === last ? first : `${first} to ${last}`;
}

/** The hatch that marks "Investors not named": grey stripes on a light grey wash. */
export function HatchPattern({ id, size = 6 }: { id: string; size?: number }) {
  return (
    <pattern
      id={id}
      width={size}
      height={size}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width={size} height={size} fill={withOpacity(OTHER_GREY, size > 4 ? 0.25 : 0.2)} />
      <line x1="0" y1="0" x2="0" y2={size} stroke={OTHER_GREY} strokeWidth={size > 4 ? 2.5 : 2} />
    </pattern>
  );
}

/** A competitor node's tooltip, in either view. */
export function competitorTip(t: FlowTarget, mode: SankeyMode): ReactNode {
  const differs =
    t.totalRaisedUsd !== null &&
    t.disclosedUsd !== null &&
    Math.abs(t.totalRaisedUsd - t.disclosedUsd) >= 1;
  return (
    <VizTooltip
      className="max-w-80"
      title={t.name}
      value={
        mode === "money"
          ? `${formatUsd(t.disclosedUsd)} in disclosed rounds`
          : plural(t.rounds, "round")
      }
      period={`${COMPETITOR_CATEGORY_LABELS[t.category]} · ${LAYER_LABELS[t.layer]}`}
      confidence={t.confidence}
      sourceDomain={t.sourceDomain}
    >
      <p className="tabular-nums">
        {formatCount(t.roundsWithAmount)} of {plural(t.rounds, "round")} with a disclosed amount.
      </p>
      {differs && (
        <p className="tabular-nums">
          The table&apos;s total raised is {formatUsd(t.totalRaisedUsd)}, not the{" "}
          {formatUsd(t.disclosedUsd)} these rounds add up to.
        </p>
      )}
      {t.totalRaisedUsd === null && t.disclosedUsd !== null && (
        <p>The table has no stored total raised for it ({UNKNOWN}).</p>
      )}
      <p>Click to open the competitor.</p>
    </VizTooltip>
  );
}

/** View and band-width toggles, shown at the top right of either view. */
export function SankeyControls({
  view,
  onView,
  mode,
  onMode,
  moneyLabel,
}: {
  view: SankeyView;
  onView: (v: SankeyView) => void;
  mode: SankeyMode;
  onMode: (m: SankeyMode) => void;
  moneyLabel: string;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Segmented
        label="Sankey view"
        value={view}
        onChange={onView}
        options={[
          { value: "overview", label: "Overview" },
          { value: "pairs", label: "Investor → competitor" },
        ]}
      />
      <Segmented
        label="Band width"
        value={mode}
        onChange={onMode}
        options={[
          { value: "money", label: moneyLabel },
          { value: "rounds", label: "Number of rounds" },
        ]}
      />
    </div>
  );
}
