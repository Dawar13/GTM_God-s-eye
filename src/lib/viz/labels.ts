/**
 * Greedy label placement for scatter marks: each label tries the right, left, top and bottom
 * of its mark and takes the first spot that stays inside the plot and overlaps no label or
 * obstacle already placed. Callers pass candidates in priority order. Pure; text width is
 * estimated from the character count so it runs without a DOM (and in tests).
 */

export type Box = { x0: number; y0: number; x1: number; y1: number };

export type LabelCandidate = {
  id: string;
  /** Mark centre and radius in screen pixels. */
  x: number;
  y: number;
  r: number;
  text: string;
  /** Hovered or selected: always drawn, on the right if no free spot exists. */
  force?: boolean;
};

export type PlacedLabel = {
  id: string;
  text: string;
  /** Text anchor point: x, and the baseline y. */
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
  box: Box;
};

export type PlacementOptions = {
  width: number;
  height: number;
  fontSize?: number;
  /** Average glyph width as a share of the font size (IBM Plex Sans Condensed ≈ 0.5). */
  charWidth?: number;
  gap?: number;
  /** Boxes labels must not cover, such as cluster names. */
  obstacles?: readonly Box[];
};

export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Estimated text box size. */
export function textSize(text: string, fontSize: number, charWidth: number) {
  return { w: Math.ceil(text.length * fontSize * charWidth) + 2, h: fontSize + 2 };
}

function spots(c: LabelCandidate, w: number, h: number, fontSize: number, gap: number) {
  const baseline = c.y + fontSize * 0.35;
  const right: PlacedLabel = {
    id: c.id,
    text: c.text,
    x: c.x + c.r + gap,
    y: baseline,
    anchor: "start",
    box: { x0: c.x + c.r + gap, y0: c.y - h / 2, x1: c.x + c.r + gap + w, y1: c.y + h / 2 },
  };
  const left: PlacedLabel = {
    ...right,
    x: c.x - c.r - gap,
    anchor: "end",
    box: { x0: c.x - c.r - gap - w, y0: c.y - h / 2, x1: c.x - c.r - gap, y1: c.y + h / 2 },
  };
  const topY1 = c.y - c.r - gap;
  const top: PlacedLabel = {
    ...right,
    x: c.x,
    y: topY1 - 3,
    anchor: "middle",
    box: { x0: c.x - w / 2, y0: topY1 - h, x1: c.x + w / 2, y1: topY1 },
  };
  const bottomY0 = c.y + c.r + gap;
  const bottom: PlacedLabel = {
    ...right,
    x: c.x,
    y: bottomY0 + h - 3,
    anchor: "middle",
    box: { x0: c.x - w / 2, y0: bottomY0, x1: c.x + w / 2, y1: bottomY0 + h },
  };
  return [right, left, top, bottom];
}

export function placeLabels(
  candidates: readonly LabelCandidate[],
  { width, height, fontSize = 11, charWidth = 0.5, gap = 3, obstacles = [] }: PlacementOptions,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const taken: Box[] = [...obstacles];
  const inside = (b: Box) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= width && b.y1 <= height;
  const ordered = [...candidates.filter((c) => c.force), ...candidates.filter((c) => !c.force)];
  const seen = new Set<string>();
  for (const c of ordered) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    if (c.x < 0 || c.y < 0 || c.x > width || c.y > height) continue; // mark is off screen
    const { w, h } = textSize(c.text, fontSize, charWidth);
    const options = spots(c, w, h, fontSize, gap);
    const free = options.find((o) => inside(o.box) && !taken.some((t) => overlaps(t, o.box)));
    const choice =
      free ?? (c.force ? (options.find((o) => inside(o.box)) ?? options[0]!) : undefined);
    if (!choice) continue;
    placed.push(choice);
    taken.push(choice.box);
  }
  return placed;
}

export type NameCandidate = { id: string; x: number; y: number; w: number; h: number };
export type PlacedName = { id: string; x: number; y: number; box: Box };

/**
 * Names centred on a point, such as cluster names at their centroids, in priority order. Each
 * tries its own spot, then steps of one line above and below it; a name with no free spot
 * inside the plot is dropped. Coordinates are plot pixels; `y` is the name's middle.
 */
export function placeNames(
  candidates: readonly NameCandidate[],
  {
    width,
    height,
    steps = [0, -1, 1, -2, 2],
    gap = 2,
  }: { width: number; height: number; steps?: readonly number[]; gap?: number },
): PlacedName[] {
  const placed: PlacedName[] = [];
  for (const c of candidates) {
    for (const s of steps) {
      const y = c.y + s * (c.h + gap);
      const box = { x0: c.x - c.w / 2, y0: y - c.h / 2, x1: c.x + c.w / 2, y1: y + c.h / 2 };
      const inside = box.x0 >= 0 && box.y0 >= 0 && box.x1 <= width && box.y1 <= height;
      if (inside && !placed.some((p) => overlaps(p.box, box))) {
        placed.push({ id: c.id, x: c.x, y, box });
        break;
      }
    }
  }
  return placed;
}
