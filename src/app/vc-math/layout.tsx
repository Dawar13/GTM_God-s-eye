import { PageCanvas } from "@/components/shell/PageCanvas";
import { PracticePanel } from "@/components/practice/PracticePanel";
import { PracticeToggle } from "@/components/practice/PracticeToggle";

export default function VcMathLayout({ children }: LayoutProps<"/vc-math">) {
  return (
    <PageCanvas>
      <div className="mb-2 flex justify-end">
        <PracticeToggle />
      </div>
      <PracticePanel />
      {children}
    </PageCanvas>
  );
}
