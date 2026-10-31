import Link from "next/link";
import { LegalNoteCard } from "@/components/india/LegalNoteCard";
import { getLegalNotes } from "@/lib/data";
import { groupNotesByTopic, RUPEES_PER_CRORE } from "@/lib/finance";
import { formatCount } from "@/lib/format";
import { LEGAL_TOPIC_LABELS } from "@/lib/format/labels";
import type { LegalNote } from "@/lib/schema";

type Topic = LegalNote["topic"];

/** Calculators that model the instrument a topic is about. India's rules themselves are not math. */
const RELATED: Partial<Record<Topic, readonly { slug: string; label: string }[]>> = {
  isafe: [{ slug: "safe", label: "SAFE calculator" }],
  india_convertible_note: [{ slug: "convertible-note", label: "Convertible note calculator" }],
  ccps: [{ slug: "liquidation", label: "Liquidation waterfall" }],
};

/** India instruments: the sourced legal notes, grouped by topic. */
export async function IndiaInstruments() {
  const notes = await getLegalNotes();
  const groups = groupNotesByTopic(notes);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="max-w-[72ch] text-sm leading-6 text-ink-2">
          What the research found about CCPS, iSAFE, convertible notes, FEMA pricing, angel tax and
          flip structures, one sourced note at a time. The notes are the record&apos;s own words,
          with the date each was last verified. There is no calculator for these rules: the only
          arithmetic is rupee units (1 crore = {formatCount(RUPEES_PER_CRORE)} rupees), and the US
          dollar value of a rupee amount needs an exchange rate this app does not hold.
        </p>
        <nav aria-label="Topics" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {groups.map((g) => (
            <a
              key={g.topic}
              href={`#topic-${g.topic}`}
              className="rounded-sm text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
            >
              {LEGAL_TOPIC_LABELS[g.topic]}{" "}
              <span className="num text-ink-2">({g.notes.length})</span>
            </a>
          ))}
        </nav>
      </div>

      {groups.map((g) => (
        <section
          key={g.topic}
          id={`topic-${g.topic}`}
          aria-labelledby={`topic-${g.topic}-title`}
          className="flex scroll-mt-4 flex-col gap-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 id={`topic-${g.topic}-title`} className="text-lg font-semibold">
              {LEGAL_TOPIC_LABELS[g.topic]}
            </h3>
            {RELATED[g.topic] && (
              <p className="text-sm text-ink-2">
                Related:{" "}
                {RELATED[g.topic]?.map((r, i) => (
                  <span key={r.slug}>
                    {i > 0 && ", "}
                    <Link
                      href={`/vc-math/${r.slug}`}
                      className="rounded-sm text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                    >
                      {r.label}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
          {g.notes.map((n) => (
            <LegalNoteCard key={n.id} note={n} />
          ))}
        </section>
      ))}
    </div>
  );
}
