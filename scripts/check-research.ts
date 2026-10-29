/**
 * Validates research files against the Zod research schemas.
 *
 *   pnpm research:check                      # every file in data/research/cache
 *   pnpm research:check data/research/cache/root-ventures.json
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CompetitorResearch, InvestorResearch, RoundResearch } from "../src/lib/schema/research";
import { Benchmark, LegalNote } from "../src/lib/schema/reference";

const CACHE = path.join(process.cwd(), "data", "research", "cache");

const BY_TYPE: Record<string, z.ZodType> = {
  investor: InvestorResearch,
  competitor: CompetitorResearch,
  round: RoundResearch,
};

function schemaFor(file: string, raw: unknown): z.ZodType | null {
  const base = path.basename(file);
  if (base === "benchmarks.json") return z.array(Benchmark);
  if (base === "legal_notes.json") return z.array(LegalNote);
  const type = (raw as { entity_type?: string }).entity_type;
  return type ? (BY_TYPE[type] ?? null) : null;
}

/** Page indexes used by facts, rounds, funds and partners must exist. */
function pageIndexProblems(raw: Record<string, unknown>): string[] {
  const pages = Array.isArray(raw.pages) ? raw.pages.length : 0;
  const problems: string[] = [];
  const walk = (value: unknown, at: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${at}[${i}]`));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (k === "pages" && at !== "") {
          for (const i of v as number[])
            if (i >= pages) problems.push(`${at}.pages → ${i} (only ${pages} pages)`);
        } else if (k !== "pages") walk(v, at ? `${at}.${k}` : k);
      }
    }
  };
  walk(raw, "");
  return problems;
}

async function check(file: string): Promise<string[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    return [`not valid JSON: ${(e as Error).message}`];
  }
  const schema = schemaFor(file, raw);
  if (!schema) return ["unknown entity_type"];
  const result = schema.safeParse(raw);
  const problems = result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  if (!Array.isArray(raw)) problems.push(...pageIndexProblems(raw as Record<string, unknown>));
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length
    ? args
    : (await readdir(CACHE)).filter((f) => f.endsWith(".json")).map((f) => path.join(CACHE, f));
  let bad = 0;
  for (const file of files) {
    const problems = await check(file);
    if (problems.length) {
      bad++;
      console.error(`✗ ${path.relative(process.cwd(), file)}`);
      for (const p of problems.slice(0, 30)) console.error(`    ${p}`);
    }
  }
  console.log(`research:check — ${files.length - bad} ok, ${bad} with problems`);
  process.exit(bad ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
