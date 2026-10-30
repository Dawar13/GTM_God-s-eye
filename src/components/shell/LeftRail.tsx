"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  Crosshair,
  Gauge,
  Landmark,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { SECTIONS, isSectionActive, type SectionKey } from "@/lib/nav";
import { useUi } from "@/store/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./ThemeToggle";

const ICONS: Record<SectionKey, LucideIcon> = {
  command: Gauge,
  "vc-math": Calculator,
  investors: Landmark,
  competitors: Crosshair,
  strategy: Target,
};

const itemClass =
  "relative flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-2 transition-colors hover:bg-panel-sunk hover:text-ink";

export function LeftRail() {
  const pathname = usePathname();
  const collapsed = useUi((s) => s.railCollapsed);
  const toggleRail = useUi((s) => s.toggleRail);

  // Labels stay in the accessibility tree when hidden. Narrow screens always get icons only.
  const labelClass = collapsed ? "sr-only" : "sr-only md:not-sr-only md:truncate";

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-rule bg-panel transition-[width] duration-150",
        collapsed ? "w-14" : "w-14 md:w-52",
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-rule px-[1.3rem]">
        <span aria-hidden className="size-2.5 shrink-0 rotate-45 bg-accent" />
        <span className={cn("text-sm font-semibold", labelClass)}>Capital Atlas</span>
      </div>

      <nav aria-label="Sections" className="flex-1 p-2">
        <ul className="flex flex-col gap-0.5">
          {SECTIONS.map((section) => {
            const Icon = ICONS[section.key];
            const active = isSectionActive(section, pathname);
            const link = (
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active && "bg-panel-sunk text-ink")}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 -left-2 w-0.5 rounded-full bg-accent"
                  />
                )}
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className={labelClass}>{section.label}</span>
              </Link>
            );
            return (
              <li key={section.key}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{section.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-rule p-2">
        <ThemeToggle labelClass={labelClass} className={itemClass} />
        <button
          type="button"
          onClick={toggleRail}
          aria-expanded={!collapsed}
          className={cn(itemClass, "hidden md:flex")}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose aria-hidden className="size-4 shrink-0" />
          )}
          <span className={labelClass}>{collapsed ? "Expand menu" : "Collapse menu"}</span>
        </button>
      </div>
    </aside>
  );
}
