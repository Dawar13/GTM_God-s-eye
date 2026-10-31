/**
 * S10a: WCAG 2.2 AA contrast for every text colour token on every surface it is used on, in
 * both themes. Values are read from src/styles/tokens.css, so a token edit is checked here.
 *
 * Pairs come from the class names in src: text-ink, text-ink-2, text-muted and text-accent
 * (and SVG fill-* / fill="var(--…)" tick labels) sit on bg-canvas, bg-panel, bg-panel-sunk
 * and bg-accent-soft (selected rows, chips, the active rail item); text-positive and
 * text-negative sit on canvas, panel and panel-sunk; the "Conflict" chip is text-negative on
 * bg-negative/10 over a panel; shadcn's default button is primary-foreground (canvas) on
 * primary (ink). Normal-size text needs 4.5:1.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(process.cwd(), "src", "styles", "tokens.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`no ${selector} block in tokens.css`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]!] = m[2]!;
  return out;
}

const THEMES = {
  light: block(':root,\n[data-theme="light"]'),
  dark: block('[data-theme="dark"] {'),
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio, 1 to 21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** `fg` at `alpha` over `bg`, as Tailwind's bg-<token>/10 paints it. */
function over(fg: string, bg: string, alpha: number): string {
  const f = rgb(fg);
  const b = rgb(bg);
  return `#${f
    .map((v, i) =>
      Math.round(v * alpha + b[i]! * (1 - alpha))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const ALL_SURFACES = ["canvas", "panel", "panel-sunk", "accent-soft"] as const;
const PLAIN_SURFACES = ["canvas", "panel", "panel-sunk"] as const;
const PAIRS: [text: string, surfaces: readonly string[]][] = [
  ["ink", ALL_SURFACES],
  ["ink-2", ALL_SURFACES],
  ["muted", ALL_SURFACES],
  ["accent", ALL_SURFACES],
  ["positive", PLAIN_SURFACES],
  ["negative", PLAIN_SURFACES],
];

describe("contrast helpers", () => {
  it("match the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(over("#ff0000", "#ffffff", 0.1)).toBe("#ffe6e6");
  });

  it("read every token from both theme blocks", () => {
    for (const t of Object.values(THEMES)) {
      for (const name of [
        "canvas",
        "panel",
        "panel-sunk",
        "accent-soft",
        "ink",
        "ink-2",
        "muted",
        "accent",
        "positive",
        "negative",
      ]) {
        expect(t[name], name).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe.each(Object.entries(THEMES))("%s theme meets AA (4.5:1) for text", (_, t) => {
  it.each(PAIRS)("text-%s on its surfaces", (text, surfaces) => {
    for (const s of surfaces) {
      const ratio = contrast(t[text]!, t[s]!);
      expect(ratio, `${text} on ${s} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the Conflict chip: negative on negative/10 over a panel", () => {
    const ratio = contrast(t.negative!, over(t.negative!, t.panel!, 0.1));
    expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("the default button: canvas on ink", () => {
    expect(contrast(t.canvas!, t.ink!)).toBeGreaterThanOrEqual(4.5);
  });
});
