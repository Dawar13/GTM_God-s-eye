import { Panel, Skeleton } from "@/components/ui-atlas";

/** Placeholder while the overview reads the URL filters and the data. */
export function CommandChartsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Panel key={i}>
            <Skeleton className="h-80 w-full" />
          </Panel>
        ))}
      </div>
    </div>
  );
}
