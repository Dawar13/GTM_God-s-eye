"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchItem = { id: string; label: string; hint?: string };

/**
 * Find-as-you-type combobox (ARIA 1.2 pattern): the input keeps focus, Arrow keys move the
 * active option, Enter picks it, Escape closes the list (and is kept from closing anything
 * behind it). The list renders in place, not in a portal, so it also works in fullscreen.
 */
export function SearchBox({
  label,
  placeholder,
  search,
  onSelect,
  emptyText = "No match",
  className,
}: {
  /** Accessible name of the input. */
  label: string;
  placeholder?: string;
  /** Matches for a query, best first; called on each keystroke. */
  search: (query: string) => SearchItem[];
  onSelect: (item: SearchItem) => void;
  emptyText?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const items = useMemo(() => (query.trim() ? search(query) : []), [query, search]);
  const expanded = open && query.trim() !== "";
  const current = Math.min(active, Math.max(items.length - 1, 0));

  function choose(item: SearchItem) {
    onSelect(item);
    setQuery(item.label);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + items.length) % items.length);
    } else if (e.key === "Enter") {
      const item = items[current];
      if (expanded && item) {
        e.preventDefault();
        choose(item);
      }
    } else if (e.key === "Escape" && (expanded || query)) {
      e.preventDefault();
      e.stopPropagation();
      if (expanded) setOpen(false);
      else setQuery("");
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted"
      />
      <Input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && items[current] ? `${listId}-${current}` : undefined}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="pl-7"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={`${label} results`}
        hidden={!expanded || items.length === 0}
        className="absolute z-20 mt-1 max-h-72 w-full min-w-64 overflow-auto rounded-md border border-rule bg-panel p-1 shadow-float"
      >
        {items.map((it, k) => (
          <li
            key={it.id}
            id={`${listId}-${k}`}
            role="option"
            aria-selected={k === current}
            // mousedown, so the pick happens before the input's blur closes the list
            onMouseDown={(e) => {
              e.preventDefault();
              choose(it);
            }}
            onMouseEnter={() => setActive(k)}
            className={cn(
              "flex cursor-pointer items-baseline justify-between gap-3 rounded-[4px] px-2 py-1 text-sm",
              k === current ? "bg-accent-soft text-ink" : "text-ink-2",
            )}
          >
            <span className="truncate">{it.label}</span>
            {it.hint && <span className="shrink-0 text-xs text-muted">{it.hint}</span>}
          </li>
        ))}
      </ul>
      {expanded && items.length === 0 && (
        <p
          role="status"
          className="absolute z-20 mt-1 w-full min-w-64 rounded-md border border-rule bg-panel p-2 text-sm text-muted shadow-float"
        >
          {emptyText}
        </p>
      )}
    </div>
  );
}
