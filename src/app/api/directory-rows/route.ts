import { toColumns } from "@/lib/data/columns";
import { DIRECTORY_DETAIL_KEYS } from "@/lib/data/directory";
import { getDirectoryRows } from "@/lib/data/entities";

/** The Directory's own fields for every investor, column-wise; filter fields come from /api/filter-index. */
export async function GET() {
  return Response.json(toColumns(await getDirectoryRows(), DIRECTORY_DETAIL_KEYS));
}
