import { ExternalLink } from "lucide-react";
import { SourceBadge } from "@/components/ui-atlas";
import { formatPartialDate } from "@/lib/format";
import { JURISDICTION_LABELS } from "@/lib/format/labels";
import type { LegalNote } from "@/lib/schema";
import { domainOf } from "@/lib/viz/transforms/common";

/**
 * One sourced legal note, shown as stored: the summary and the disclaimer are the record's
 * own text, with its dates, jurisdiction and every source. Nothing here adds a legal claim.
 */
export function LegalNoteCard({ note }: { note: LegalNote }) {
  return (
    <article
      aria-labelledby={`${note.id}-title`}
      className="flex flex-col gap-3 rounded-xl border border-rule bg-panel p-4"
    >
      <header className="flex flex-col gap-1">
        <h4 id={`${note.id}-title`} className="text-base font-semibold">
          {note.title}
        </h4>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
          <Fact label="Jurisdiction" value={JURISDICTION_LABELS[note.jurisdiction]} />
          <Fact
            label="Effective"
            value={note.effective_date ? formatPartialDate(note.effective_date) : "Not stated"}
          />
          <Fact label="Last verified" value={formatPartialDate(note.last_verified)} />
        </dl>
      </header>

      <p className="max-w-[72ch] text-sm leading-6">{note.summary}</p>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Sources</p>
        <ul className="flex flex-col gap-1.5">
          {note.sources.map((s) => (
            <li key={s.url} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
              <SourceBadge domain={domainOf(s.url)} confidence={note.confidence} />
              {/^https?:/.test(s.url) ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-[48ch] items-center gap-1 truncate rounded-sm text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                >
                  <span className="truncate">{s.title ?? s.url}</span>
                  <ExternalLink aria-hidden className="size-3 shrink-0" />
                </a>
              ) : (
                <span className="text-ink-2">{s.title ?? s.url}</span>
              )}
              <span className="text-xs text-ink-2">
                Retrieved <span className="num">{formatPartialDate(s.retrieved_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-rule pt-2 text-sm text-ink-2">{note.disclaimer}</p>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt>{label}</dt>
      <dd className="font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}
