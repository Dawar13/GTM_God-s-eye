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
import { ProfileControl } from "./ProfileControl";
import { ProfileViewSync } from "./ProfileViewSync";
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
      className="order-last scrollbar-subtle w-full min-w-0 overflow-x-auto py-0.5 lg:order-none lg:w-auto lg:flex-1"
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
        {/* Same compact look as the find boxes: 28 px, radius 6, no shadow, accent ring. */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search and jump to"
          aria-keyshortcuts="Control+K Meta+K"
          title="Search and jump to"
          className="flex h-7 items-center gap-1.5 rounded-md border border-rule bg-panel px-2 text-[13px] text-muted transition-colors duration-(--dur-open) hover:border-ink-2/40 hover:text-ink-2 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none sm:w-44"
        >
          <Search aria-hidden className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-auto hidden rounded-[4px] border border-rule px-1 font-sans text-[11px] leading-4 text-muted sm:inline">
            {mac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
        <ThemeToggle />
        <ProfileControl />
        <ProfileViewSync />
      </div>
    </header>
  );
}
