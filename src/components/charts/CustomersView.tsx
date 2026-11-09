"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryStates } from "nuqs";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Chip, FindBox, FindMark, Panel, Segmented } from "@/components/ui-atlas";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { customerParsers, customerUrlOptions, toCustomerFilters } from "@/lib/customers/url";
import { formatCount, UNKNOWN } from "@/lib/format";
import {
  CUSTOMER_AREA_LABELS,
  CUSTOMER_AREA_STATE,
  CUSTOMER_LIST_LABELS,
  CUSTOMER_REVENUE_LABELS,
  CUSTOMER_SECTOR_LABELS,
  CUSTOMER_TEAM_LABELS,
  CUSTOMER_TIER_LABELS,
  CUSTOMER_TIER_NOTES,
} from "@/lib/format/labels";
import { useInspector } from "@/lib/hooks/useInspector";
import {
  CUSTOMER_AREAS,
  CUSTOMER_LISTS,
  CUSTOMER_REVENUE_BANDS,
  CUSTOMER_SECTORS,
  CUSTOMER_TEAM_BANDS,
  type CustomerList,
} from "@/lib/schema/enums";
import { useFindQuery } from "@/lib/search/find-state";
import { matchRecord } from "@/lib/search/match";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_TIERS,
  customerFacetCounts,
  customerSearchText,
  filterCustomers,
  hasCustomerFilters,
  type CustomerRow,
} from "@/lib/viz/transforms/customers";

type Option = { value: string; label: string; group?: string };

