import { PageCanvas } from "@/components/shell/PageCanvas";

export default function VcMathLayout({ children }: LayoutProps<"/vc-math">) {
  return <PageCanvas>{children}</PageCanvas>;
}
