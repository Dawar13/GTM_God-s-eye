/**
 * A region brushed on the thesis map, as one short URL value the Directory resolves to ids:
 * `?area=thesis:-1.25,2.5,3.75,6` (layout, then x0,y0,x1,y1 in that layout's coordinates).
 * `thesis` is the UMAP position from layout_thesis; `fit` is industrial affinity (x) and
 * stage earliness (y). Bounds are inclusive, normalised so x0 <= x1 and y0 <= y1, and kept
 * to AREA_DECIMALS so the map and the Directory test the same rectangle.
 *
 * Pure and client-safe.
 */
import { createParser } from "nuqs/server";

export const AREA_PARAM = "area";
export const AREA_LAYOUTS = ["thesis", "fit"] as const;
export type AreaLayout = (typeof AREA_LAYOUTS)[number];

export type Area = { layout: AreaLayout; x0: number; y0: number; x1: number; y1: number };

export const AREA_DECIMALS = 3;

const round = (v: number) => {
  const r = Number(v.toFixed(AREA_DECIMALS));
  return Object.is(r, -0) ? 0 : r;
};

/** Orders the corners and rounds them to the URL precision. */
export function normalizeArea(area: Area): Area {
  return {
    layout: area.layout,
    x0: round(Math.min(area.x0, area.x1)),
    y0: round(Math.min(area.y0, area.y1)),
    x1: round(Math.max(area.x0, area.x1)),
    y1: round(Math.max(area.y0, area.y1)),
  };
}

const NUM = String.raw`-?\d+(?:\.\d+)?`;
const PATTERN = new RegExp(`^(${AREA_LAYOUTS.join("|")}):(${NUM}),(${NUM}),(${NUM}),(${NUM})$`);

/** Parses a URL value; anything malformed is null (ignored, never guessed). */
export function parseArea(value: string | null | undefined): Area | null {
  if (!value) return null;
  const m = PATTERN.exec(value.trim());
  if (!m) return null;
  const [x0, y0, x1, y1] = [m[2], m[3], m[4], m[5]].map(Number) as [number, number, number, number];
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
  return normalizeArea({ layout: m[1] as AreaLayout, x0, y0, x1, y1 });
}

export function serializeArea(area: Area): string {
  const a = normalizeArea(area);
  return `${a.layout}:${a.x0},${a.y0},${a.x1},${a.y1}`;
}

/** Whether a point (in the area's layout) lies inside it. Unknown coordinates never match. */
export function inArea(xy: readonly [number, number] | null | undefined, area: Area): boolean {
  if (!xy) return false;
  const [x, y] = xy;
  return x >= area.x0 && x <= area.x1 && y >= area.y0 && y <= area.y1;
}

/** nuqs parser for `?area=`; replace history so brushing does not flood the back button. */
export const parseAsArea = createParser<Area>({
  parse: (v) => parseArea(v),
  serialize: (a) => serializeArea(a),
  eq: (a, b) => serializeArea(a) === serializeArea(b),
});

export const AREA_LABELS: Record<AreaLayout, string> = {
  thesis: "Thesis map region",
  fit: "Fit view region",
};
