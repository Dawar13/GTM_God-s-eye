import { PageCanvas } from "@/components/shell/PageCanvas";

export default function InvestorsLayout({ children }: LayoutProps<"/investors">) {
  return <PageCanvas>{children}</PageCanvas>;
}
