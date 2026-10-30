import { getAcceleratorPrograms, getInvestors } from "@/lib/data";
import { formatUsd, UNKNOWN } from "@/lib/format";

const cell = "border-b border-rule/60 py-1.5 pr-4 align-top";
const head = "border-b border-rule py-2 pr-4 text-left font-medium text-ink-muted";

/**
 * Accelerator and residency programmes from a user-supplied 2026 list. Terms
 * are shown exactly as listed (unverified); amounts are the list's own figures
 * converted to USD. Phase 1 sanity table; Phase 2 adds filters and comparison.
 */
export async function Accelerators() {
  const [programs, investors] = await Promise.all([getAcceleratorPrograms(), getInvestors()]);
  const byId = new Map(investors.map((i) => [i.id, i]));
  const rows = [...programs].sort((a, b) => (a.rank_in_list ?? 99) - (b.rank_in_list ?? 99));

  return (
    <div className="overflow-x-auto">
      <p className="mb-3 max-w-prose text-xs text-ink-muted">
        {rows.length} programmes from a user-supplied list of 2026 accelerators. Terms are as the
        list states them and have not been checked against each programme; firms link to their
        investor record where the name matches exactly one.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className={`${head} text-right`}>
              #
            </th>
            <th scope="col" className={head}>
              Programme
            </th>
            <th scope="col" className={head}>
              Terms as listed
            </th>
            <th scope="col" className={`${head} text-right`}>
              Up to (USD)
            </th>
            <th scope="col" className={`${head} text-right`}>
              First check
            </th>
            <th scope="col" className={`${head} text-right`}>
              Equity
            </th>
            <th scope="col" className={head}>
              Firm
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const firm = p.investor_id ? byId.get(p.investor_id) : undefined;
            const upfront =
              p.upfront_amount === null
                ? UNKNOWN
                : `${p.upfront_amount.toLocaleString("en-US")} ${p.currency ?? ""}`.trim();
            return (
              <tr key={p.id}>
                <td className={`${cell} text-right num`}>{p.rank_in_list ?? UNKNOWN}</td>
                <td className={cell}>{p.name}</td>
                <td className={cell}>{p.terms_as_listed}</td>
                <td className={`${cell} text-right num`}>{formatUsd(p.headline_usd)}</td>
                <td className={`${cell} text-right num`}>{upfront}</td>
                <td className={`${cell} text-right num`}>
                  {p.equity_free
                    ? "equity-free"
                    : p.upfront_equity_pct === null
                      ? UNKNOWN
                      : `${p.upfront_equity_pct}%`}
                </td>
                <td className={cell}>
                  {firm ? `${firm.name}${firm.tier ? ` · Tier ${firm.tier}` : ""}` : UNKNOWN}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
