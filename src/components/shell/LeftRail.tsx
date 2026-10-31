"use client";

import Image from "next/image";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { APP_NAME } from "@/lib/nav";
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
      <div
        className={cn(
          "flex h-12 shrink-0 items-center gap-2.5 border-b border-rule",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        {/* Expanded, the name beside the logo names it; collapsed, the logo carries the name. */}
        <Image
          src="/brand/logo.png"
          alt={collapsed ? APP_NAME : ""}
          width={288}
          height={192}
          loading="eager"
          className="h-6 w-auto shrink-0"
        />
        {!collapsed && <span className="truncate text-base font-semibold">{APP_NAME}</span>}
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
