/** Pure zoom math shared by every zoomable chart. */
export const ZOOM_STEP = 1.4;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 20;

export const clampZoom = (k: number, min = ZOOM_MIN, max = ZOOM_MAX): number =>
  Math.min(max, Math.max(min, k));

/** The zoom level after one step in or out, clamped. */
export function stepZoom(
  k: number,
  dir: 1 | -1,
  min = ZOOM_MIN,
  max = ZOOM_MAX,
  step = ZOOM_STEP,
): number {
  return clampZoom(dir === 1 ? k * step : k / step, min, max);
}

/** "150%" for a zoom level of 1.5 (1 is the first, fitted view). */
export const zoomPercent = (k: number): string => `${Math.round(k * 100)}%`;
