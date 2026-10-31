import { toColumns } from "@/lib/data/columns";
import { getStrategyRows } from "@/lib/data/entities";
import { STRATEGY_DETAIL_KEYS } from "@/lib/viz/transforms/strategy";

/** Strategy's own fields for every investor, column-wise; filter fields come from /api/filter-index. */
export async function GET() {
  return Response.json(toColumns(await getStrategyRows(), STRATEGY_DETAIL_KEYS));
}
