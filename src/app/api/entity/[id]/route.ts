import { getEntityHeader } from "@/lib/data/entities";

/** Header-level facts for the Inspector: name, type, HQ, website, sources. */
export async function GET(_req: Request, ctx: RouteContext<"/api/entity/[id]">) {
  const { id } = await ctx.params;
  const entity = await getEntityHeader(id);
  if (!entity) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(entity);
}
