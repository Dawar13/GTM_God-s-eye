import Link from "next/link";
import { EXAMPLE_RAISE_USD } from "@/lib/calculators/examples";
import { formatUsd } from "@/lib/format";
import { Panel } from "@/components/ui-atlas";
import { LEGAL_TOPIC_LABELS } from "@/lib/format/labels";
import { LEGAL_DISCLAIMER } from "@/lib/schema/reference";
import type { LegalTopic } from "@/lib/schema/enums";

/**
 * The questions are restated from docs/PHASE_1_REPORT.md section 7 (open questions 1 and 2),
 * not new content, and each links to the stored legal notes on the same topics. This panel
 * makes no legal claim of its own.
 */
const QUESTIONS: readonly {
  id: string;
  report: string;
  question: string;
  context: string;
  topics: readonly LegalTopic[];
}[] = [
  {
    id: "entity",
    report: "Phase 1 report, open question 2",
    question: "Which entity raises?",
    context:
      "The Delaware C-Corp alone, or a flip of the Indian Pvt Ltd under it. The answer decides how much the requires-US-entity field and the India legal notes matter.",
    topics: ["india_flip", "reverse_flip", "delaware_requirement", "fema_pricing", "angel_tax"],
  },
  {
    id: "instrument",
    report: "Phase 1 report, open question 1",
    question: "What raise size and instrument?",
    context: `The fit scores assume a ${formatUsd(EXAMPLE_RAISE_USD)} post-money SAFE. Change the raise in the weights panel above to see the check size fit move; the instrument itself is not modelled here.`,
    topics: ["isafe", "india_convertible_note", "ccps"],
  },
];

export function StructuralQuestions({
  noteCounts,
}: {
  /** Stored legal notes per topic. */
  noteCounts: Partial<Record<LegalTopic, number>>;
}) {
  return (
    <Panel className="flex flex-col gap-4" aria-labelledby="structural-title">
      <header>
        <h3 id="structural-title" className="text-lg font-semibold">
          Open structural questions
        </h3>
        <p className="text-sm text-ink-2">
          Still open from the Phase 1 report. Each links to the stored notes on the India
          instruments page, which hold the sourced facts.
        </p>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {QUESTIONS.map((q) => (
          <li key={q.id} className="flex flex-col gap-2">
            <div>
              <h4 className="text-base font-semibold">{q.question}</h4>
              <p className="text-xs text-muted">{q.report}</p>
            </div>
            <p className="text-sm leading-6">{q.context}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {q.topics
                .filter((t) => (noteCounts[t] ?? 0) > 0)
                .map((t) => (
                  <li key={t}>
                    <Link
                      href={`/vc-math/india-instruments#topic-${t}`}
                      className="rounded-sm text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                    >
                      {LEGAL_TOPIC_LABELS[t]}
                    </Link>{" "}
                    <span className="num text-ink-2">({noteCounts[t]})</span>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="border-t border-rule pt-2 text-xs text-muted">{LEGAL_DISCLAIMER}</p>
    </Panel>
  );
}
