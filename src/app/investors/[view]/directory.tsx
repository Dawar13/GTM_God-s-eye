import {
  getBubbleLayout,
  getFitFeatures,
  getFunds,
  getInvestors,
  getThesisLayout,
} from "@/lib/data";
import { toAreaCoords, toDirectoryRows } from "@/lib/data/directory";
import { DirectoryTable } from "./directory-table";

export async function Directory() {
  const [investors, funds, fits, layout, bubbles] = await Promise.all([
    getInvestors(),
    getFunds(),
    getFitFeatures(),
    getThesisLayout(),
    getBubbleLayout(),
  ]);
  const rows = toDirectoryRows(investors, funds, fits);
  return <DirectoryTable rows={rows} areaCoords={toAreaCoords(layout, bubbles)} />;
}
