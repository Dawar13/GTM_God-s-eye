import type { InvestorType } from "@/lib/schema/enums";

export type MarkerShape = "circle" | "square";

/**
 * The mark shape for an investor in any chart (thesis map, bubbles, network): accelerators
 * and incubators are squares, every other type, and an unknown type, a circle. Shape, not
 * colour, so it still reads when colour carries the cluster.
 */
export function markerShapeFor(type: InvestorType | null | undefined): MarkerShape {
  return type === "accelerator" || type === "incubator" ? "square" : "circle";
}
