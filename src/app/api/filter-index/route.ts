import { getFilterIndex } from "@/lib/data/entities";

/** Per-investor filter fields (no names), for the filter bar's chip counts. */
export async function GET() {
  return Response.json(await getFilterIndex());
}
