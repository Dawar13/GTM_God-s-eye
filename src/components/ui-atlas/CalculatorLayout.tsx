import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "./Panel";

/**
 * The common calculator layout (PHASE_2 S3): inputs on the left, the visual in the
 * centre, a collapsible "How this is calculated" under both, and a reset button.
 * `isExample` says whether the inputs still match the built-in example, so the
 * panel can label them "Example" (illustrative, not data) or "Your inputs".
 */
export function CalculatorLayout({
  inputs,
  children,
  how,
  onReset,
  isExample,
  error,
  stale,
}: {
  inputs: ReactNode;
  children: ReactNode;
  /** Formula and worked example, built from the same results the page shows. */
  how: ReactNode;
  onReset: () => void;
  isExample: boolean;
  /** Inline message for inputs the engine cannot calculate. */
  error?: string | null;
  /** True when the visual still shows the last valid result. */
  stale?: boolean;
}) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Panel className="flex flex-col gap-4" aria-label="Inputs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Inputs</h2>
            <p className="text-xs text-ink-2">
              {isExample ? "Example values, not data" : "Your values"}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={isExample}>
            Reset to example
          </Button>
        </div>
        {inputs}
      </Panel>

      <div className="flex min-w-0 flex-col gap-4">
        {error && (
          <p
            role="alert"
            className="rounded-md border border-negative bg-panel px-3 py-2 text-sm text-ink"
          >
            {error}{" "}
            {stale ? (
              <span className="text-ink-2">Showing the last valid result.</span>
            ) : (
              <span className="text-ink-2">Reset to the example to start again.</span>
            )}
          </p>
        )}
        {children}
      </div>

      <details className="group rounded-xl border border-rule bg-panel lg:col-span-2">
        <summary className="cursor-pointer rounded-xl px-4 py-3 text-lg font-semibold focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden">
          How this is calculated
        </summary>
        <div className="flex flex-col gap-3 border-t border-rule px-4 py-4 text-sm text-ink-2">
          {how}
        </div>
      </details>
    </div>
  );
}

/** A formula or worked-example line: tabular numbers, wraps on small screens. */
export function FormulaLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-panel-sunk px-3 py-2 font-condensed text-sm text-ink tabular-nums">
      {children}
    </p>
  );
}
