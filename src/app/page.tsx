import { PageCanvas } from "@/components/shell/PageCanvas";
import {
  getAnomalies,
  getCompanies,
  getCompetitors,
  getFunds,
  getInvestors,
  getMerges,
  getRounds,
} from "@/lib/data";
import { formatCount } from "@/lib/format";

export default async function CommandPage() {
  const [investors, funds, rounds, companies, competitors, anomalies, merges] = await Promise.all([
    getInvestors(),
    getFunds(),
    getRounds(),
    getCompanies(),
    getCompetitors(),
    getAnomalies(),
    getMerges(),
  ]);

  const counts = [
    { label: "Investors", value: investors.length },
    { label: "Funds", value: funds.length },
    { label: "Rounds", value: rounds.length },
    { label: "Companies", value: companies.length },
    { label: "Competitors", value: competitors.length },
    { label: "Source anomalies flagged", value: anomalies.length },
    { label: "Name merges to review", value: merges.length },
  ];

  return (
    <PageCanvas
      title="Command"
      description="Headline numbers across investors, funds, deals and competitors."
    >
      <dl className="max-w-sm divide-y divide-rule border-y border-rule">
        {counts.map((c) => (
          <div key={c.label} className="flex items-baseline justify-between py-2">
            <dt className="text-sm text-ink-2">{c.label}</dt>
            <dd className="num text-base">{formatCount(c.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-ink-2">
        Raw counts from data/processed. Phase 2 replaces this with the overview: regional split,
        fresh-capital funds and dry powder, deals mapped and top fit-scored investors.
      </p>
    </PageCanvas>
  );
}
