"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { formatCount } from "@/lib/format";
import { highlightRanges } from "@/lib/search/match";
import { registerFindBox } from "@/lib/search/find-state";
import { cn } from "@/lib/utils";

const iconBtn =
  "grid size-5 shrink-0 place-items-center rounded-[4px] text-muted hover:bg-panel-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40";

/**
 * The compact find box for tables and charts (28 px, radius 6, no shadow, accent ring on
 * focus). Tables pass `total` and read "N of M"; charts pass `active` and `onStep` and read
 * "k of N" with step arrows. Keys: Arrow Up/Down and Shift+Enter step, Enter submits (charts
 * focus, then open, the match), Escape clears and blurs. Below 640 px it is an icon button
 * until tapped. `/` focuses it through the find-box registry.
 */
export function FindBox({
  label,
  value,
  onValueChange,
  matches,
  total,
  active,
  onStep,
  onSubmit,
  placeholder = "Find…",
  className,
}: {
  /** Accessible name, e.g. "Find investors". */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Number of matches for the applied query; null while it is being applied. */
  matches: number | null;
  /** Rows before the find (tables): the count reads "N of M". */
  total?: number;
  /** Index of the active match (charts): the count reads "k of N" and arrows show. */
  active?: number;
  onStep?: (delta: 1 | -1) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const has = value.trim() !== "";
  const open = expanded || has;
  const stepping = active !== undefined && onStep !== undefined;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    return registerFindBox({
      el,
      focus: () => {
        setExpanded(true);
        // The input is display:none on phones until expanded; focus after it shows.
        requestAnimationFrame(() => input.current?.focus());
      },
    });
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onValueChange("");
      setExpanded(false);
      input.current?.blur();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!onStep) return;
      e.preventDefault();
      onStep(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onStep?.(-1);
      else if (onSubmit) onSubmit();
      else onStep?.(1);
    }
  }

  let count = "";
  if (has && matches !== null) {
    if (stepping) count = matches ? `${formatCount(active + 1)} of ${formatCount(matches)}` : "No match";
    else if (total !== undefined) count = `${formatCount(matches)} of ${formatCount(total)}`;
    else count = matches ? formatCount(matches) : "No match";
  }

  return (
    <div
      ref={wrap}
      data-find-box=""
      data-expanded={open ? "" : undefined}
      className={cn("group/find relative h-7 shrink-0", open ? "w-56 sm:w-60" : "w-7 sm:w-60", className)}
    >
      {/* Phones: an icon button until tapped. */}
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          setExpanded(true);
          requestAnimationFrame(() => input.current?.focus());
        }}
        className={cn(
          "size-7 place-items-center rounded-md border border-rule bg-panel text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent sm:hidden",
          open ? "hidden" : "grid",
        )}
      >
        <Search aria-hidden className="size-3.5" />
      </button>
      <div
        className={cn(
          "h-7 w-full items-center rounded-md border border-rule bg-panel transition-colors duration-(--dur-open) focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 hover:border-ink-2/40",
          open ? "flex" : "hidden sm:flex",
        )}
      >
        <Search aria-hidden className="ml-2 size-3.5 shrink-0 text-muted" />
        <input
          ref={input}
          type="search"
          aria-label={label}
          aria-keyshortcuts="/"
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (!value.trim()) setExpanded(false);
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-[13px] text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
        />
        {has && (
          <div className="flex shrink-0 items-center gap-0.5 pr-1">
            <span
              aria-live="polite"
              data-testid="find-count"
              className="px-1 font-condensed text-xs whitespace-nowrap text-muted tabular-nums"
            >
              {count}
            </span>
            {stepping && (
              <>
                <button
                  type="button"
                  aria-label="Previous match"
                  title="Previous match (Shift+Enter)"
                  disabled={!matches}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onStep(-1)}
                  className={iconBtn}
                >
                  <ChevronUp aria-hidden className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Next match"
                  title="Next match (Down arrow)"
                  disabled={!matches}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onStep(1)}
                  className={iconBtn}
                >
                  <ChevronDown aria-hidden className="size-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              aria-label="Clear find"
              title="Clear (Esc)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onValueChange("");
                input.current?.focus();
              }}
              className={iconBtn}
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Text with the find query's matches marked subtly; plain text when there is no query. */
export function FindMark({ text, query }: { text: string | null | undefined; query: string }) {
  if (!text) return <>{text ?? ""}</>;
  const ranges = query ? highlightRanges(text, query) : [];
  if (!ranges.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], k) => {
    if (s > at) parts.push(text.slice(at, s));
    parts.push(
      <mark key={k} className="find-mark">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
