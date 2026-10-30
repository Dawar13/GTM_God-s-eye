import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** A collapsible block inside the Inspector. Native <details>: keyboard and no-JS safe. */
export function InspectorSection({
  title,
  meta,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  /** Short trailing text, such as a count. */
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn("group border-b border-rule py-3", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 text-muted transition-transform duration-(--dur-open) group-open:rotate-90"
        />
        <h3 className="font-medium">{title}</h3>
        {meta && (
          <span className="ml-auto text-sm font-normal text-muted tabular-nums">{meta}</span>
        )}
      </summary>
      <div className="mt-3 pl-6 text-base">{children}</div>
    </details>
  );
}
