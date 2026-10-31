import { sqrtScale } from "@/lib/viz/scales";
import { SEQUENTIAL } from "@/lib/viz/palette";
import { markStyle } from "@/lib/viz/palette";
import { cn } from "@/lib/utils";

export type LegendProps =
  | {
      kind: "categorical";
      /**
       * `hollow` draws a ring (generalists); `shape: "square"` marks accelerators and
       * incubators; `ring` adds a 2px outline in that colour (competitors); `shape: "line"`
       * is an edge, `lineWidth` px thick.
       */
      items: readonly {
        label: string;
        color: string;
        hollow?: boolean;
        shape?: "circle" | "square" | "line";
        ring?: string;
        lineWidth?: number;
      }[];
      /** Optional heading for the group, e.g. "Companies". */
      title?: string;
      className?: string;
    }
  | {
      kind: "size";
      /** What size encodes, e.g. "Latest fund size". */
      title: string;
      /** Sample values with their formatted labels, smallest to largest. */
      samples: readonly { value: number; label: string }[];
      maxRadius?: number;
      className?: string;
    }
  | {
      kind: "sequential";
      title: string;
      lowLabel: string;
      highLabel: string;
      className?: string;
    };

/** Categorical swatches, a size key that states the area encoding, or a sequential ramp. */
export function Legend(props: LegendProps) {
  if (props.kind === "categorical") {
    const list = (
      <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2", props.className)}>
        {props.items.map((it) => {
          const m = markStyle(it.color);
          if (it.shape === "line") {
            return (
              <li key={it.label} className="flex items-center gap-1.5">
                <svg width="18" height="10" aria-hidden>
                  <line
                    x1="1"
                    x2="17"
                    y1="5"
                    y2="5"
                    stroke={it.color}
                    strokeWidth={it.lineWidth ?? 1.5}
                    strokeLinecap="round"
                  />
                </svg>
                {it.label}
              </li>
            );
          }
          if (it.ring) {
            return (
              <li key={it.label} className="flex items-center gap-1.5">
                <svg width="12" height="12" aria-hidden>
                  <circle cx="6" cy="6" r="4" fill={it.color} stroke={it.ring} strokeWidth={2} />
                </svg>
                {it.label}
              </li>
            );
          }
          return (
            <li key={it.label} className="flex items-center gap-1.5">
              <svg width="10" height="10" aria-hidden>
                {it.shape === "square" ? (
                  <rect
                    x="1"
                    y="1"
                    width="8"
                    height="8"
                    fill={it.hollow ? "none" : m.fill}
                    stroke={m.stroke}
                    strokeWidth={it.hollow ? 1.5 : 1}
                  />
                ) : (
                  <circle
                    cx="5"
                    cy="5"
                    r="4.5"
                    fill={it.hollow ? "none" : m.fill}
                    stroke={m.stroke}
                    strokeWidth={it.hollow ? 1.5 : 1}
                  />
                )}
              </svg>
              {it.label}
            </li>
          );
        })}
      </ul>
    );
    if (!props.title) return list;
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted">{props.title}</p>
        {list}
      </div>
    );
  }

  if (props.kind === "size") {
    const maxRadius = props.maxRadius ?? 14;
    const max = Math.max(...props.samples.map((s) => s.value));
    const r = sqrtScale(max, maxRadius);
    const width = props.samples.length * (maxRadius * 2 + 28);
    return (
      <div className={cn("text-sm text-ink-2", props.className)}>
        <p>{props.title}</p>
        <svg
          width={width}
          height={maxRadius * 2 + 18}
          role="img"
          aria-label={`${props.title} size key`}
        >
          {props.samples.map((s, i) => {
            const radius = r(s.value) ?? 0;
            const cx = i * (maxRadius * 2 + 28) + maxRadius;
            return (
              <g key={s.label}>
                <circle
                  cx={cx}
                  cy={maxRadius * 2 - radius}
                  r={radius}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth={1}
                />
                <text
                  x={cx}
                  y={maxRadius * 2 + 13}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--ink-2)"
                  className="font-condensed tabular-nums"
                >
                  {s.label}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="text-xs text-muted">Circle area is proportional to the value.</p>
      </div>
    );
  }

  return (
    <div className={cn("text-sm text-ink-2", props.className)}>
      <p>{props.title}</p>
      <div
        aria-hidden
        className="mt-1 h-2 w-48 rounded-sm"
        style={{ background: `linear-gradient(90deg, ${SEQUENTIAL.low}, ${SEQUENTIAL.high})` }}
      />
      <div className="flex w-48 justify-between text-xs text-muted tabular-nums">
        <span>{props.lowLabel}</span>
        <span>{props.highLabel}</span>
      </div>
    </div>
  );
}
