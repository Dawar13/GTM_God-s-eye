"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import {
  Bot,
  Building2,
  Factory,
  Crosshair,
  FileText,
  Landmark,
  Moon,
  PanelLeft,
  Rocket,
  RotateCcw,
  Search,
} from "lucide-react";
import { PALETTE_PAGES, PALETTE_TOOL_ACTIONS } from "@/lib/nav";
import { useFilters } from "@/lib/filters/use-filters";
import { useInspector } from "@/lib/hooks/useInspector";
import { useCarryQuery } from "@/lib/hooks/useCarryQuery";
import { loadPaletteIndex, useLoaded } from "@/lib/client-index";
import type { PaletteEntry, PaletteKind } from "@/lib/data/entities";
import { rankMatches } from "@/lib/search/match";
import { useUi } from "@/store/ui";

const ENTITY_LIMIT = 6;

const KIND: Record<PaletteKind, { label: string; Icon: typeof Landmark; hint: string }> = {
  investor: { label: "Investors", Icon: Landmark, hint: "Investor" },
  company: { label: "Companies", Icon: Building2, hint: "Company, see who backed it" },
  competitor: { label: "Competitors", Icon: Crosshair, hint: "Competitor, see who backed it" },
  landscape: { label: "Physical AI landscape", Icon: Bot, hint: "Physical AI landscape" },
  accelerator: { label: "Accelerator programmes", Icon: Rocket, hint: "Accelerator programme" },
  customer: { label: "Target customers", Icon: Factory, hint: "Target customer" },
};

const KINDS = [
  "investor",
  "company",
  "competitor",
  "landscape",
  "accelerator",
  "customer",
] as const;

const itemClass =
  "flex h-9 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-ink-2 data-[selected=true]:bg-accent-soft data-[selected=true]:text-ink";

function norm(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Best matches of one kind: prefix, then word start, then substring (src/lib/search). */
function searchEntries(entries: readonly PaletteEntry[], query: string, kind: PaletteKind) {
  if (norm(query.trim()).length < 2) return [];
  return rankMatches(
    entries.filter((e) => e.kind === kind),
    query,
    (e) => e.name,
  )
    .slice(0, ENTITY_LIMIT)
    .map((r) => r.item);
}

function matches(text: string, query: string) {
  const q = norm(query.trim());
  if (!q) return true;
  const n = norm(text);
  return q.split(/\s+/).every((word) => n.includes(word));
}

/**
 * Command palette (cmdk). Pages and actions are static. Names are loaded from
 * /api/palette-index the first time the palette opens, so they never sit in
 * page HTML.
 */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const toggleRail = useUi((s) => s.toggleRail);
  const setFiltersOpen = useUi((s) => s.setFiltersOpen);
  const router = useRouter();
  const pathname = usePathname();
  const carry = useCarryQuery();
  const { reset } = useFilters();
  const { open: inspect } = useInspector();
  const [query, setQuery] = useState("");

  // The index is requested on first open and then kept for the page's lifetime.
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    // Flipping this flag once is what triggers the one-time load below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setRequested(true);
  }, [open]);
  const index = useLoaded(requested ? "index" : null, loadPaletteIndex);

  // Start each opening with an empty query.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setQuery("");
  }, [open]);

  const close = () => setOpen(false);
  const go = (href: string) => {
    close();
    router.push(carry(href));
  };
  const openEntry = (e: PaletteEntry) => {
    close();
    if (e.href) router.push(carry(e.href));
    else inspect(e.inspect ?? e.id);
  };

  const pages = useMemo(
    () => PALETTE_PAGES.filter((p) => matches(`${p.label} ${p.keywords}`, query)),
    [query],
  );
  const tools = useMemo(
    () => PALETTE_TOOL_ACTIONS.filter((p) => matches(`${p.label} ${p.keywords}`, query)),
    [query],
  );

  const commands = [
    { id: "theme", label: "Switch colour theme", Icon: Moon, run: toggleTheme },
    { id: "rail", label: "Collapse or expand the menu", Icon: PanelLeft, run: toggleRail },
    {
      id: "filters",
      label: "Show filters",
      Icon: Search,
      run: () => {
        setFiltersOpen(true);
        document.getElementById("filter-bar")?.scrollIntoView();
      },
    },
    { id: "reset", label: "Reset filters to the default view", Icon: RotateCcw, run: reset },
  ].filter((c) => matches(c.label, query));

  const entries = index.status === "ready" ? index.data : [];
  const found = KINDS.map((kind) => ({
    kind,
    items: searchEntries(entries, query, kind),
  }));

  const searching = query.trim().length >= 2;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/10 duration-(--dur-open) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-rule bg-panel shadow-float duration-(--dur-open) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <Dialog.Title className="sr-only">Search and jump to</Dialog.Title>
          <Command shouldFilter={false} loop label="Search and jump to">
            <div className="flex items-center gap-2 border-b border-rule px-3">
              <Search aria-hidden className="size-4 shrink-0 text-muted" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search names, pages and actions"
                className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-ink-2">
                {searching && index.status === "loading"
                  ? "Loading names"
                  : "Nothing matches. Try part of a name or a page."}
              </Command.Empty>

              {found.map(
                ({ kind, items }) =>
                  items.length > 0 && (
                    <Command.Group
                      key={kind}
                      heading={KIND[kind].label}
                      className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-2"
                    >
                      {items.map((e) => {
                        const { Icon, hint } = KIND[kind];
                        return (
                          <Command.Item
                            key={e.id}
                            value={e.id}
                            onSelect={() => openEntry(e)}
                            className={itemClass}
                          >
                            <Icon aria-hidden className="size-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-ink">{e.name}</span>
                            <span className="shrink-0 text-xs text-muted">{hint}</span>
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  ),
              )}

              {tools.length + commands.length > 0 && (
                <Command.Group
                  heading="Actions"
                  className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-2"
                >
                  {tools.map((a) => (
                    <Command.Item
                      key={a.id}
                      value={a.id}
                      onSelect={() => go(a.href)}
                      className={itemClass}
                    >
                      <FileText aria-hidden className="size-4 shrink-0" />
                      <span className="flex-1 truncate text-ink">{a.label}</span>
                    </Command.Item>
                  ))}
                  {commands.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`cmd-${c.id}`}
                      onSelect={() => {
                        close();
                        c.run();
                      }}
                      className={itemClass}
                    >
                      <c.Icon aria-hidden className="size-4 shrink-0" />
                      <span className="flex-1 truncate text-ink">{c.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {pages.length > 0 && (
                <Command.Group
                  heading="Pages"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-2"
                >
                  {pages.map((p) => (
                    <Command.Item
                      key={p.id}
                      value={p.id}
                      onSelect={() => go(p.href)}
                      className={itemClass}
                    >
                      <span className="flex-1 truncate text-ink">{p.label}</span>
                      {p.href === pathname && <span className="text-xs text-muted">Here</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
            <div className="flex items-center justify-between border-t border-rule px-3 py-2 text-xs text-ink-2">
              <span>
                {index.status === "error"
                  ? "Names did not load. Pages and actions still work."
                  : "Type two letters to search names"}
              </span>
              <span>Enter to open, Esc to close</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
