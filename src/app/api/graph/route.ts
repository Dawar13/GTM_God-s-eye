import { getGraphPayload } from "@/lib/data/graph";

/** The Network view's graph in its compact client format; fetched by that view only. */
export async function GET() {
  return Response.json(await getGraphPayload());
}
