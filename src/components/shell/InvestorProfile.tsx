"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "cn";
import {
  FitBreakdownChart,
  FundsTimelineChart,
  SectorWeightsChart,
} from "@/components/charts/ProfileCharts";
import { InspectorSection, Skeleton, SourceBadge } from "@/components/ui-atlas";
import { loadProfile, useLoaded } from "@/lib/client-index";
import type { InvestorProfile } from "@/lib/data/profile";
import { fitForRound } from "@/lib/round/fit";
import { useRound } from "@/lib/round/use-round";
import { fitBreakdown } from "@/lib/viz/transforms/fitBreakdown";
import { formatCount, formatPartialDate, formatUsd, UNKNOWN } from "@/lib/format";
import { LAYER_LABELS, ROUND_STAGE_LABELS } from "@/lib/format/labels";
import {
  sortPortfolio,
  type DealRole,
  type PortfolioSortKey,
} from "@/lib/viz/transforms/investorDeals";

const ROLE_LABELS: Record<DealRole, string> = {
  lead: "Lead",
  participant: "Participant",
  unspecified: "Role not stated",
};

const PORTFOLIO_PAGE = 25;

/** A name that opens another record in the Inspector. */
function EntityLink({
  id,
  onOpen,
  children,
}: {
  id: string;
  onOpen: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      className="text-left hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

function checkRange(min: number | null, max: number | null): string {
  if (min !== null && max !== null)
    return min === max ? formatUsd(min) : `${formatUsd(min)}–${formatUsd(max)}`;
  if (min !== null) return `from ${formatUsd(min)}`;
  if (max !== null) return `up to ${formatUsd(max)}`;
  return UNKNOWN;
}

/** The investor sections of the Inspector, loaded from /api/entity/[id]/profile. */
export function InvestorProfileSections({
  id,
  onOpen,
}: {
  id: string;
  onOpen: (id: string) => void;
}) {
  const state = useLoaded(id, () => loadProfile(id));
  const { raise } = useRound();
  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-3 py-4" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p className="py-4 text-sm text-ink-2">
        The profile could not be loaded. Reopen the record to retry.
      </p>
    );
  }
  const p = state.data;
  const d = p.deals;
  // The check size fit is scored for our round (top bar); the other features are as stored.
  const fit = p.fit
    ? fitBreakdown(
        fitForRound(
          p.fit,
          { checkMinUsd: p.checkMinUsd, checkMaxUsd: p.checkMaxUsd, leads: p.leads },
          raise,
        ),
      )
    : null;
  return (
    <>
      <InspectorSection title="Focus">
        <dl className="divide-y divide-rule text-sm">
          {[
            { label: "Stages", value: p.stages.length ? p.stages.join(", ") : UNKNOWN },
            { label: "Check size", value: checkRange(p.checkMinUsd, p.checkMaxUsd) },
            { label: "Leads rounds", value: p.leads === null ? UNKNOWN : p.leads ? "Yes" : "No" },
            { label: "Reported portfolio", value: formatCount(p.portfolioCountReported) },
          ].map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-4 py-1.5">
              <dt className="text-ink-2">{f.label}</dt>
              <dd className="text-right num">{f.value}</dd>
            </div>
          ))}
        </dl>
      </InspectorSection>

      <InspectorSection title="Fit score">
        {fit ? (
          <FitBreakdownChart fit={fit} provenance={p.provenance} />
        ) : (
          <p className="text-sm text-ink-2">No fit features are on record for this investor.</p>
        )}
      </InspectorSection>

      <InspectorSection title="Thesis">
        {p.thesis.text ? (
          <>
            <p className="text-sm leading-relaxed">{p.thesis.text}</p>
            <p className="mt-2 text-xs text-ink-2">
              Paraphrased from the firm&apos;s own description.
              {p.thesis.sourceDomain && (
                <>
                  {" "}
                  <SourceBadge
                    domain={p.thesis.sourceDomain}
                    confidence={p.provenance.confidence}
                  />
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-2">{UNKNOWN} No thesis text is on record.</p>
        )}
      </InspectorSection>

      <InspectorSection title="Sector weights">
        <SectorWeightsChart sectors={p.sectors} provenance={p.provenance} />
      </InspectorSection>

      <InspectorSection
        title="Funds"
        meta={String(p.funds.points.length + p.funds.notPlotted.length)}
      >
        <FundsTimelineChart funds={p.funds} />
      </InspectorSection>

      <InspectorSection title="Partners" meta={String(p.partners.length)}>
        {p.partners.length === 0 ? (
          <p className="text-sm text-ink-2">No partners are on record.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {p.partners.map((partner) => (
              <li key={partner.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{partner.name}</span>
                  {partner.linkedinUrl && (
                    <a
                      href={partner.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${partner.name} on LinkedIn (opens in a new tab)`}
                      className="shrink-0 text-accent hover:underline"
                    >
                      <ExternalLink aria-hidden className="size-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-ink-2">{partner.title ?? UNKNOWN}</p>
                {partner.focusSectors.length > 0 && (
                  <p className="text-xs text-ink-2">{partner.focusSectors.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>

      <InspectorSection title="Portfolio" meta={`${formatCount(d.portfolio.length)} companies`}>
        <PortfolioTable rows={d.portfolio} rounds={d.roundCount} onOpen={onOpen} />
      </InspectorSection>

      <InspectorSection
        title="Co-investors"
        meta={
          d.coInvestorTotal > d.coInvestors.length
            ? `top ${d.coInvestors.length} of ${formatCount(d.coInvestorTotal)}`
            : String(d.coInvestors.length)
        }
      >
        {d.coInvestors.length === 0 ? (
          <p className="text-sm text-ink-2">No shared rounds are on record.</p>
        ) : (
          <>
            <ol className="flex flex-col gap-1 text-sm">
              {d.coInvestors.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3">
                  <EntityLink id={c.id} onOpen={onOpen}>
                    {c.name}
                  </EntityLink>
                  <span className="shrink-0 num text-xs text-ink-2">
                    {formatCount(c.shared)} {c.shared === 1 ? "round" : "rounds"}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-ink-2">
              Investors named in the same funding rounds, in any role, most shared rounds first.
            </p>
          </>
        )}
      </InspectorSection>

      <InspectorSection title="Competitor exposure" meta={String(d.competitors.length)}>
        {d.competitors.length === 0 ? (
          <p className="text-sm text-ink-2">
            No tracked competitor is in this investor&apos;s recorded rounds.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {d.competitors.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <EntityLink id={c.id} onOpen={onOpen}>
                    {c.name}
                  </EntityLink>
                  <span className="ml-2 text-xs text-ink-2">{LAYER_LABELS[c.layer]}</span>
                </span>
                <span className="shrink-0 num text-xs text-ink-2">
                  {ROLE_LABELS[c.role]}
                  {c.rounds > 1 ? `, ${c.rounds} rounds` : ""}
                  {c.latestDate ? `, ${formatPartialDate(c.latestDate)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>
    </>
  );
}

const PORTFOLIO_COLUMNS: { key: PortfolioSortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Company" },
  { key: "role", label: "Role" },
  { key: "rounds", label: "Rounds", numeric: true },
  { key: "latest", label: "Latest", numeric: true },
  { key: "amount", label: "Round size", numeric: true },
];

function PortfolioTable({
  rows,
  rounds,
  onOpen,
}: {
  rows: InvestorProfile["deals"]["portfolio"];
  rounds: number;
  onOpen: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: PortfolioSortKey; dir: "asc" | "desc" }>({
    key: "latest",
    dir: "desc",
  });
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => sortPortfolio(rows, sort.key, sort.dir), [rows, sort]);
  if (rows.length === 0) {
    return <p className="text-sm text-ink-2">No funding rounds name this investor.</p>;
  }
  const shown = all ? sorted : sorted.slice(0, PORTFOLIO_PAGE);
  const onSort = (key: PortfolioSortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" || key === "role" ? "asc" : "desc" },
    );
  return (
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">Portfolio companies from recorded funding rounds</caption>
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-2">
            {PORTFOLIO_COLUMNS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("py-1.5 font-medium", c.numeric && "text-right")}
                >
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className={cn(
                      "inline-flex items-center gap-0.5 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent",
                      active && "text-ink",
                    )}
                  >
                    {c.label}
                    {active &&
                      (sort.dir === "asc" ? (
                        <ChevronUp aria-hidden className="size-3" />
                      ) : (
                        <ChevronDown aria-hidden className="size-3" />
                      ))}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.companyId} className="border-b border-rule/60 align-baseline">
              <td className="max-w-40 py-1.5 pr-2">
                <EntityLink id={r.companyId} onOpen={onOpen}>
                  {r.name}
                </EntityLink>
                {r.isCompetitor && <span className="ml-1.5 text-xs text-accent">Competitor</span>}
              </td>
              <td className="py-1.5 pr-2 text-xs text-ink-2">{ROLE_LABELS[r.role]}</td>
              <td className="py-1.5 pr-2 text-right num">{r.rounds}</td>
              <td className="py-1.5 pr-2 text-right num" title={ROUND_STAGE_LABELS[r.latestStage]}>
                {formatPartialDate(r.latestDate)}
              </td>
              <td className="py-1.5 text-right num">{formatUsd(r.latestAmountUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-ink-2">
        <span>
          {formatCount(rounds)} recorded {rounds === 1 ? "round" : "rounds"}. Latest and round size
          are for each company&apos;s most recent dated round.
        </span>
        {sorted.length > PORTFOLIO_PAGE && (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="shrink-0 text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {all ? "Show fewer" : `Show all ${formatCount(sorted.length)}`}
          </button>
        )}
      </div>
    </div>
  );
}
