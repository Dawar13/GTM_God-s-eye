import Link from "next/link";
import { formatUsd } from "@/lib/format";
import { Panel } from "@/components/ui-atlas";
import { LEGAL_TOPIC_LABELS } from "@/lib/format/labels";
import { INSTRUMENT_PHRASES, type Instrument } from "@/lib/round";
import { LEGAL_DISCLAIMER } from "@/lib/schema/reference";
import type { LegalTopic } from "@/lib/schema/enums";

/**
 * The questions are restated from docs/PHASE_1_REPORT.md section 7 (open questions 1 and 2),
 * not new content, and each links to the stored legal notes on the same topics. This panel
 * makes no legal claim of its own.
 */
type Question = {
  id: string;
  report: string;
  question: string;
  context: string;
  /** Set when the user has answered the question. */
  decided?: string;
  topics: readonly LegalTopic[];
};

const questions = (raiseUsd: number, instrument: Instrument): readonly Question[] => [
  {
    id: "entity",
    report: "Phase 1 report, open question 2",
    question: "Which entity raises?",
    context:
      "Investors put money into the Delaware C-Corp, the US parent, not the Indian Pvt Ltd. The notes below are the ones on that route.",
    decided: "Decided: Delaware C-Corp (user decision, 2026-10-31)",
    topics: ["delaware_requirement", "india_flip", "reverse_flip", "fema_pricing"],
  },
  {
    id: "instrument",
    report: "Phase 1 report, open question 1",
    question: "What raise size and instrument?",
    context: `Our round is set in the top bar and is now ${formatUsd(raiseUsd)} as a ${INSTRUMENT_PHRASES[instrument]}. The raise moves the check size fit; the instrument picks the benchmarks highlighted above and the SAFE calculator's tab, and no fit score depends on it.`,
    topics: ["isafe", "india_convertible_note", "ccps"],
  },
];

export function StructuralQuestions({
  noteCounts,
  raiseUsd,
  instrument,
}: {
  raiseUsd: number;
  instrument: Instrument;
  /** Stored legal notes per topic. */
  noteCounts: Partial<Record<LegalTopic, number>>;
}) {
  return (
    <Panel className="flex flex-col gap-4" aria-labelledby="structural-title">
      <header>
        <h3 id="structural-title" className="text-lg font-semibold">
          Structural questions
        </h3>
        <p className="text-sm text-ink-2">
          From the Phase 1 report; the entity is decided and the instrument is set in the top bar. Each links to the stored notes on the India
          instruments page, which hold the sourced facts.
        </p>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {questions(raiseUsd, instrument).map((q) => (
          <li key={q.id} className="flex flex-col gap-2">
            <div>
              <h4 className="text-base font-semibold">{q.question}</h4>
              <p className="text-xs text-muted">{q.report}</p>
            </div>
            {q.decided && <p className="text-sm font-medium">{q.decided}</p>}
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
