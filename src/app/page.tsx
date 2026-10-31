import { Suspense, type ReactNode } from "react";
import { CommandChartsSkeleton } from "@/components/charts/CommandChartsSkeleton";
import {
  FreshCapitalTile,
  FundsByYearTile,
  RecentDealsTile,
  TopFitTile,
} from "@/components/charts/CommandCharts";
import { PageCanvas } from "@/components/shell/PageCanvas";
import { Metric, Panel, Stat } from "@/components/ui-atlas";
import {
  getCompanies,
  getCompetitors,
  getFitFeatures,
  getFunds,
  getInvestors,
  getRounds,
} from "@/lib/data";
import { SORT_PARAM, type SortKey } from "@/lib/directory/sort";
import { toFilterable } from "@/lib/data/directory";
import { applyFilters } from "@/lib/filters";
import { parseFilters, serializeFilters } from "@/lib/filters/url";
import { formatCount } from "@/lib/format";
import { commandStats } from "@/lib/viz/transforms/commandStats";
import { freshCapitalByRegion } from "@/lib/viz/transforms/freshCapitalByRegion";
import { fundsByYear } from "@/lib/viz/transforms/fundsByYear";
import { recentDeals } from "@/lib/viz/transforms/recentDeals";
import { topByFit } from "@/lib/viz/transforms/topByFit";

type SearchParams = PageProps<"/">["searchParams"];

export default function CommandPage({ searchParams }: PageProps<"/">) {
  return (
    <PageCanvas
      title="Command"
      description="Headline numbers across investors, funds, deals and competitors. Investor figures follow the filters above."
    >
      <Suspense fallback={<CommandChartsSkeleton />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </PageCanvas>
  );
}

function StatCell({
  label,
  value,
  note,
  scope,
}: {
  label: string;
  value: ReactNode;
  note: string;
  scope: "filtered" | "all";
}) {
  return (
    <div className="flex flex-col gap-2 max-lg:odd:pr-3 max-lg:even:pl-3 lg:px-4 lg:first:pl-0 lg:last:pr-0">
      <Stat label={label} value={value} />
      <p className="text-xs text-muted">
        <span className="text-ink-2">
          {scope === "filtered" ? "Follows filters. " : "Not filtered. "}
        </span>
        {note}
      </p>
    </div>
  );
}

async function Overview({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, v);
    }
  }
  const filters = parseFilters(query);

  const [investors, funds, rounds, companies, competitors, fits] = await Promise.all([
    getInvestors(),
    getFunds(),
    getRounds(),
    getCompanies(),
    getCompetitors(),
    getFitFeatures(),
  ]);

  const shown = new Set(applyFilters(investors.map(toFilterable), filters).map((r) => r.id));
  const shownInvestors = investors.filter((i) => shown.has(i.id));
  // Fresh capital compares regions, so it ignores the region filter but keeps the others.
  const sansRegion = new Set(
    applyFilters(investors.map(toFilterable), filters, "region").map((r) => r.id),
  );

  const stats = commandStats(investors, funds, rounds, competitors.length, filters);
  const byYear = fundsByYear(funds, shown);
  const capital = freshCapitalByRegion(
    investors.filter((i) => sansRegion.has(i.id)),
    funds,
  );
  const fit = topByFit(shownInvestors, fits, 10);
  const deals = recentDeals(rounds, companies, competitors);

  const directory = (override: Partial<typeof filters> = {}, sort?: SortKey) => {
    const q = [serializeFilters({ ...filters, ...override }), sort ? `${SORT_PARAM}=${sort}` : ""]
      .filter(Boolean)
      .join("&");
    return `/investors/directory${q ? `?${q}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="grid grid-cols-2 gap-y-6 lg:grid-cols-6 lg:divide-x lg:divide-rule">
          <StatCell
            label="Investors tracked"
            scope="filtered"
            value={<Metric kind="count" value={stats.investors} />}
            note={`Of ${formatCount(stats.investorsAll)} investors in total.`}
          />
          <StatCell
            label="Western share"
            scope="filtered"
            value={<Metric kind="percent" value={stats.westernShare} />}
            note={`${formatCount(stats.westernCount)} of ${formatCount(stats.regionKnown)} with a region on record, region filter ignored; ${formatCount(stats.regionUnknown)} have none.`}
          />
          <StatCell
            label="Fresh funds"
            scope="filtered"
            value={<Metric kind="count" value={stats.freshFunds} />}
            note="Investors whose latest fund closed on or after Oct 29, 2024."
          />
          <StatCell
            label="Fresh dry powder"
            scope="filtered"
            value={<Metric kind="usd" value={stats.dryPowderUsd} />}
            note={`Sum of those latest fund sizes, not capital left to deploy${stats.freshWithoutSize ? `; ${formatCount(stats.freshWithoutSize)} have no size` : ""}.`}
          />
          <StatCell
            label="Deals mapped"
            scope="all"
            value={<Metric kind="count" value={stats.deals} />}
            note={`Funding rounds on record; ${formatCount(stats.dealsDated)} have a date.`}
          />
          <StatCell
            label="Competitors"
            scope="all"
            value={<Metric kind="count" value={stats.competitors} />}
            note="Companies tagged as competitors."
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FundsByYearTile data={byYear} href={directory()} />
        <FreshCapitalTile data={capital} href={directory({ freshness: ["fresh"], region: [] })} />
        <TopFitTile data={fit} href={directory({}, "fit-desc")} />
        <RecentDealsTile data={deals} href="/competitors#funding-timeline" />
      </div>
    </div>
  );
}
