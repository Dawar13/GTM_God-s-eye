"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ListFilter, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPageMeta } from "@/lib/nav";
import { isDefaultState, summarizeFilters } from "@/lib/filters";
import { useFilters } from "@/lib/filters/use-filters";
import { useCarryQuery } from "@/lib/hooks/useCarryQuery";
import { useUi } from "@/store/ui";
import { Segmented } from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";

const noopSubscribe = () => () => {};
function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const carry = useCarryQuery();
  const { title, tabs } = getPageMeta(pathname);
  const { filters } = useFilters();
  const filtersOpen = useUi((s) => s.filtersOpen);
  const toggleFilters = useUi((s) => s.toggleFilters);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const mac = useIsMac();

  const summary = summarizeFilters(filters);
  const activeTab = tabs.find((t) => t.href === pathname)?.href ?? "";

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule bg-panel px-3 py-1.5 lg:px-4">
      <MobileNav />
      <h1 className="min-h-9 shrink-0 text-lg leading-9 font-semibold">{title}</h1>

      {tabs.length > 0 && (
        <div className="order-last w-full min-w-0 overflow-x-auto pb-0.5 lg:order-none lg:w-auto lg:flex-1">
          <Segmented
            label={`${title} views`}
            options={tabs.map((t) => ({ value: t.href, label: t.label }))}
            value={activeTab}
            onChange={(href) => router.push(carry(href))}
            className="min-w-max"
          />
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFilters}
          aria-expanded={filtersOpen}
          aria-controls="filter-bar"
          aria-label={`Filters: ${summary}`}
          title="Toggle filters (F)"
          className={cn(
            "h-8 max-w-[22rem] gap-1.5 text-ink-2",
            !isDefaultState(filters) && "text-ink",
          )}
        >
          <ListFilter aria-hidden />
          <span className="hidden truncate xl:inline">{summary}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search and jump to"
          aria-keyshortcuts="Control+K Meta+K"
          className="h-8 gap-2 border-rule bg-panel-sunk text-ink-2 sm:min-w-44 sm:justify-start"
        >
          <Search aria-hidden />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-auto hidden font-sans text-xs text-muted sm:inline">
            {mac ? "⌘K" : "Ctrl K"}
          </kbd>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
