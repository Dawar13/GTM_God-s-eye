"use client";

import { PRACTICE_KEYS, useStored } from "@/lib/practice/storage";
import { isFlag } from "@/lib/practice/streak";
import { cn } from "@/lib/utils";

/** The opt-in switch for Practice mode. Off by default; the choice is remembered. */
export function PracticeToggle() {
  const [on, setOn] = useStored(PRACTICE_KEYS.on, false, isFlag);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-controls="practice-panel"
      onClick={() => setOn(!on)}
      className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-ink-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-4 w-7 rounded-full border transition-colors motion-reduce:transition-none",
          on ? "border-accent bg-accent" : "border-rule bg-panel-sunk",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-2.5 rounded-full bg-panel shadow-[0_0_0_1px_var(--rule)] transition-[left] motion-reduce:transition-none",
            on ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
      Practice
    </button>
  );
}
