/**
 * Thesis layout compaction (2026-11-13). UMAP puts single-sector funds (pure SaaS, health,
 * consumer, fintech, crypto) on tight islands far from the mixed core, with empty space in
 * between, so the core, where the industrial and AI clusters sit, shrinks to a corner of the
 * map. UMAP's distances between groups carry no meaning (the map has no units); only "near
 * means similar" does. So islands outside the core move inward as rigid pieces: each keeps its
 * shape and direction, and stops just outside the core or the islands already placed. Points
 * in the core never move. Pure, and run on the whole layout so filters never move a point; the
 * map and the Directory's area filter share it, so a brushed region means the same rows.
 */

type XY = { x: number; y: number };

const median = (vs: readonly number[]) => {
  const s = [...vs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export type CompactOptions = {
  /** An empty radial band at least this share of the largest radius separates core and islands. */
  minGap?: number;
  /** Points closer than this share of the core radius belong to one island. */
  link?: number;
  /** Space left between the core and an island, and between islands, as a share of the core radius. */
  margin?: number;
};

/**
 * Islands as index lists: single linkage within `eps`, via a grid so it stays near linear.
 */
function islands(points: readonly XY[], idx: readonly number[], eps: number): number[][] {
  const cell = (v: number) => Math.floor(v / eps);
  const grid = new Map<string, number[]>();
  for (const i of idx) {
    const k = `${cell(points[i]!.x)},${cell(points[i]!.y)}`;
    grid.set(k, [...(grid.get(k) ?? []), i]);
  }
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const start of idx) {
    if (seen.has(start)) continue;
    seen.add(start);
    const group = [start];
    for (let g = 0; g < group.length; g++) {
      const p = points[group[g]!]!;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const j of grid.get(`${cell(p.x) + dx},${cell(p.y) + dy}`) ?? []) {
            if (seen.has(j)) continue;
            const q = points[j]!;
            if (Math.hypot(q.x - p.x, q.y - p.y) <= eps) {
              seen.add(j);
              group.push(j);
            }
          }
        }
      }
    }
    out.push(group);
  }
  return out;
}

export function compactLayout<T extends XY>(
  points: readonly T[],
  { minGap = 0.1, link = 0.15, margin = 0.12 }: CompactOptions = {},
): T[] {
  if (points.length < 10) return [...points];
  const cx = median(points.map((p) => p.x));
  const cy = median(points.map((p) => p.y));
  const r = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const sorted = [...r].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1]!;

  // The core ends at the first empty radial band of real width, past the middle of the data.
  let core = max;
  for (let i = Math.floor(sorted.length / 2); i < sorted.length; i++) {
    if (sorted[i]! - sorted[i - 1]! >= minGap * max) {
      core = sorted[i - 1]!;
      break;
    }
  }
  if (core >= max) return [...points];

  const outer = r.flatMap((d, i) => (d > core ? [i] : []));
  const gapSpace = margin * core;
  const groups = islands(points, outer, link * core)
    .map((members) => {
      const gx = members.reduce((s, i) => s + points[i]!.x, 0) / members.length;
      const gy = members.reduce((s, i) => s + points[i]!.y, 0) / members.length;
      const dist = Math.hypot(gx - cx, gy - cy) || 1;
      const ux = (gx - cx) / dist;
      const uy = (gy - cy) / dist;
      // How far it sits out along its own direction, and its radius around its centre.
      const near = Math.min(
        ...members.map((i) => (points[i]!.x - cx) * ux + (points[i]!.y - cy) * uy),
      );
      const size = Math.max(
        ...members.map((i) => Math.hypot(points[i]!.x - gx, points[i]!.y - gy)),
      );
      return { members, gx, gy, ux, uy, near, size };
    })
    .sort((a, b) => a.near - b.near);

  // Move each island in until it is `gapSpace` outside the core, then back out while it
  // would overlap an island already placed.
  const placed: { x: number; y: number; size: number }[] = [];
  const shift = new Map<number, [number, number]>();
  for (const g of groups) {
    let t = Math.max(0, g.near - (core + gapSpace));
    const at = (tt: number) => ({ x: g.gx - g.ux * tt, y: g.gy - g.uy * tt });
    const clashes = (tt: number) =>
      placed.some((q) => {
        const c = at(tt);
        return Math.hypot(c.x - q.x, c.y - q.y) < q.size + g.size + gapSpace;
      });
    const step = Math.max(gapSpace / 4, 1e-6);
    while (t > 0 && clashes(t)) t = Math.max(0, t - step);
    const c = at(t);
    placed.push({ x: c.x, y: c.y, size: g.size });
    for (const i of g.members) shift.set(i, [-g.ux * t, -g.uy * t]);
  }
  return points.map((p, i) => {
    const s = shift.get(i);
    return s ? { ...p, x: p.x + s[0], y: p.y + s[1] } : p;
  });
}
