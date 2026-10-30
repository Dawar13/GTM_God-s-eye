import type { ReactNode } from "react";

const canvasClass =
  "canvas-grid flex flex-1 items-center justify-center rounded-md border border-dashed border-rule px-6 py-16";

/** A canvas that is waiting for its view: what will appear, and which phase fills it. */
export function EmptyState({ phaseNote, children }: { phaseNote: string; children: ReactNode }) {
  return (
    <section className={canvasClass}>
      <div className="max-w-md text-center">
        <p className="text-sm text-ink">{children}</p>
        <p className="mt-2 text-xs text-ink-2">{phaseNote}</p>
      </div>
    </section>
  );
}

/** Suspense fallback with the same footprint as a view, so nothing jumps. */
export function CanvasPlaceholder() {
  return <div aria-hidden className={canvasClass} />;
}
