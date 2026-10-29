import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CanvasPlaceholder, EmptyState } from "@/components/shell/EmptyState";
import { INVESTOR_VIEWS, findSubView } from "@/lib/nav";
import { Directory } from "./directory";

type Params = PageProps<"/investors/[view]">["params"];

export function generateStaticParams() {
  return INVESTOR_VIEWS.map((v) => ({ view: v.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/investors/[view]">): Promise<Metadata> {
  const view = findSubView(INVESTOR_VIEWS, (await params).view);
  return { title: view ? `${view.label} · Investors` : "Investors" };
}

// params are URL data: read them under Suspense so view switches stay instant.
export default function InvestorViewPage({ params }: PageProps<"/investors/[view]">) {
  return (
    <Suspense fallback={<CanvasPlaceholder />}>
      <InvestorView params={params} />
    </Suspense>
  );
}

async function InvestorView({ params }: { params: Params }) {
  const view = findSubView(INVESTOR_VIEWS, (await params).view);
  if (!view) notFound();
  if (view.slug === "directory") return <Directory />;
  return <EmptyState phaseNote={view.phaseNote}>{view.summary}</EmptyState>;
}
