"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type WheelEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ListFilter, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { filtersApply, getPageMeta } from "@/lib/nav";
import { isDefaultState, summarizeFilters } from "@/lib/filters";
import { useFilters } from "@/lib/filters/use-filters";
import { useCarryQuery } from "@/lib/hooks/useCarryQuery";
import { useUi } from "@/store/ui";
import { Segmented } from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";
import { RoundControl } from "./RoundControl";
import { ThemeToggle } from "./ThemeToggle";

const noopSubscribe = () => () => {};
function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
}

const FADE_PX = 24;

/**
 * Sub-tabs that do not fit (VC math has ten) scroll sideways: an edge that hides tabs fades
 * out, a mouse wheel scrolls them, and the active tab is kept in view. Arrow keys still move
 * through every tab, and the focused one scrolls into view.
 */
function ScrollingTabs({ active, children }: { active: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    ref.current
      ?.querySelector('[aria-checked="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  const stop = (hidden: boolean) => (hidden ? "transparent" : "#000");
  const mask =
    edges.left || edges.right
      ? `linear-gradient(to right, ${stop(edges.left)}, #000 ${FADE_PX}px, #000 calc(100% - ${FADE_PX}px), ${stop(edges.right)})`
      : undefined;

  return (
    <div
      ref={ref}
      onWheel={onWheel}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className="order-last w-full min-w-0 overflow-x-auto py-0.5 [scrollbar-width:thin] lg:order-none lg:w-auto lg:flex-1"
    >
      {children}
    </div>
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

  const showFilters = filtersApply(pathname);
  const summary = summarizeFilters(filters);
  const activeTab = tabs.find((t) => t.href === pathname)?.href ?? "";

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule bg-panel px-3 py-1.5 lg:px-4">
      <MobileNav />
      <h1 className="min-h-9 shrink-0 text-lg leading-9 font-semibold">{title}</h1>

      {tabs.length > 0 && (
        <ScrollingTabs active={activeTab}>
          <Segmented
            label={`${title} views`}
            options={tabs.map((t) => ({ value: t.href, label: t.label }))}
            value={activeTab}
            onChange={(href) => router.push(carry(href))}
            className="min-w-max"
          />
        </ScrollingTabs>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {showFilters && (
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
        )}
        <RoundControl />
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
