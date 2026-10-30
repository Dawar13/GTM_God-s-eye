import { getPaletteIndex } from "@/lib/data/entities";

/** Names for the command palette, fetched when it first opens. */
export async function GET() {
  return Response.json(await getPaletteIndex());
}
