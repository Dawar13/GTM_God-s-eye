import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Says what is missing and what to do next. `action` is usually a Button or link. */
export function EmptyState({
  title,
  children,
  action,
  tone = "empty",
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "empty" | "error";
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-6 py-10 text-center",
        className,
      )}
    >
      <p className={cn("text-base font-medium", tone === "error" && "text-negative")}>{title}</p>
      {children && <p className="max-w-sm text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
