/** A d3-zoom style view: screen = k · unzoomed + (x, y). */
export type ZoomView = { k: number; x: number; y: number };

/** Idle time after the last zoom event before a chart renders again at the new view. */
export const ZOOM_SETTLE_MS = 120;

/**
 * Moves an SVG chart rendered at view `from` to the live view `to` without React, so a wheel
 * or pinch gesture costs one attribute write per element per frame instead of a full render.
 * The two views differ by a scale s and an offset o (live = s · rendered + o). Elements opt in
 * with data attributes holding their rendered position:
 * - `data-zx` / `data-zy`: translated so that point follows the zoom while the element keeps its
 *   size (marks, labels); with only one of them the element moves along that axis only (ticks,
 *   reference lines spanning the plot).
 * - `data-zaffine`: scaled with the view (areas such as hulls); strokes on them should use
 *   `vector-effect: non-scaling-stroke`.
 * Equal views clear every transform, which is how a chart hands back to its React render.
 */
export function paintZoom(root: Element, from: ZoomView, to: ZoomView): void {
  const s = to.k / from.k;
  const ox = to.x - from.x * s;
  const oy = to.y - from.y * s;
  const same = Math.abs(s - 1) < 1e-9 && Math.abs(ox) < 1e-6 && Math.abs(oy) < 1e-6;
  for (const el of root.querySelectorAll("[data-zx],[data-zy],[data-zaffine]")) {
    if (same) {
      el.removeAttribute("transform");
    } else if (el.hasAttribute("data-zaffine")) {
      el.setAttribute("transform", `matrix(${s} 0 0 ${s} ${ox} ${oy})`);
    } else {
      const zx = el.getAttribute("data-zx");
      const zy = el.getAttribute("data-zy");
      const dx = zx === null ? 0 : (s - 1) * Number(zx) + ox;
      const dy = zy === null ? 0 : (s - 1) * Number(zy) + oy;
      el.setAttribute("transform", `translate(${dx} ${dy})`);
    }
  }
}

/** One finger scrolls the page until the chart is zoomed in, then pans it. */
export function setZoomTouchAction(el: SVGElement, k: number): void {
  el.style.touchAction = k > 1 ? "none" : "pan-y";
}
