import { EmptyState } from "@/components/shell/EmptyState";
import { PageCanvas } from "@/components/shell/PageCanvas";

export default function CommandPage() {
  return (
    <PageCanvas
      title="Command"
      description="Headline numbers across investors, funds, deals and competitors."
    >
      <EmptyState phaseNote="Phase 0 shows raw counts once the pipeline has run; Phase 2 builds the overview.">
        Investors tracked, the Western and India split, fresh-capital funds and dry powder, deals
        mapped, competitors tracked and the top ten fit-scored investors will appear here.
      </EmptyState>
    </PageCanvas>
  );
}