/** A filter as a compact button that opens a chip list with counts. */
function FacetMenu({
  label,
  options,
  selected,
  counts,
  onChange,
  note,
}: {
  label: string;
  options: readonly Option[];
  selected: readonly string[];
  counts: Record<string, number>;
  onChange: (next: string[]) => void;
  note?: string;
}) {
  const name = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const shown =
    selected.length === 0
      ? null
      : selected.length === 1
        ? name(selected[0]!)
        : `${selected.length} selected`;
  const groups = [...new Set(options.map((o) => o.group ?? ""))];
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors duration-(--dur-open) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
            shown
              ? "border-accent bg-accent-soft text-ink"
              : "border-rule bg-panel text-ink-2 hover:bg-panel-sunk hover:text-ink",
          )}
        >
          <span>{label}</span>
          {shown && <span className="text-ink">{shown}</span>}
          <ChevronDown aria-hidden className="size-3.5 text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn(options.length > 8 ? "w-[24rem]" : "w-72")}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">{label}</p>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              Show all
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {groups.map((g) => (
            <div key={g} className="flex flex-col gap-1.5">
              {g && <p className="text-xs text-ink-2">{g}</p>}
              <div className="flex flex-wrap gap-1.5">
                {options
                  .filter((o) => (o.group ?? "") === g)
                  .map((o) => (
                    <Chip
                      key={o.value}
                      label={o.label}
                      count={counts[o.value] ?? 0}
                      selected={selected.includes(o.value)}
                      onClick={() => toggle(o.value)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
        {note && <p className="mt-2 text-xs text-ink-2">{note}</p>}
      </PopoverContent>
    </Popover>
  );
}

const AREA_OPTIONS: Option[] = CUSTOMER_AREAS.map((a) => ({
  value: a,
  label: CUSTOMER_AREA_LABELS[a],
  group: CUSTOMER_AREA_STATE[a],
}));
const SECTOR_OPTIONS: Option[] = CUSTOMER_SECTORS.map((s) => ({
  value: s,
  label: CUSTOMER_SECTOR_LABELS[s],
}));
const REVENUE_OPTIONS: Option[] = CUSTOMER_REVENUE_BANDS.map((b) => ({
  value: b,
  label: CUSTOMER_REVENUE_LABELS[b],
}));
const TEAM_OPTIONS: Option[] = CUSTOMER_TEAM_BANDS.map((b) => ({
  value: b,
  label: CUSTOMER_TEAM_LABELS[b],
}));

type SortKey = "name" | "tier" | "revenue" | "team" | "location" | "rivals";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const sortValue: Record<SortKey, (r: CustomerRow) => number | string | null> = {
  name: (r) => r.name.toLowerCase(),
  tier: (r) => Number(r.tier),
  revenue: (r) => (r.revenueBand ? CUSTOMER_REVENUE_BANDS.indexOf(r.revenueBand) : null),
  team: (r) => (r.teamBand ? CUSTOMER_TEAM_BANDS.indexOf(r.teamBand) : null),
  location: (r) => (r.areas[0] ? CUSTOMER_AREAS.indexOf(r.areas[0]) : null),
  rivals: (r) => r.competitors.length,
};

function sortRows(rows: readonly CustomerRow[], sort: Sort): CustomerRow[] {
  const value = sortValue[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else {
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      if (c !== 0) return c * sign;
    }
    // Ties: tier, then name, so equal bands still read in a sensible order.
    return Number(a.tier) - Number(b.tier) || a.name.localeCompare(b.name);
  });
}

const COLUMNS: { key: SortKey | null; label: string; numeric?: boolean; className?: string }[] = [
  { key: "name", label: "Company" },
  { key: "tier", label: "Tier" },
  { key: null, label: "Category (as listed)", className: "hidden md:table-cell" },
  { key: "revenue", label: "Revenue, ₹ cr/yr", numeric: true },
  { key: "team", label: "Team", numeric: true },
  { key: "location", label: "Location" },
  { key: "rivals", label: "Competitors there" },
];

const otherList = (l: CustomerList) => CUSTOMER_LIST_LABELS[l];

/** The Customers page: the user's target lists with filters, a find box and sortable columns. */
export function CustomersView({ rows }: { rows: readonly CustomerRow[] }) {
  const { open } = useInspector();
  const [url, setUrl] = useQueryStates(customerParsers, customerUrlOptions);
  const filters = useMemo(() => toCustomerFilters(url), [url]);
  const find = useFindQuery(undefined, url.q);
  const q = find.query.trim();
  const [sort, setSort] = useState<Sort>({ key: "tier", dir: "asc" });

  // The find text lives in the URL (`?q=`) so a link can open the page on a company. `written`
  // is the last value both sides agree on, so neither effect echoes the other's change.
  const written = useRef(url.q);
  const { setInput } = find;
  useEffect(() => {
    if (find.query === written.current) return;
    written.current = find.query;
    void setUrl({ q: find.query || null });
  }, [find.query, setUrl]);
  // A link followed while the page is open (the palette) replaces the text.
  useEffect(() => {
    if (url.q === written.current) return;
    written.current = url.q;
    setInput(url.q);
  }, [url.q, setInput]);

  const filtered = useMemo(() => filterCustomers(rows, filters), [rows, filters]);
  const found = useMemo(
    () => (q ? filtered.filter((r) => matchRecord(q, customerSearchText(r)) !== null) : filtered),
    [filtered, q],
  );
  const shown = useMemo(() => sortRows(found, sort), [found, sort]);
  const counts = useMemo(() => customerFacetCounts(rows, filters), [rows, filters]);
  const active = hasCustomerFilters(filters);

  const set = (patch: Partial<typeof url>) => void setUrl(patch);
  const reset = () =>
    void setUrl({
      c_list: null,
      c_tier: [],
      c_area: [],
      c_sector: [],
      c_rev: [],
      c_team: [],
      c_rival: false,
    });
  const toggleSort = (key: SortKey, numeric?: boolean) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: numeric ? "desc" : "asc" },
    );

  return (
    <Panel className="flex min-h-0 flex-col gap-3" aria-labelledby="customers-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="customers-title" className="text-lg font-semibold">
            {formatCount(rows.length)} target customers
          </h3>
          <p className="max-w-prose text-sm text-ink-2">
            Your two lists in one table. Filter by list, tier, area, industry and size; competitor
            names open the Inspector.
          </p>
        </div>
        <FindBox
          label="Find customers"
          value={find.input}
          onValueChange={find.setInput}
          matches={q ? found.length : null}
          total={filtered.length}
          placeholder="Find company, place, category"
        />
      </header>

      <div role="group" aria-label="Customer filters" className="flex flex-wrap items-center gap-2">
        <Segmented
          label="List"
          value={filters.list ?? "all"}
          onChange={(v) => set({ c_list: v === "all" ? null : v })}
          options={[
            { value: "all", label: `All ${formatCount(counts.list.all)}` },
            ...CUSTOMER_LISTS.map((l) => ({
              value: l,
              label: `${CUSTOMER_LIST_LABELS[l]} ${formatCount(counts.list[l])}`,
            })),
          ]}
        />
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-rule sm:block" />
        {CUSTOMER_TIERS.map((t) => (
          <Chip
            key={t}
            label={CUSTOMER_TIER_LABELS[t]}
            title={CUSTOMER_TIER_NOTES[t]}
            count={counts.tier[t]}
            selected={filters.tier.includes(t)}
            onClick={() =>
              set({
                c_tier: filters.tier.includes(t)
                  ? filters.tier.filter((x) => x !== t)
                  : [...filters.tier, t],
              })
            }
          />
        ))}
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-rule sm:block" />
        <FacetMenu
          label="Area"
          options={AREA_OPTIONS}
          selected={filters.area}
          counts={counts.area}
          onChange={(v) => set({ c_area: v as (typeof filters.area)[number][] })}
          note="From the address column: HQ and main plant areas. A company with plants in two areas counts in both."
        />
        <FacetMenu
          label="Industry"
          options={SECTOR_OPTIONS}
          selected={filters.sector}
          counts={counts.sector}
          onChange={(v) => set({ c_sector: v as (typeof filters.sector)[number][] })}
          note="Groups the lists' own categories; a combined category such as specialty chemicals and pharma counts in both."
        />
        <FacetMenu
          label="Revenue"
          options={REVENUE_OPTIONS}
          selected={filters.revenue}
          counts={counts.revenue}
          onChange={(v) => set({ c_rev: v as (typeof filters.revenue)[number][] })}
          note="₹ crore a year, approximate, as the lists give it."
        />
        <FacetMenu
          label="Team size"
          options={TEAM_OPTIONS}
          selected={filters.team}
          counts={counts.team}
          onChange={(v) => set({ c_team: v as (typeof filters.team)[number][] })}
          note="Employees, approximate; large groups show the whole group."
        />
        <Chip
          label="Competitor already there"
          count={counts.rivals}
          selected={filters.rivals}
          onClick={() => set({ c_rival: !filters.rivals })}
        />
        {active && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden />
            Reset
          </Button>
        )}
      </div>

      <div className="max-h-[calc(100dvh-17rem)] min-h-96 overflow-auto rounded-md border border-rule">
        <table className="w-full text-sm">
          <caption className="sr-only">Target customers</caption>
          <thead className="sticky top-0 z-10 bg-panel-sunk text-left text-ink-2">
            <tr>
              {COLUMNS.map((c) => {
                const on = c.key !== null && sort.key === c.key;
                return (
                  <th
                    key={c.label}
                    scope="col"
                    aria-sort={
                      c.key
                        ? on
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={cn(
                      "p-2 font-medium whitespace-nowrap",
                      c.numeric && "text-right",
                      c.className,
                    )}
                  >
                    {c.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key!, c.numeric)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm hover:text-ink",
                          on && "text-ink",
                        )}
                      >
                        {c.label}
                        {on &&
                          (sort.dir === "asc" ? (
                            <ChevronUp aria-hidden className="size-3.5" />
                          ) : (
                            <ChevronDown aria-hidden className="size-3.5" />
                          ))}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-rule align-top hover:bg-panel-sunk/60">
                <td className="min-w-48 p-2">
                  <span className="font-medium">
                    <FindMark text={r.name} query={q} />
                  </span>
                  <span className="block text-xs text-ink-2">
                    {CUSTOMER_LIST_LABELS[r.list]} list
                    {r.alsoListed.length > 0 &&
                      ` · also on the ${r.alsoListed.map((a) => otherList(a.list)).join(", ")} list`}
                  </span>
                  <span className="block text-xs text-ink-2 md:hidden">
                    <FindMark text={r.category} query={q} />
                  </span>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <span
                    title={CUSTOMER_TIER_NOTES[r.tier]}
                    className={cn(
                      "inline-flex h-5 items-center rounded px-1.5 text-xs",
                      r.tier === "1" ? "bg-accent-soft text-ink" : "bg-panel-sunk text-ink-2",
                    )}
                  >
                    {CUSTOMER_TIER_LABELS[r.tier]}
                  </span>
                </td>
                <td className="hidden max-w-60 p-2 text-ink-2 md:table-cell">
                  <FindMark text={r.category} query={q} />
                </td>
                <td className="p-2 text-right font-condensed whitespace-nowrap tabular-nums">
                  {r.revenueBand ? CUSTOMER_REVENUE_LABELS[r.revenueBand] : UNKNOWN}
                </td>
                <td className="p-2 text-right font-condensed whitespace-nowrap tabular-nums">
                  {r.teamBand ? CUSTOMER_TEAM_LABELS[r.teamBand] : UNKNOWN}
                </td>
                <td className="min-w-48 p-2">
                  <FindMark text={r.address ?? UNKNOWN} query={q} />
                </td>
                <td className="p-2">
                  {r.competitors.length === 0 ? (
                    <span className="text-muted">None named</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {r.competitors.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => open(c.id)}
                          className="rounded border border-rule px-1.5 text-xs whitespace-nowrap text-accent hover:bg-accent-soft"
                        >
                          <FindMark text={c.name} query={q} />
                        </button>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="p-4 text-sm text-ink-2">
            {q
              ? `No customer matches “${q}” with these filters.`
              : "No customer matches these filters."}
          </p>
        )}
      </div>

      <footer className="flex flex-col gap-1 border-t border-rule pt-2 text-xs text-muted">
        <p>
          Showing <span className="tabular-nums">{formatCount(shown.length)}</span> of{" "}
          <span className="tabular-nums">{formatCount(rows.length)}</span>. Tiers: 1 most feasible
          (startups and promoter-led mid-size firms), 2 larger with longer sales cycles, 3 OEMs,
          MNCs and PSUs.
        </p>
        <p>
          Sources: Industrial_AI_Target_List.xlsx (Mumbai–Pune) and
          Industrial_AI_Target_List_Bangalore.xlsx, both prepared 15 October 2026. Their notes say
          revenue and team bands are approximate and not looked up per company, large groups show
          group figures, and addresses are HQ and main plant areas to verify before a visit.
          “Competitors there” matches a competitor&rsquo;s public customer list by name; a group
          name such as Bosch or Siemens counts, so it may be another unit or country.
        </p>
      </footer>
    </Panel>
  );
}
