import { describe, expect, it } from "vitest";
import { compactLayout } from "@/lib/viz/compactLayout";
import { overlaps, placeNames } from "@/lib/viz/labels";

type P = { id: string; x: number; y: number };
/** A disc of points around (cx, cy). */
const disc = (prefix: string, cx: number, cy: number, n: number, radius: number): P[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = (radius * ((i % 5) + 1)) / 5;
    return { id: `${prefix}${i}`, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

describe("compactLayout", () => {
  const core = disc("c", 0, 0, 60, 3);
  const east = disc("e", 20, 0, 15, 1);
  const eastFar = disc("f", 26, 0.5, 15, 1); // a second island behind the first
  const north = disc("n", 0, 22, 15, 1);
  const out = compactLayout([...core, ...east, ...eastFar, ...north]);
  const by = new Map(out.map((p) => [p.id, p]));

  it("never moves the core", () => {
    for (const p of core) expect(by.get(p.id)).toBe(p);
  });

  it("moves each island in as one piece, keeping its shape and direction", () => {
    for (const island of [east, eastFar, north]) {
      const [a, b] = [island[0]!, island[7]!];
      expect(dist(by.get(a.id)!, by.get(b.id)!)).toBeCloseTo(dist(a, b), 9);
    }
    // Moved inward along (nearly) its own direction from the layout's centre.
    const n0 = by.get("n0")!;
    expect(n0.y).toBeLessThan(north[0]!.y);
    const angle = (p: P) => Math.atan2(p.y, p.x);
    expect(Math.abs(angle(n0) - angle(north[0]!))).toBeLessThan(0.15);
  });

  it("stops islands just outside the core and clear of each other", () => {
    const radius = (ps: readonly P[]) =>
      Math.min(...ps.map((p) => Math.hypot(by.get(p.id)!.x, by.get(p.id)!.y)));
    expect(radius(east)).toBeGreaterThan(3);
    expect(radius(east)).toBeLessThan(6);
    // The second island in the same direction stays behind the first.
    for (const a of east)
      for (const b of eastFar) expect(dist(by.get(a.id)!, by.get(b.id)!)).toBeGreaterThan(0.2);
    expect(Math.max(...out.map((p) => Math.hypot(p.x, p.y)))).toBeLessThan(15);
  });

  it("leaves a layout with no empty band, or a tiny one, as it is", () => {
    // A filled grid: no empty radial band anywhere.
    const even: P[] = [];
    for (let x = -10; x <= 10; x += 0.5) {
      for (let y = -10; y <= 10; y += 0.5)
        if (Math.hypot(x, y) <= 10) even.push({ id: `${x},${y}`, x, y });
    }
    expect(compactLayout(even)).toEqual(even);
    expect(compactLayout(east.slice(0, 5))).toEqual(east.slice(0, 5));
  });
});

describe("placeNames", () => {
  it("steps a name a line up or down to clear one already placed, keeps it inside, else drops it", () => {
    const placed = placeNames(
      [
        { id: "a", x: 100, y: 50, w: 120, h: 14 },
        { id: "b", x: 110, y: 52, w: 120, h: 14 },
        { id: "c", x: 105, y: 8, w: 120, h: 14 },
      ],
      { width: 300, height: 100 },
    );
    expect(placed.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(placed[1]!.y).toBe(52 - 16);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++)
        expect(overlaps(placed[i]!.box, placed[j]!.box)).toBe(false);
      expect(placed[i]!.box.y0).toBeGreaterThanOrEqual(0);
    }
    const crowded = placeNames(
      [
        { id: "x", x: 50, y: 10, w: 100, h: 18 },
        { id: "y", x: 50, y: 10, w: 100, h: 18 },
      ],
      { width: 100, height: 20 },
    );
    expect(crowded.map((p) => p.id)).toEqual(["x"]);
  });
});
