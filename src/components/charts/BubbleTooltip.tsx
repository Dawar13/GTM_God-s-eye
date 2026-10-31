import { VizTooltip } from "@/components/ui-atlas";
import { formatUsd, UNKNOWN } from "@/lib/format";
import { INVESTOR_TYPE_LABELS } from "@/lib/format/labels";
import type { BubbleRow } from "@/lib/viz/transforms/capitalBubbles";
import type { ClusterInfo } from "@/lib/viz/transforms/thesisMap";

function checkRange(p: BubbleRow): string {
  const { checkMin: min, checkMax: max } = p;
  if (min !== null && max !== null) {
    return min === max ? formatUsd(min) : `${formatUsd(min)}–${formatUsd(max)}`;
  }
  return formatUsd(min ?? max);
}

/** The capital bubbles hover card, shared by the 3D view and the 2D projections. */
export function BubbleTooltip({
  p,
  cluster,
  computedAt,
}: {
  p: BubbleRow;
  cluster: ClusterInfo | undefined;
  computedAt: string;
}) {
  return (
    <VizTooltip
      title={p.name}
      value={`${formatUsd(p.check)} typical check`}
      period={
        p.fundUsd === null
          ? `Axes computed ${computedAt}`
          : `Latest fund ${formatUsd(p.fundUsd)}${p.fundPeriod ? `, ${p.fundPeriod}` : ""}`
      }
      confidence={p.confidence}
      sourceDomain={p.sourceDomain}
    >
      <p className="tabular-nums">Check range {checkRange(p)}</p>
      <p className="tabular-nums">
        Stage earliness {p.earliness.toFixed(2)} · industrial affinity {p.affinity.toFixed(2)}
      </p>
      {p.fundUsd === null && <p>Latest fund size {UNKNOWN} (ring, not to scale)</p>}
      <p>{cluster ? cluster.label : "No cluster"}</p>
      {p.type && <p>{INVESTOR_TYPE_LABELS[p.type]}</p>}
    </VizTooltip>
  );
}
