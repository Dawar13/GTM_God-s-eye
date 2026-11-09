import { getAcceleratorPrograms, getInvestors } from "@/lib/data";
import { formatUsd, UNKNOWN } from "@/lib/format";
import { AcceleratorsTable, type AcceleratorRow } from "./accelerators-table";

/**
 * Accelerator and residency programmes from a user-supplied 2026 list. Terms
 * are shown exactly as listed (unverified); amounts are the list's own figures
 * converted to USD. Phase 1 sanity table; Phase 2 adds filters and comparison.
 * Rows are formatted here and rendered by a client table that adds the find box.
 */
export async function Accelerators() {
  const [programs, investors] = await Promise.all([getAcceleratorPrograms(), getInvestors()]);
  const byId = new Map(investors.map((i) => [i.id, i]));
  const rows: AcceleratorRow[] = [...programs]
    .sort((a, b) => (a.rank_in_list ?? 99) - (b.rank_in_list ?? 99))
    .map((p) => {
      const firm = p.investor_id ? byId.get(p.investor_id) : undefined;
      return {
        id: p.id,
        rank: p.rank_in_list === null || p.rank_in_list === undefined ? UNKNOWN : String(p.rank_in_list),
        name: p.name,
        terms: p.terms_as_listed ?? UNKNOWN,
        headline: formatUsd(p.headline_usd),
        upfront:
          p.upfront_amount === null
            ? UNKNOWN
            : `${p.upfront_amount.toLocaleString("en-US")} ${p.currency ?? ""}`.trim(),
        equity: p.equity_free
          ? "equity-free"
          : p.upfront_equity_pct === null
            ? UNKNOWN
            : `${p.upfront_equity_pct}%`,
        firmName: firm?.name ?? null,
        firm: firm ? `${firm.name}${firm.tier ? ` · Tier ${firm.tier}` : ""}` : UNKNOWN,
      };
    });

  return <AcceleratorsTable rows={rows} />;
}
