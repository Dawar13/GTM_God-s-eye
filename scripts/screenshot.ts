/**
 * Screenshot one route of the running dev server.
 * Usage: pnpm exec tsx scripts/screenshot.ts <route> <out.png> [width] [height] [--viewport-only] [--wait=ms]
 * Git Bash rewrites a leading "/" in arguments; prefix the command with MSYS_NO_PATHCONV=1.
 * Example: MSYS_NO_PATHCONV=1 pnpm exec tsx scripts/screenshot.ts /lab docs/screens/s0-lab.png 1440 900
 * Base URL comes from ATLAS_URL (default http://localhost:3000).
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const viewportOnly = process.argv.includes("--viewport-only");
const waitArg = process.argv.find((a) => a.startsWith("--wait="));
const extraWaitMs = waitArg ? Number(waitArg.slice(7)) : 0;
const [route, out, w = "1440", h = "900"] = args;

if (!route || !out) {
  console.error(
    "Usage: tsx scripts/screenshot.ts <route> <out.png> [width] [height] [--viewport-only]",
  );
  process.exit(1);
}

async function main() {
  const base = process.env.ATLAS_URL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
    await page.goto(new URL(String(route), base).toString(), { waitUntil: "networkidle" });
    if (extraWaitMs > 0) await page.waitForTimeout(extraWaitMs);
    mkdirSync(dirname(String(out)), { recursive: true });
    await page.screenshot({ path: out, fullPage: !viewportOnly });
    console.log(`Saved ${out} (${w}x${h}${viewportOnly ? "" : ", full page"})`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
