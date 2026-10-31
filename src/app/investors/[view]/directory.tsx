import { getBubbleLayout, getThesisLayout } from "@/lib/data";
import { toAreaCoords } from "@/lib/data/directory";
import { DirectoryTable } from "./directory-table";

/**
 * The rows load from /api/directory-rows in the browser, so they are not in the page HTML or
 * in other pages' prefetches of this route. Only the map positions (about 560) ship here.
 *
 * Height: the table grows to the bottom of the window and scrolls inside. Every box from the
 * page canvas down is a column flex item with a 0px basis, so its own content (thousands of
 * virtual rows) never sets its height; the free space does, down to the table's 420px floor.
 */
export async function Directory() {
  const [layout, bubbles] = await Promise.all([getThesisLayout(), getBubbleLayout()]);
  return (
    <div className="flex flex-[1_1_0px] flex-col gap-3">
      <p className="max-w-prose text-sm text-ink-2">
        Every investor in the data, one row each. The filters above narrow the list; sort by any
        column, and open a row for the full profile.
      </p>
      <DirectoryTable areaCoords={toAreaCoords(layout, bubbles)} />
    </div>
  );
}
