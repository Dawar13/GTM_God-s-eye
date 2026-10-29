import { getFunds, getInvestors } from "@/lib/data";
import { toDirectoryRows } from "@/lib/data/directory";
import type { Investor } from "@/lib/schema";
import { DirectoryTable } from "./directory-table";

export async function Directory() {
  const [investors, funds] = await Promise.all([getInvestors(), getFunds()]);
  const rows = toDirectoryRows(investors, funds).sort((a, b) => a.name.localeCompare(b.name));
  const byId: Record<string, Investor> = Object.fromEntries(investors.map((i) => [i.id, i]));
  return <DirectoryTable rows={rows} investors={byId} />;
}
