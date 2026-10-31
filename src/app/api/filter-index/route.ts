import { FILTERABLE_KEYS, toColumns } from "@/lib/data/columns";
import { getFilterIndex } from "@/lib/data/entities";

/** Per-investor filter fields (no names), column-wise, for the filter bar and investor views. */
export async function GET() {
  return Response.json(toColumns(await getFilterIndex(), FILTERABLE_KEYS));
}
