import type { ReactNode } from "react";
import {
  ChartFrame,
  Chip,
  EmptyState,
  InspectorSection,
  Legend,
  Metric,
  Panel,
  Skeleton,
  SourceBadge,
  Stat,
  VizTooltip,
} from "@/components/ui-atlas";
import { formatUsd } from "@/lib/format";
import {
  CATEGORICAL,
  COMPANY_GREY,
  SEQUENTIAL,
  categoricalColor,
  companyGrey,
  markStyle,
  sequentialColor,
  sqrtScale,
} from "@/lib/viz";
import { LabSegmented } from "./LabSegmented";

const TOKENS = [
  ["canvas", "bg-canvas"],
  ["panel", "bg-panel"],
  ["panel-sunk", "bg-panel-sunk"],
  ["rule", "bg-rule"],
  ["ink", "bg-ink"],
  ["ink-2", "bg-ink-2"],
  ["muted", "bg-muted"],
  ["accent", "bg-accent"],
  ["accent-soft", "bg-accent-soft"],
  ["positive", "bg-positive"],
  ["negative", "bg-negative"],
] as const;

/** Clearly labelled example values for the bubble sample; none of these are data. */
const EXAMPLE_BUBBLES = [
  { label: "Example A", value: 20, x: 60, group: 0 },
  { label: "Example B", value: 80, x: 150, group: 1 },
  { label: "Example C", value: 250, x: 260, group: 2 },
  { label: "Example D", value: 40, x: 340, group: 3 },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ExampleBubbles() {
  const r = sqrtScale(250, 36);
  return (
    <svg
      viewBox="0 0 400 140"
      className="h-auto w-full"
      role="img"
      aria-label="Example bubble sample"
    >
      <line x1="0" y1="120" x2="400" y2="120" stroke="var(--rule)" />
      {EXAMPLE_BUBBLES.map((b) => {
        const m = markStyle(categoricalColor(b.group));
        const radius = r(b.value) ?? 0;
        return (
          <g key={b.label}>
            <circle
              cx={b.x}
              cy={110 - radius}
              r={radius}
              fill={m.fill}
              stroke={m.stroke}
              strokeWidth={1}
            />
            <text
              x={b.x}
              y="134"
              textAnchor="middle"
              fontSize="11"
              fill="var(--ink-2)"
              className="font-condensed"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Every primitive, in the theme of the nearest data-theme ancestor. */
export function Showcase({ investorCount }: { investorCount: number }) {
  return (
    <div className="flex flex-col gap-8">
      <Section title="Type">
        <Panel className="flex flex-col gap-1">
          <p className="text-2xl font-semibold">28 Page figure</p>
          <p className="text-xl font-semibold">20 Section heading</p>
          <p className="text-lg font-semibold">16 Panel title</p>
          <p className="text-base">14 Body text, 20 line height. Sentence case everywhere.</p>
          <p className="text-sm text-ink-2">13 Secondary text and chart subtitles</p>
          <p className="text-xs text-muted">12 Footnotes and sources</p>
          <p className="font-condensed text-sm tabular-nums">
            Plex Sans Condensed for tables and axes: 1,234,567 · $1.75B · 9.1%
          </p>
        </Panel>
      </Section>

      <Section title="Colour tokens">
        <Panel className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {TOKENS.map(([name, cls]) => (
            <div key={name} className="flex items-center gap-2 text-sm">
              <span className={`size-5 shrink-0 rounded-md border border-rule ${cls}`} />
              {name}
            </div>
          ))}
        </Panel>
        <Panel className="flex flex-col gap-3">
          <Legend
            kind="categorical"
            items={CATEGORICAL.map((c, i) => ({ label: `Hue ${i + 1}`, color: c }))}
          />
          <div
            className="flex gap-1"
            aria-label="Company grey ramp, light to dark by capital raised"
            role="img"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <span
                key={t}
                className="h-4 w-8 rounded-sm"
                style={{ background: companyGrey(t, 1) ?? undefined }}
              />
            ))}
            <span className="ml-2 text-sm text-ink-2">
              {COMPANY_GREY.low} to {COMPANY_GREY.high}
            </span>
          </div>
          <div className="flex gap-1" aria-label="Sequential ramp" role="img">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <span
                key={t}
                className="h-4 w-8 rounded-sm"
                style={{ background: sequentialColor(t) }}
              />
            ))}
            <span className="ml-2 text-sm text-ink-2">
              {SEQUENTIAL.low} to {SEQUENTIAL.high}
            </span>
          </div>
        </Panel>
      </Section>

      <Section title="Stat and Metric">
        <Panel className="grid grid-cols-2 gap-4">
          <Stat label="Investors tracked" value={<Metric kind="count" value={investorCount} />} />
          <Stat
            label="Example stat"
            value={<Metric kind="usd" value={1_750_000_000} />}
            unit="example"
            delta={0.123}
            deltaLabel="vs example period"
            confidence="high"
          />
          <Stat
            label="Example decline"
            value={<Metric kind="percent" value={0.0912} />}
            delta={-0.041}
            confidence="medium"
          />
          <Stat
            label="Unknown stays unknown"
            value={<Metric kind="usd" value={null} />}
            confidence="low"
          />
        </Panel>
        <Panel className="flex flex-wrap gap-4 text-base">
          <Metric kind="usd" value={1_200_000} />
          <Metric kind="usd" value={740_000_000} />
          <Metric kind="usd" value={1_750_000_000} />
          <Metric kind="inr" value={15_000_000} />
          <Metric kind="percent" value={0.0912} />
          <Metric kind="count" value={null} />
        </Panel>
      </Section>

      <Section title="Chip, Segmented, SourceBadge">
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Chip label="Western" count={investorCount} selected />
            <Chip label="Seed to Series A" count={42} />
            <Chip label="Fresh funds" />
            <Chip label="Disabled" count={0} disabled />
          </div>
          <LabSegmented />
          <div className="flex flex-wrap gap-4">
            <SourceBadge domain="example.com" confidence="high" />
            <SourceBadge domain="example.org" confidence="medium" />
            <SourceBadge domain="example.net" confidence="low" />
          </div>
        </Panel>
      </Section>

      <Section title="ChartFrame, Legend, VizTooltip">
        <ChartFrame
          title="Example bubble sample"
          subtitle="Each bubble is one example record; area shows the example value."
          legend={
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <Legend
                kind="categorical"
                items={[0, 1, 2, 3].map((i) => ({
                  label: `Group ${i + 1}`,
                  color: categoricalColor(i),
                }))}
              />
              <Legend
                kind="size"
                title="Example value"
                samples={[
                  { value: 25, label: formatUsd(25_000_000) },
                  { value: 100, label: formatUsd(100_000_000) },
                  { value: 250, label: formatUsd(250_000_000) },
                ]}
              />
            </div>
          }
          sources={["example.com"]}
          notShown={{ count: 3, field: "example value" }}
          tableAlternative={
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel-sunk text-left text-ink-2">
                  <th className="p-2 font-medium">Record</th>
                  <th className="p-2 text-right font-medium">Example value</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_BUBBLES.map((b) => (
                  <tr key={b.label} className="border-t border-rule">
                    <td className="p-2">{b.label}</td>
                    <td className="p-2 text-right font-condensed tabular-nums">
                      {formatUsd(b.value * 1_000_000)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          height={160}
        >
          <ExampleBubbles />
        </ChartFrame>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ChartFrame
            title="Loading state"
            subtitle="Skeleton with the chart footprint."
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            state={{ status: "loading" }}
            height={100}
          >
            {null}
          </ChartFrame>
          <ChartFrame
            title="Empty state"
            subtitle="Says what to do next."
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            state={{ status: "empty" }}
            height={100}
          >
            {null}
          </ChartFrame>
          <ChartFrame
            title="Error state"
            subtitle="Alert role, plain wording."
            sources={[]}
            notShown={{ count: 0, field: "none" }}
            state={{ status: "error" }}
            height={100}
          >
            {null}
          </ChartFrame>
          <Legend
            kind="sequential"
            title="Example sequential legend"
            lowLabel="Fewer"
            highLabel="More"
          />
        </div>
        <VizTooltip
          title="Example record"
          value={formatUsd(250_000_000)}
          period="Mar 2026"
          confidence="medium"
          sourceDomain="example.com"
        >
          Example size encoding
        </VizTooltip>
      </Section>

      <Section title="InspectorSection, EmptyState, Skeleton">
        <Panel padded={false} className="px-4">
          <InspectorSection title="Funds" meta="3">
            <p className="text-ink-2">Example content inside an open section.</p>
          </InspectorSection>
          <InspectorSection title="Portfolio" meta="0" defaultOpen={false}>
            <p className="text-ink-2">Example content inside a closed section.</p>
          </InspectorSection>
        </Panel>
        <Panel padded={false}>
          <EmptyState title="No portfolio rounds on record">
            Add a sourced round in the data pipeline, then reload this view.
          </EmptyState>
        </Panel>
        <Panel className="flex flex-col gap-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-16 w-full" />
        </Panel>
      </Section>
    </div>
  );
}
