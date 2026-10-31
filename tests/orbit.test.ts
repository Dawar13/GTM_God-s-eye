import { describe, expect, it } from "vitest";
import {
  ELEVATION_MAX,
  ELEVATION_MIN,
  UP_Z,
  dragOrbit,
  eyeAtDistance,
  eyeFromOrbit,
  orbitCamera,
  orbitFromEye,
  pinchLevel,
} from "@/lib/viz/orbit";

const norm = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

describe("orbit math", () => {
  it("round-trips an eye through azimuth, elevation and distance", () => {
    const eye = { x: 1.45, y: -1.45, z: 0.9 };
    const back = eyeFromOrbit(orbitFromEye(eye));
    expect(back.x).toBeCloseTo(eye.x);
    expect(back.y).toBeCloseTo(eye.y);
    expect(back.z).toBeCloseTo(eye.z);
  });

  it("takes the azimuth from the up vector when looking straight down", () => {
    const o = orbitFromEye({ x: 0, y: 0, z: 2.3 }, { x: 0, y: 1, z: 0 });
    expect(o.azimuth).toBeCloseTo(-Math.PI / 2);
    expect(o.elevation).toBeCloseTo(Math.PI / 2);
  });

  it("pinch scales the zoom level by the span ratio, clamped", () => {
    expect(pinchLevel(1, 100, 200, 0.4, 6)).toBeCloseTo(2);
    expect(pinchLevel(2, 200, 100, 0.4, 6)).toBeCloseTo(1);
    expect(pinchLevel(1, 10, 1000, 0.4, 6)).toBe(6);
    expect(pinchLevel(1, 1000, 10, 0.4, 6)).toBe(0.4);
    expect(pinchLevel(1.5, 0, 100, 0.4, 6)).toBe(1.5);
  });

  it("elevation never passes the clamp, so the camera cannot flip", () => {
    const start = orbitFromEye({ x: 1.45, y: -1.45, z: 0.9 });
    for (const dy of [-1e6, -5000, -300, 300, 5000, 1e6]) {
      const o = dragOrbit(start, 0, dy, 0.01);
      expect(o.elevation).toBeGreaterThanOrEqual(ELEVATION_MIN);
      expect(o.elevation).toBeLessThanOrEqual(ELEVATION_MAX);
      expect(eyeFromOrbit(o).z).toBeGreaterThan(0);
    }
    // Starting above the clamp (the top preset) is pulled back inside it.
    const top = orbitFromEye({ x: 0, y: 0, z: 2.3 }, { x: 0, y: 1, z: 0 });
    expect(dragOrbit(top, 0, 50, 0.01).elevation).toBeCloseTo(ELEVATION_MAX);
  });

  it("drag keeps the distance and the up vector unchanged", () => {
    const start = orbitFromEye({ x: 1.45, y: -1.45, z: 0.9 });
    const o = dragOrbit(start, 120, -80, 0.01);
    expect(norm(eyeFromOrbit(o))).toBeCloseTo(norm({ x: 1.45, y: -1.45, z: 0.9 }));
    expect(o.azimuth).toBeCloseTo(start.azimuth - 1.2);
    for (const [dx, dy] of [[0, 0], [400, -900], [-250, 2000]] as const) {
      expect(orbitCamera(dragOrbit(start, dx, dy, 0.01)).up).toEqual(UP_Z);
    }
    expect(UP_Z).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("moves the eye along its direction to a new distance", () => {
    const eye = eyeAtDistance({ x: 3, y: 0, z: 4 }, 10);
    expect(eye).toEqual({ x: 6, y: 0, z: 8 });
    expect(eyeAtDistance({ x: 0, y: 0, z: 0 }, 2)).toEqual({ x: 0, y: 0, z: 0 });
  });
});
