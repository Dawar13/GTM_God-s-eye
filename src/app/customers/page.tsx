import type { Metadata } from "next";
import { CustomersView } from "@/components/charts/CustomersView";
import { PageCanvas } from "@/components/shell/PageCanvas";
import { getCompetitors, getTargetCustomers } from "@/lib/data";
import { toCustomerRows } from "@/lib/viz/transforms/customers";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const [customers, competitors] = await Promise.all([getTargetCustomers(), getCompetitors()]);
  const rows = toCustomerRows(customers, competitors);
  return (
    <PageCanvas
      title="Customers"
      description="Industrial companies to sell to in India, from your Mumbai–Pune, Bengaluru and Hyderabad target lists. Investor filters don't apply here."
    >
      <CustomersView rows={rows} />
    </PageCanvas>
  );
}
