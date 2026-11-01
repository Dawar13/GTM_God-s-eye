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

/**
 * The zoom factor for one wheel event, proportional to its delta (d3-zoom's default curve):
 * a mouse notch (100px) is about ×1.15, a trackpad's small deltas give small steps, and a
 * trackpad pinch (ctrlKey) is ten times as sensitive. `deltaMode` 1 is lines, 2 is pages.
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0, ctrlKey = false): number {
  const perUnit = deltaMode === 1 ? 0.05 : deltaMode ? 1 : 0.002;
  return 2 ** (-deltaY * perUnit * (ctrlKey ? 10 : 1));
}

/**
 * A zoom level read by a ZoomControls readout without re-rendering the chart: `set` is cheap,
 * and listeners hear at most once per animation frame, only when the rounded percent changes.
 */
export type ZoomReadout = {
  set: (level: number) => void;
  /** The level as a whole percent. */
  get: () => number;
  subscribe: (listener: () => void) => () => void;
};

export function createZoomReadout(level = 1): ZoomReadout {
  let latest = level;
  let shown = Math.round(level * 100);
  let frame = 0;
  const listeners = new Set<() => void>();
  const flush = () => {
    frame = 0;
    const p = Math.round(latest * 100);
    if (p === shown) return;
    shown = p;
    listeners.forEach((l) => l());
  };
  return {
    set: (k) => {
      latest = k;
      if (frame || Math.round(k * 100) === shown) return;
      if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(flush);
      else flush();
    },
    get: () => shown,
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
