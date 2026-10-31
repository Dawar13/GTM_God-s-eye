import type { ComponentPropsWithoutRef } from "react";
import { X } from "lucide-react";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Filter chip with an optional result count. A toggle button: aria-pressed carries state.
 * `removable` shows a close mark for a chip whose click clears its filter; give it an
 * aria-label that says so.
 */
export function Chip({
  label,
  count,
  selected = false,
  removable = false,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  label: string;
  count?: number | null;
  selected?: boolean;
  removable?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors duration-(--dur-open) ease-(--ease-out) disabled:opacity-50",
        selected
          ? "border-accent bg-accent-soft text-ink"
          : "border-rule bg-panel text-ink-2 hover:bg-panel-sunk hover:text-ink",
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      {count !== undefined && count !== null && (
        <span className="font-condensed text-xs text-muted tabular-nums">{formatCount(count)}</span>
      )}
      {removable && <X aria-hidden className="size-3.5 text-ink-2" />}
    </button>
  );
}
