/**
 * Find highlighting for SVG and HTML charts without a React render: elements opt in with
 * `data-find-id` (one id, or several separated by spaces, e.g. a link between two nodes).
 * While a query is active the root gets `data-finding`, matches get `data-found` and the
 * active match `data-find-active`; CSS in globals.css fades the rest. Call it after each
 * chart render (new elements start unpainted) and when the matches change.
 */
export function paintFind(
  root: Element | null,
  found: ReadonlySet<string> | null,
  active: string | null = null,
): void {
  if (!root) return;
  if (found) root.setAttribute("data-finding", "");
  else root.removeAttribute("data-finding");
  for (const el of root.querySelectorAll("[data-find-id]")) {
    if (!found) {
      el.removeAttribute("data-found");
      el.removeAttribute("data-find-active");
      continue;
    }
    const ids = el.getAttribute("data-find-id")!.split(" ");
    const hit = ids.some((id) => found.has(id));
    if (hit) el.setAttribute("data-found", "");
    else el.removeAttribute("data-found");
    if (active !== null && ids.includes(active)) el.setAttribute("data-find-active", "");
    else el.removeAttribute("data-find-active");
  }
}
