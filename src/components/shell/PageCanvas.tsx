import type { ReactNode } from "react";

/**
 * Main area. The title and sub-tabs live in the top bar (derived from the
 * route in nav.ts), so pages only supply an optional description and the view.
 */
export function PageCanvas({
  description,
  children,
}: {
  /** Kept so pages can still name themselves; the top bar shows the title. */
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      {description && (
        <p className="border-b border-rule px-6 py-3 text-sm text-ink-2">{description}</p>
      )}
      <div className="flex flex-1 flex-col p-6">{children}</div>
    </div>
  );
}
