import { getBubbleLayout, getThesisLayout } from "@/lib/data";
import { toAreaCoords } from "@/lib/data/directory";
import { DirectoryTable } from "./directory-table";

/**
 * The rows load from /api/directory-rows in the browser, so they are not in the page HTML or
 * in other pages' prefetches of this route. Only the map positions (about 560) ship here.
 */
export async function Directory() {
  const [layout, bubbles] = await Promise.all([getThesisLayout(), getBubbleLayout()]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="max-w-prose text-sm text-ink-2">
        Every investor in the data, one row each. The filters above narrow the list; sort by any
        column, and open a row for the full profile.
      </p>
      <DirectoryTable areaCoords={toAreaCoords(layout, bubbles)} />
    </div>
  );
}
