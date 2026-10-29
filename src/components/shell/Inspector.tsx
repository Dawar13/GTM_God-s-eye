"use client";

import { useEffect, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { X } from "lucide-react";
import { INSPECTOR_WIDTH, useSelection, type SelectionKind } from "@/store/selection";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const KIND_LABELS: Record<SelectionKind, string> = {
  investor: "Investor",
  fund: "Fund",
  company: "Company",
  round: "Round",
};

const KEY_STEP = 16;

export function Inspector() {
  const selection = useSelection((s) => s.selection);
  const clear = useSelection((s) => s.clear);
  const width = useSelection((s) => s.inspectorWidth);
  const setWidth = useSelection((s) => s.setInspectorWidth);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selection, clear]);

  if (!selection) return null;

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
      className="fixed inset-0 z-40 flex flex-col bg-panel md:relative md:inset-auto md:z-auto md:w-(--inspector-w) md:shrink-0 md:border-l md:border-rule"
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
        className="absolute inset-y-0 left-0 z-10 hidden w-1.5 -translate-x-1/2 cursor-col-resize touch-none transition-colors hover:bg-amber/50 focus-visible:bg-amber focus-visible:outline-none md:block"
      />

      <header className="flex shrink-0 items-start gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-muted">{KIND_LABELS[selection.kind]}</p>
          <h2 className="truncate text-sm font-semibold">{selection.title}</h2>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="Close inspector">
          <X aria-hidden />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <pre className="p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-ink-muted">
          {JSON.stringify(selection.payload, null, 2)}
        </pre>
      </ScrollArea>
    </aside>
  );
}
