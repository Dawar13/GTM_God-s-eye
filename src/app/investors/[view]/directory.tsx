import { getFitFeatures, getFunds, getInvestors } from "@/lib/data";
import { toDirectoryRows } from "@/lib/data/directory";
import { DirectoryTable } from "./directory-table";

export async function Directory() {
  const [investors, funds, fits] = await Promise.all([
    getInvestors(),
    getFunds(),
    getFitFeatures(),
  ]);
  const rows = toDirectoryRows(investors, funds, fits);
  return <DirectoryTable rows={rows} />;
}
