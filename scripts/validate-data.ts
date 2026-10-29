/**
 * Validates every file in data/processed/ against the Zod schemas, then checks
 * referential integrity across files. Exits non-zero with a readable report.
 *
 *   pnpm validate:data
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  DATASETS,
  DATASET_NAMES,
  DOCUMENTS,
  DOCUMENT_NAMES,
  checkDocuments,
  checkIntegrity,
  datasetOf,
  type AllRecords,
  type DatasetName,
} from "../src/lib/schema/index";

const DATA_DIR = path.join(process.cwd(), "data", "processed");
const MAX_ISSUES_PER_FILE = 25;

type Problem = { file: string; where: string; message: string };

function describePath(records: unknown, issuePath: PropertyKey[]): string {
  const [head, index, ...rest] = issuePath;
  if (head !== "records" || typeof index !== "number") return issuePath.join(".") || "(file)";
  const record = Array.isArray(records) ? (records[index] as { id?: unknown }) : undefined;
  const label = typeof record?.id === "string" ? record.id : `records[${index}]`;
  return rest.length ? `${label} → ${rest.join(".")}` : label;
}

async function main() {
  const problems: Problem[] = [];
  const present = new Set(
    (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)),
  );

  for (const name of present) {
    if (!(name in DATASETS) && !(name in DOCUMENTS)) {
      problems.push({ file: `${name}.json`, where: "(file)", message: "not a known dataset" });
    }
  }

  const parsed: Partial<Record<DatasetName, unknown[]>> = {};
  const counts: string[] = [];

  for (const name of DATASET_NAMES) {
    const file = `${name}.json`;
    if (!present.has(name)) {
      problems.push({ file, where: "(file)", message: "missing; the pipeline must write it" });
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"));
    } catch (e) {
      problems.push({ file, where: "(file)", message: `not valid JSON: ${(e as Error).message}` });
      continue;
    }
    const result = datasetOf(DATASETS[name]).safeParse(raw);
    if (!result.success) {
      const records = (raw as { records?: unknown }).records;
      const fileIssues = result.error.issues;
      for (const issue of fileIssues.slice(0, MAX_ISSUES_PER_FILE)) {
        problems.push({ file, where: describePath(records, issue.path), message: issue.message });
      }
      if (fileIssues.length > MAX_ISSUES_PER_FILE) {
        problems.push({
          file,
          where: "…",
          message: `${fileIssues.length - MAX_ISSUES_PER_FILE} more issues not shown`,
        });
      }
      continue;
    }
    parsed[name] = result.data.records;
    counts.push(`${name} ${result.data.records.length}`);
  }

  // Analytics documents (graph, competitor overlap): optional until the analytics run.
  const docs: Record<string, unknown> = {};
  for (const name of DOCUMENT_NAMES) {
    const file = `${name}.json`;
    if (!present.has(name)) continue;
    const raw: unknown = JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"));
    const result = DOCUMENTS[name].safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues.slice(0, MAX_ISSUES_PER_FILE))
        problems.push({ file, where: issue.path.join(".") || "(file)", message: issue.message });
      continue;
    }
    docs[name] = result.data;
    counts.push(`${name} ✓`);
  }

  // Cross-file checks only make sense once every file parsed.
  if (DATASET_NAMES.every((n) => parsed[n])) {
    for (const issue of [
      ...checkIntegrity(parsed as AllRecords),
      ...checkDocuments(parsed as AllRecords, docs),
    ]) {
      problems.push({ file: `${issue.dataset}.json`, where: issue.id, message: issue.message });
    }
  }

  if (problems.length) {
    console.error(`\nvalidate:data found ${problems.length} problem(s)\n`);
    let lastFile = "";
    for (const p of problems) {
      if (p.file !== lastFile) console.error(`  ${p.file}`);
      lastFile = p.file;
      console.error(`    ${p.where}: ${p.message}`);
    }
    console.error("");
    process.exit(1);
  }

  console.log(`validate:data ok — ${counts.join(", ")}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof z.ZodError ? z.prettifyError(e) : e);
  process.exit(1);
});
