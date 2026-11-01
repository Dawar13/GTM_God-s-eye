"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { createZoomReadout, type ZoomReadout } from "@/lib/viz/zoom";

/** One readout per chart, stable for its life; the chart calls `readout.set(level)` freely. */
export function useZoomReadout(): ZoomReadout {
  return useState(() => createZoomReadout())[0];
}

/** Only this span re-renders while zooming, at most once per frame. */
function ZoomLevel({ readout }: { readout: ZoomReadout }) {
  const pct = useSyncExternalStore(readout.subscribe, readout.get, readout.get);
  return (
    <span
      aria-live="polite"
      data-testid="zoom-level"
      className="px-1 pb-0.5 text-xs text-ink-2 tabular-nums"
    >
      {pct}%
    </span>
  );
}

/**
 * Keyboard handler for a focusable chart area: + or = zooms in, - zooms out, 0 resets.
 * Returns true when it handled the key.
 */
export function handleZoomKey(
  e: KeyboardEvent,
  h: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void },
): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key === "+" || e.key === "=") h.onZoomIn();
  else if (e.key === "-" || e.key === "_") h.onZoomOut();
  else if (e.key === "0") h.onReset();
  else return false;
  e.preventDefault();
  return true;
}

function Btn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-panel-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

/** A small vertical zoom group for a chart corner. The readout's level is 1 at the first view. */
export function ZoomControls({
  readout,
  onZoomIn,
  onZoomOut,
  onReset,
  className,
}: {
  readout: ZoomReadout;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Zoom"
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md border border-rule bg-panel p-0.5 shadow-float",
        className,
      )}
    >
      <Btn label="Zoom in" onClick={onZoomIn}>
        <Plus aria-hidden className="size-4" />
      </Btn>
      <Btn label="Zoom out" onClick={onZoomOut}>
        <Minus aria-hidden className="size-4" />
      </Btn>
      <Btn label="Reset view" onClick={onReset}>
        <RotateCcw aria-hidden className="size-4" />
      </Btn>
      <ZoomLevel readout={readout} />
    </div>
  );
}
