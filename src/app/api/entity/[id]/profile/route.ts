import { getInvestorProfile } from "@/lib/data/profile";

/** The Inspector's investor profile: fit breakdown, thesis, funds, partners, deals. Investors only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/entity/[id]/profile">) {
  const { id } = await ctx.params;
  const profile = id.startsWith("inv_") ? await getInvestorProfile(id) : null;
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(profile);
}
