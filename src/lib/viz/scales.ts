import { scaleLinear, scaleLog, scaleSqrt } from "d3";

/** A scale that returns null for a value it cannot place. Null is never drawn as zero. */
export type Scale = ((value: number | null | undefined) => number | null) & {
  domain: readonly [number, number];
  range: readonly [number, number];
  ticks: (count?: number) => number[];
};

const finite = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && Number.isFinite(v);

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const s = scaleLinear().domain(domain).range(range);
  return Object.assign((v: number | null | undefined) => (finite(v) ? s(v) : null), {
    domain,
    range,
    ticks: (count?: number) => s.ticks(count),
  });
}

/** Log scale. A domain that touches zero or below is a programming error; values <= 0 return null. */
export function logScale(domain: [number, number], range: [number, number]): Scale {
  if (!(domain[0] > 0 && domain[1] > 0)) {
    throw new RangeError(`Log scale needs a positive domain, got [${domain[0]}, ${domain[1]}]`);
  }
  const s = scaleLog().domain(domain).range(range);
  return Object.assign((v: number | null | undefined) => (finite(v) && v > 0 ? s(v) : null), {
    domain,
    range,
    ticks: (count?: number) => s.ticks(count),
  });
}

/**
 * Size scale for bubbles: radius = k·√value, so area is proportional to value.
 * The domain starts at zero by construction. Null and negative values return null.
 */
export function sqrtScale(maxValue: number, maxRadius: number): Scale {
  const s = scaleSqrt().domain([0, maxValue]).range([0, maxRadius]);
  return Object.assign((v: number | null | undefined) => (finite(v) && v >= 0 ? s(v) : null), {
    domain: [0, maxValue] as [number, number],
    range: [0, maxRadius] as [number, number],
    ticks: (count?: number) => s.ticks(count),
  });
}
