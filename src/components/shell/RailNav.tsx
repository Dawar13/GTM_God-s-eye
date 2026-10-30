"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Crosshair, Gauge, Landmark, Target, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTIONS, SECTION_CHILDREN, activeSection, type SectionKey } from "@/lib/nav";
import { useCarryQuery } from "@/lib/hooks/useCarryQuery";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ICONS: Record<SectionKey, LucideIcon> = {
  command: Gauge,
  "vc-math": Calculator,
  investors: Landmark,
  competitors: Crosshair,
  strategy: Target,
};

const rowClass =
  "relative flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-2 transition-colors duration-(--dur-open) hover:bg-panel-sunk hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
const activeRowClass = "bg-accent-soft text-ink";

function ActiveBar() {
  return <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />;
}

/**
 * Section list with sub-items under the active section only. Arrow keys move
 * between visible items; Right expands a section (and enters it), Left goes back.
 */
export function RailNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const carry = useCarryQuery();
  const navRef = useRef<HTMLElement>(null);
  const active = activeSection(pathname);

  // A section opened with the Right arrow stays open until the route changes.
  const [peek, setPeek] = useState<{ path: string; key: SectionKey } | null>(null);
  const expandedKey = collapsed
    ? null
    : peek && peek.path === pathname
      ? peek.key
      : (active?.key ?? null);
  const [focusAfterPeek, setFocusAfterPeek] = useState<SectionKey | null>(null);

  useEffect(() => {
    if (!focusAfterPeek) return;
    navRef.current?.querySelector<HTMLElement>(`[data-parent="${focusAfterPeek}"] a`)?.focus();
    // Clearing the request after it ran is the point of this state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusAfterPeek(null);
  }, [focusAfterPeek, expandedKey]);

  function items(): HTMLElement[] {
    return Array.from(navRef.current?.querySelectorAll<HTMLElement>("a[data-rail-item]") ?? []);
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    const target = (e.target as HTMLElement).closest<HTMLElement>("a[data-rail-item]");
    if (!target) return;
    const list = items();
    const i = list.indexOf(target);
    if (e.key === "ArrowDown") list[Math.min(i + 1, list.length - 1)]?.focus();
    else if (e.key === "ArrowUp") list[Math.max(i - 1, 0)]?.focus();
    else if (e.key === "Home") list[0]?.focus();
    else if (e.key === "End") list[list.length - 1]?.focus();
    else if (e.key === "ArrowRight") {
      const key = target.dataset.section as SectionKey | undefined;
      if (!key || collapsed || SECTION_CHILDREN[key].length === 0) return;
      if (expandedKey === key) {
        navRef.current?.querySelector<HTMLElement>(`[data-parent="${key}"] a`)?.focus();
      } else {
        setPeek({ path: pathname, key });
        setFocusAfterPeek(key);
      }
    } else if (e.key === "ArrowLeft") {
      const parent = target.dataset.child;
      if (!parent) return;
      navRef.current?.querySelector<HTMLElement>(`a[data-section="${parent}"]`)?.focus();
    } else return;
    e.preventDefault();
  }

  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      onKeyDown={onKeyDown}
      className="flex-1 overflow-y-auto p-2"
    >
      <ul className="flex flex-col gap-0.5">
        {SECTIONS.map((section) => {
          const Icon = ICONS[section.key];
          const children = SECTION_CHILDREN[section.key];
          const hasChildren = children.length > 0;
          const isActive = active?.key === section.key;
          const expanded = expandedKey === section.key && hasChildren;
          const link = (
            <Link
              href={carry(section.href)}
              data-rail-item
              data-section={section.key}
              aria-current={isActive && !hasChildren ? "page" : undefined}
              aria-expanded={hasChildren && !collapsed ? expanded : undefined}
              onClick={onNavigate}
              className={cn(
                rowClass,
                isActive && !hasChildren && activeRowClass,
                isActive && hasChildren && "font-medium text-ink",
              )}
            >
              {isActive && !hasChildren && <ActiveBar />}
              <Icon aria-hidden className={cn("size-4 shrink-0", isActive && "text-accent")} />
              <span className={collapsed ? "sr-only" : "truncate"}>{section.label}</span>
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
              {expanded && (
                <ul
                  data-parent={section.key}
                  aria-label={`${section.label} views`}
                  className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-rule pl-2"
                >
                  {children.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <li key={child.href}>
                        <Link
                          href={carry(child.href)}
                          data-rail-item
                          data-child={section.key}
                          aria-current={childActive ? "page" : undefined}
                          onClick={onNavigate}
                          className={cn(rowClass, "h-8", childActive && activeRowClass)}
                        >
                          {childActive && <ActiveBar />}
                          <span className="truncate">{child.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
