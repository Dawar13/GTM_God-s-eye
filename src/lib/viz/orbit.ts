/**
 * Pure turntable camera math for the 3D bubbles' touch gestures: the camera orbits the
 * scene centre with z always up, so it can never tip over.
 */
import { clampZoom } from "./zoom";

export type Vec3 = { x: number; y: number; z: number };
/** Azimuth around z and elevation above the xy plane, in radians; distance from the centre. */
export type Orbit = { azimuth: number; elevation: number; distance: number };

export const UP_Z: Vec3 = { x: 0, y: 0, z: 1 };
const DEG = Math.PI / 180;
export const ELEVATION_MIN = 5 * DEG;
export const ELEVATION_MAX = 85 * DEG;

export const clampElevation = (el: number): number =>
  Math.min(ELEVATION_MAX, Math.max(ELEVATION_MIN, el));

/**
 * The orbit of a camera eye. Straight above or below the centre the azimuth is undefined,
 * so it is taken from the up vector (the screen's up points away from the camera).
 */
export function orbitFromEye(eye: Vec3, up: Vec3 = UP_Z): Orbit {
  const distance = Math.hypot(eye.x, eye.y, eye.z);
  const flat = Math.hypot(eye.x, eye.y);
  const azimuth =
    flat > 1e-9
      ? Math.atan2(eye.y, eye.x)
      : Math.hypot(up.x, up.y) > 1e-9
        ? Math.atan2(-up.y, -up.x)
        : -Math.PI / 2;
  return { azimuth, elevation: Math.atan2(eye.z, flat), distance };
}

export function eyeFromOrbit({ azimuth, elevation, distance }: Orbit): Vec3 {
  const flat = distance * Math.cos(elevation);
  return {
    x: flat * Math.cos(azimuth),
    y: flat * Math.sin(azimuth),
    z: distance * Math.sin(elevation),
  };
}

/**
 * Turntable rotation from a drag of (dx, dy) screen pixels: right turns the scene with the
 * fingers, down raises the camera. Elevation is clamped; the distance is unchanged.
 */
export function dragOrbit(o: Orbit, dx: number, dy: number, radPerPx: number): Orbit {
  return {
    azimuth: o.azimuth - dx * radPerPx,
    elevation: clampElevation(o.elevation + dy * radPerPx),
    distance: o.distance,
  };
}

/** Zoom level after a pinch: the start level times the finger-span ratio, clamped. */
export function pinchLevel(
  startLevel: number,
  startSpan: number,
  span: number,
  min: number,
  max: number,
): number {
  if (!(startSpan > 0) || !(span > 0)) return clampZoom(startLevel, min, max);
  return clampZoom(startLevel * (span / startSpan), min, max);
}

/** The eye moved along its own direction to `distance` from the centre. */
export function eyeAtDistance(eye: Vec3, distance: number): Vec3 {
  const n = Math.hypot(eye.x, eye.y, eye.z);
  if (!(n > 0)) return eye;
  const f = distance / n;
  return { x: eye.x * f, y: eye.y * f, z: eye.z * f };
}

/** The Plotly scene camera for an orbit: centred, with z up whatever the drag did. */
export function orbitCamera(o: Orbit): { eye: Vec3; up: Vec3; center: Vec3 } {
  return { eye: eyeFromOrbit(o), up: { ...UP_Z }, center: { x: 0, y: 0, z: 0 } };
}
