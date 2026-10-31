import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapTable } from "@/components/calculators/CapTable";
import { SafeCalculator } from "@/components/calculators/SafeCalculator";
import { OptionPool } from "@/components/calculators/OptionPool";
import { RoundBuilder } from "@/components/calculators/RoundBuilder";
import { CanvasPlaceholder, EmptyState } from "@/components/shell/EmptyState";
import { VC_MATH_TOOLS, findSubView } from "@/lib/nav";

type Params = PageProps<"/vc-math/[tool]">["params"];

export function generateStaticParams() {
  return VC_MATH_TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/vc-math/[tool]">): Promise<Metadata> {
  const tool = findSubView(VC_MATH_TOOLS, (await params).tool);
  return { title: tool ? `${tool.label} · VC math` : "VC math" };
}

// params are URL data: read them under Suspense so tab switches stay instant.
export default function VcMathToolPage({ params }: PageProps<"/vc-math/[tool]">) {
  return (
    <Suspense fallback={<CanvasPlaceholder />}>
      <ToolView params={params} />
    </Suspense>
  );
}

async function ToolView({ params }: { params: Params }) {
  const tool = findSubView(VC_MATH_TOOLS, (await params).tool);
  if (!tool) notFound();
  if (tool.slug === "round-builder") return <RoundBuilder />;
  if (tool.slug === "cap-table") return <CapTable />;
  if (tool.slug === "safe") return <SafeCalculator />;
  if (tool.slug === "option-pool") return <OptionPool />;
  return <EmptyState phaseNote={tool.phaseNote}>{tool.summary}</EmptyState>;
}
