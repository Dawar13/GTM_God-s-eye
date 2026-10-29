import { PageCanvas } from "@/components/shell/PageCanvas";
import { VC_MATH_TOOLS } from "@/lib/nav";

const TABS = VC_MATH_TOOLS.map((t) => ({ href: `/vc-math/${t.slug}`, label: t.label }));

export default function VcMathLayout({ children }: LayoutProps<"/vc-math">) {
  return (
    <PageCanvas title="VC math" tabs={TABS}>
      {children}
    </PageCanvas>
  );
}
