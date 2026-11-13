import { CheckSizes } from "@/components/charts/CheckSizes";
import { getFunds, getInvestors } from "@/lib/data";
import { toCheckRows } from "@/lib/viz/transforms/checkSizes";

export async function CheckSizesView() {
  const [investors, funds] = await Promise.all([getInvestors(), getFunds()]);
  return <CheckSizes data={toCheckRows(investors, funds)} />;
}
