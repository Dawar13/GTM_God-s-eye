import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder. Give it the footprint of the thing it stands in for. */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-panel-sunk", className)}
      {...props}
    />
  );
}
