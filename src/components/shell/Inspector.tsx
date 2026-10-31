"use client";

import {
  useEffect,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, ExternalLink, X } from "lucide-react";
import { INSPECTOR_WIDTH, useInspectorStore } from "@/store/inspector";
import { useInspector } from "@/lib/hooks/useInspector";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { loadEntity, useLoaded } from "@/lib/client-index";
import type { EntityHeader } from "@/lib/data/entities";
import { InspectorSection, Skeleton, SourceBadge } from "@/components/ui-atlas";
import { InvestorProfileSections } from "@/components/shell/InvestorProfile";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const KIND_LABELS = { investor: "Investor", company: "Company", competitor: "Competitor" } as const;
const KEY_STEP = 16;

/**
 * Right drawer (420px, 360 to 640) on desktop, bottom sheet below 1024px.
 * Every record shows header facts and sources; investors add the full profile (S5), companies
 * and competitors list who backed them (S8 extends competitors).
 */
export function Inspector() {
  const inspector = useInspector();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const width = useInspectorStore((s) => s.width);
  const setWidth = useInspectorStore((s) => s.setWidth);
  const { id, close } = inspector;

  // Esc closes the drawer, unless a popover or dialog (palette, filter menu) has its own Esc to handle.
  useEffect(() => {
    if (!id || !desktop) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]')) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [id, desktop, close]);

  if (!id) return null;

  if (!desktop) {
    return (
      <Sheet open onOpenChange={(open) => !open && close()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          className="gap-0 rounded-t-xl p-0 data-[side=bottom]:h-[75dvh]"
        >
          <SheetTitle className="sr-only">Inspector</SheetTitle>
          <SheetDescription className="sr-only">Details for the selected record</SheetDescription>
          <InspectorBody id={id} inspector={inspector} />
        </SheetContent>
      </Sheet>
    );
  }

  // The handle sits on the left edge, so dragging left widens the panel.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev: globalThis.PointerEvent) => setWidth(startWidth + (startX - ev.clientX));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onHandleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    const next: Record<string, number> = {
      ArrowLeft: width + step,
      ArrowRight: width - step,
      Home: INSPECTOR_WIDTH.max,
      End: INSPECTOR_WIDTH.min,
    };
    const target = next[e.key];
    if (target === undefined) return;
    e.preventDefault();
    setWidth(target);
  };

  return (
    <aside
      aria-label="Inspector"
      style={{ "--inspector-w": `${width}px` } as CSSProperties}
      className="relative flex w-(--inspector-w) shrink-0 flex-col border-l border-rule bg-panel"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize inspector"
        aria-valuemin={INSPECTOR_WIDTH.min}
        aria-valuemax={INSPECTOR_WIDTH.max}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onHandleKey}
        className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none transition-colors hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none"
      />
      <InspectorBody id={id} inspector={inspector} />
    </aside>
  );
}

function InspectorBody({
  id,
  inspector,
}: {
  id: string;
  inspector: ReturnType<typeof useInspector>;
}) {
  const state = useLoaded(id, () => loadEntity(id));
  const { close, back, forward, canBack, canForward, open } = inspector;
  const entity = state.status === "ready" ? state.data : null;

  return (
    <>
      <header className="flex shrink-0 items-start gap-1 border-b border-rule px-3 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={back}
          disabled={!canBack}
          aria-label="Previous record"
          className="text-ink-2"
        >
          <ArrowLeft aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={forward}
          disabled={!canForward}
          aria-label="Next record"
          className="text-ink-2"
        >
          <ArrowRight aria-hidden />
        </Button>
        <div className="min-w-0 flex-1 px-2">
          <p className="text-xs text-ink-2">{entity ? KIND_LABELS[entity.kind] : " "}</p>
          <h2 className="truncate text-base font-semibold">
            {entity ? entity.name : state.status === "error" ? "Not found" : "Loading"}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={close}
          aria-label="Close inspector"
          className="text-ink-2"
        >
          <X aria-hidden />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3">
          {state.status === "loading" && (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          )}
          {state.status === "error" && (
            <p className="text-sm text-ink-2">
              No record with the id <span className="num">{id}</span> was found.
            </p>
          )}
          {entity && <EntityHeaderView entity={entity} onOpen={open} />}
        </div>
      </ScrollArea>
    </>
  );
}

/** One row per source domain: how many pages, and the most recent read date. */
function groupSources(sources: EntityHeader["sources"]) {
  const groups = new Map<string, { domain: string; url: string; count: number; latest: string }>();
  for (const s of sources) {
    const g = groups.get(s.domain);
    if (!g) groups.set(s.domain, { domain: s.domain, url: s.url, count: 1, latest: s.retrievedAt });
    else {
      g.count += 1;
      if (s.retrievedAt > g.latest) g.latest = s.retrievedAt;
    }
  }
  return [...groups.values()];
}

function EntityHeaderView({
  entity,
  onOpen,
}: {
  entity: EntityHeader;
  onOpen: (id: string) => void;
}) {
  const facts: { label: string; value: ReactNode }[] = [
    { label: "Type", value: entity.typeLabel },
    { label: "HQ", value: entity.hq },
    {
      label: "Website",
      value: entity.website ? (
        <a
          href={entity.website}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          {entity.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          <ExternalLink aria-hidden className="size-3" />
        </a>
      ) : null,
    },
  ];

  return (
    <div>
      <dl className="divide-y divide-rule border-b border-rule">
        {facts.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
            <dt className="text-ink-2">{f.label}</dt>
            <dd className="min-w-0 truncate text-right">{f.value ?? "Unknown"}</dd>
          </div>
        ))}
      </dl>

      {entity.kind === "investor" && <InvestorProfileSections id={entity.id} onOpen={onOpen} />}

      {entity.backers && (
        <InspectorSection title="Backed by" meta={String(entity.backers.total)}>
          {entity.backers.list.length === 0 ? (
            <p className="text-sm text-ink-2">No investors recorded for this company.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {entity.backers.list.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(b.id)}
                    className="text-left hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {b.name}
                  </button>
                </li>
              ))}
              {entity.backers.total > entity.backers.list.length && (
                <li className="text-xs text-ink-2">
                  and{" "}
                  <span className="num">{entity.backers.total - entity.backers.list.length}</span>{" "}
                  more
                </li>
              )}
            </ul>
          )}
        </InspectorSection>
      )}

      <InspectorSection title="Sources" meta={`${entity.sources.length} pages`}>
        <ul className="flex flex-col gap-2 text-sm">
          {groupSources(entity.sources).map((g) => (
            <li key={g.domain} className="flex items-center justify-between gap-3">
              {g.url.startsWith("http") ? (
                <a
                  href={g.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate hover:underline"
                >
                  <SourceBadge domain={g.domain} confidence={entity.confidence} />
                </a>
              ) : (
                <SourceBadge domain={g.domain} confidence={entity.confidence} />
              )}
              <span className="shrink-0 num text-xs text-ink-2">
                {g.count > 1 && <span className="mr-2">{g.count} pages</span>}
                {g.latest}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-2">
          The dot shows the record&apos;s confidence; the date is the latest read.
        </p>
      </InspectorSection>
    </div>
  );
}
