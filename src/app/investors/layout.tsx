import { PageCanvas } from "@/components/shell/PageCanvas";
import { INVESTOR_VIEWS } from "@/lib/nav";

const TABS = INVESTOR_VIEWS.map((v) => ({ href: `/investors/${v.slug}`, label: v.label }));

export default function InvestorsLayout({ children }: LayoutProps<"/investors">) {
  return (
    <PageCanvas title="Investors" tabs={TABS}>
      {children}
    </PageCanvas>
  );
}
