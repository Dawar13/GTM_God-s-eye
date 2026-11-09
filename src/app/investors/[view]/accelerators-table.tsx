"use client";

import { useMemo } from "react";
import { FindBox, FindMark } from "@/components/ui-atlas";
import { useFindQuery } from "@/lib/search/find-state";
import { matchRecord } from "@/lib/search/match";

/** One programme, formatted on the server. */
export type AcceleratorRow = {
  id: string;
  rank: string;
  name: string;
  terms: string;
  headline: string;
  upfront: string;
  equity: string;
  /** The linked investor's name, matched by the find box as an alias. */
  firmName: string | null;
  firm: string;
};

const cell = "border-b border-rule/60 py-1.5 pr-4 align-top";
const head = "border-b border-rule py-2 pr-4 text-left font-medium text-ink-2";

/** The accelerator table with a find box over programme and firm names. */
export function AcceleratorsTable({ rows }: { rows: readonly AcceleratorRow[] }) {
  const find = useFindQuery();
  const q = find.query.trim();
  const shown = useMemo(
    () =>
      q ? rows.filter((r) => matchRecord(q, { name: r.name, aliases: [r.firmName] }) !== null) : rows,
    [rows, q],
  );

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-xs text-ink-2">
          {rows.length} programmes from a user-supplied list of 2026 accelerators. Terms are as the
          list states them and have not been checked against each programme; firms link to their
          investor record where the name matches exactly one.
        </p>
        <FindBox
          label="Find programmes"
          value={find.input}
          onValueChange={find.setInput}
          matches={shown.length}
          total={rows.length}
        />
      </div>
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
          {shown.map((p) => (
            <tr key={p.id}>
              <td className={`${cell} text-right num`}>{p.rank}</td>
              <td className={cell}>
                <FindMark text={p.name} query={q} />
              </td>
              <td className={cell}>{p.terms}</td>
              <td className={`${cell} text-right num`}>{p.headline}</td>
              <td className={`${cell} text-right num`}>{p.upfront}</td>
              <td className={`${cell} text-right num`}>{p.equity}</td>
              <td className={cell}>
                <FindMark text={p.firm} query={q} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {q && shown.length === 0 && (
        <p className="py-4 text-sm text-ink-2">No programme or firm name matches “{q}”.</p>
      )}
    </div>
  );
}
