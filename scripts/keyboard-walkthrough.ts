/**
 * Keyboard-only walkthrough of the shell (PHASE_2 S1 check).
 * Visits every route in src/lib/nav.ts, tabs through the rail, opens and closes
 * the command palette with Ctrl+K and Esc, opens an entity in the Inspector from
 * the palette and closes it with Esc, and fails on any console error, uncaught
 * exception or failed request.
 *
 * Usage: pnpm exec tsx scripts/keyboard-walkthrough.ts   (dev server on ATLAS_URL, default http://localhost:3000)
 */
import { chromium, type Page } from "@playwright/test";
import { SECTIONS, SECTION_CHILDREN } from "../src/lib/nav";

const base = process.env.ATLAS_URL ?? "http://localhost:3000";
const routes = [
  ...new Set([...SECTIONS.map((s) => s.href), ...Object.values(SECTION_CHILDREN).flat().map((c) => c.href)]),
];

const problems: string[] = [];
let checks = 0;

function check(ok: boolean, what: string) {
  checks++;
  if (!ok) problems.push(what);
}

async function railLinksReachedByTab(page: Page): Promise<number> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const href = await page.evaluate(() => {
      const el = document.activeElement;
      return el instanceof HTMLAnchorElement && el.closest('nav[aria-label="Sections"]')
        ? el.getAttribute("href")
        : null;
    });
    if (href) seen.add(href);
  }
  return seen.size;
}

async function main() {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  let current = "";
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console error on ${current}: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`uncaught exception on ${current}: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} for ${r.url()} on ${current}`);
  });

  for (const route of routes) {
    current = route;
    await page.goto(new URL(route, base).toString(), { waitUntil: "networkidle" });
    check((await page.locator("h1").count()) === 1, `${route}: exactly one h1`);

    // Rail: every link is reachable with Tab, and the arrow keys move between them.
    const reached = await railLinksReachedByTab(page);
    const visible = await page.evaluate(
      () =>
        new Set(
          Array.from(document.querySelectorAll('nav[aria-label="Sections"] a')).map((a) => a.getAttribute("href")),
        ).size,
    );
    check(reached === visible, `${route}: Tab reached ${reached} of ${visible} distinct rail links`);

    const first = page.locator('nav[aria-label="Sections"] a').first();
    await first.focus();
    await page.keyboard.press("ArrowDown");
    const moved = await page.evaluate(
      () => document.activeElement?.closest('nav[aria-label="Sections"]') !== null &&
        document.activeElement !== document.querySelector('nav[aria-label="Sections"] a'),
    );
    check(moved, `${route}: ArrowDown moves focus down the rail`);
  }

  // Palette: open with Ctrl+K, find a tool action, close with Esc.
  current = "/ (palette)";
  await page.goto(new URL("/", base).toString(), { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  check(await page.getByPlaceholder(/Search investors/).evaluate((el) => el === document.activeElement), "palette input is focused on open");
  await page.keyboard.type("safe");
  check(await page.getByRole("option", { name: /Open SAFE calculator/ }).isVisible(), "palette offers 'Open SAFE calculator'");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 5000 });
  check(true, "Esc closes the palette");

  // Names load only after the first open, and open an entity in the Inspector.
  await page.keyboard.press("Control+k");
  await dialog.waitFor({ state: "visible" });
  await page.keyboard.type("sequoia");
  const option = page.getByRole("option").first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await page.keyboard.press("Enter");
  await page.waitForURL(/inspect=inv_/, { timeout: 10000 });
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.waitFor({ state: "visible", timeout: 5000 });
  check((await inspector.locator("h2").innerText()).length > 0, "Inspector shows a name");
  await page.keyboard.press("Escape");
  await inspector.waitFor({ state: "hidden", timeout: 5000 });
  check(!page.url().includes("inspect="), "Esc closes the Inspector and clears the URL");

  // Shortcuts: F toggles the filter bar, [ toggles the rail, / opens the palette.
  await page.locator("body").click({ position: { x: 700, y: 500 } });
  const bar = page.locator("#filter-bar");
  const wasOpen = await bar.isVisible();
  await page.keyboard.press("f");
  check((await bar.isVisible()) !== wasOpen, "F toggles the filter bar");
  await page.keyboard.press("[");
  await page.waitForTimeout(250);
  check((await page.locator("aside").first().boundingBox())?.width === 64, "[ collapses the rail to 64px");
  await page.keyboard.press("[");
  await page.waitForTimeout(250);
  check((await page.locator("aside").first().boundingBox())?.width === 232, "[ expands the rail to 232px");
  await page.keyboard.press("/");
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  await page.keyboard.press("Escape");
  check(true, "/ opens the palette");

  await browser.close();

  if (problems.length > 0) {
    console.error(`Keyboard walkthrough FAILED (${problems.length} problems, ${checks} checks):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`Keyboard walkthrough passed: ${routes.length} routes, ${checks} checks, no console errors.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
