"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shows `content` (normally a VizTooltip) under its child on hover or keyboard focus, for
 * HTML marks such as the layer map's chips. Chart libraries position their own tooltips;
 * this is for everything that is not a chart canvas.
 */
export function HoverTip({
  content,
  children,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className={cn("relative inline-block", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span id={id} className="pointer-events-none absolute left-0 top-full z-30 mt-1 block w-max">
          {content}
        </span>
      )}
    </span>
  );
}
