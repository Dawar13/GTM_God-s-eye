import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** A bordered surface. Borders carry the depth; there is no shadow here. */
export function Panel({
  padded = true,
  className,
  ...props
}: ComponentPropsWithoutRef<"section"> & { padded?: boolean }) {
  return (
    <section
      className={cn("rounded-xl border border-rule bg-panel", padded && "p-4", className)}
      {...props}
    />
  );
}
