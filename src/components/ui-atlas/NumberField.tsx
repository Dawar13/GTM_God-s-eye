"use client";

import { useId, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatFieldValue,
  parseNumberInput,
  positionToValue,
  SLIDER_STEPS,
  valueToPosition,
  type NumberKind,
  type SliderScale,
} from "@/lib/calculators/parse";
import { cn } from "@/lib/utils";

/**
 * A labelled number input with a synced slider and an optional ⓘ hint. The value is a
 * number in its own units (dollars, shares, or a fraction for percent). Typing something
 * invalid or out of range shows an inline message and leaves the last valid value in
 * place; the value is only ever reported to the parent when it is valid.
 */
export function NumberField({
  label,
  value,
  onChange,
  kind,
  min,
  max,
  step = 1,
  slider = "linear",
  hint,
  disabled,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  kind: NumberKind;
  min: number;
  max: number;
  step?: number;
  /** Slider scale, or false for no slider. Log sliders need min > 0. */
  slider?: SliderScale | false;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lo = kind === "percent" ? min * 100 : min;
  const hi = kind === "percent" ? max * 100 : max;
  const range = `${formatFieldValue(min, kind)} to ${formatFieldValue(max, kind)}${kind === "percent" ? "%" : ""}`;

  function edit(text: string) {
    setDraft(text);
    const parsed = parseNumberInput(text, kind);
    if (parsed === null) {
      setError(`Enter a number between ${range}.`);
    } else if (parsed < min || parsed > max) {
      setError(`Use a value between ${range}.`);
    } else {
      setError(null);
      onChange(parsed);
    }
  }

  const shown = draft ?? formatFieldValue(value, kind);
  const scale: SliderScale = slider === "log" && min > 0 ? "log" : "linear";
  const position = valueToPosition(value, min, max, scale);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint && (
          <Popover>
            <PopoverTrigger
              aria-label={`About ${label}`}
              className="rounded-md px-1 text-base leading-none text-ink-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
            >
              <span aria-hidden>ⓘ</span>
            </PopoverTrigger>
            <PopoverContent className="text-ink-2">{hint}</PopoverContent>
          </Popover>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={shown}
          onChange={(e) => edit(e.target.value)}
          onBlur={() => {
            setDraft(null);
            setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          data-range={`${lo}-${hi}`}
          className={cn(
            "h-8 w-full rounded-md border bg-panel px-2.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
            kind === "percent" && "pr-7",
            error ? "border-negative" : "border-rule",
          )}
        />
        {kind === "percent" && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-ink-2">
            %
          </span>
        )}
      </div>
      {slider && (
        <input
          type="range"
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={position}
          disabled={disabled}
          onChange={(e) => {
            setDraft(null);
            setError(null);
            onChange(positionToValue(Number(e.target.value), min, max, scale, step));
          }}
          aria-label={`${label} slider`}
          aria-valuetext={`${formatFieldValue(value, kind)}${kind === "percent" ? "%" : ""}`}
          className="h-4 w-full cursor-pointer accent-accent disabled:opacity-50"
        />
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
