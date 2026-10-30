"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { Button } from "@/components/ui/button";
import { RailNav } from "./RailNav";

/** Desktop rail: 232px, or 64px icons when collapsed. Below 1024px the top bar's sheet replaces it. */
export function LeftRail() {
  const collapsed = useUi((s) => s.railCollapsed);
  const toggleRail = useUi((s) => s.toggleRail);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-rule bg-panel transition-[width] duration-(--dur-open) ease-(--ease-out) lg:flex",
        collapsed ? "w-16" : "w-[232px]",
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-rule px-5">
        <span aria-hidden className="size-2.5 shrink-0 rotate-45 bg-accent" />
        <span className={cn("truncate text-base font-semibold", collapsed && "sr-only")}>
          Capital Atlas
        </span>
      </div>
      <RailNav collapsed={collapsed} />
      <div className="border-t border-rule p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleRail}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title="Toggle menu ([)"
          className="text-ink-2"
        >
          {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
        </Button>
      </div>
    </aside>
  );
}
