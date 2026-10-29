/**
 * Writes JSON Schema for every processed dataset (data/schemas/) and the data
 * dictionary (docs/DATA_DICTIONARY.md) from the Zod schemas. The Python
 * pipeline validates its output against these files.
 *
 *   pnpm gen:schema
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import * as S from "../src/lib/schema/index";

type JsonSchema = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  enum?: unknown[];
  const?: unknown;
  format?: string;
  pattern?: string;
  propertyNames?: JsonSchema;
  additionalProperties?: JsonSchema | boolean;
  minItems?: number;
};

const ROOT = process.cwd();
const SCHEMA_DIR = path.join(ROOT, "data", "schemas");

const toJson = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { target: "draft-2020-12" }) as JsonSchema;

const ENUMS = {
  Sector: S.SECTORS,
  InvestorStage: S.INVESTOR_STAGES,
  RoundStage: S.ROUND_STAGES,
  InvestorType: S.INVESTOR_TYPES,
  Region: S.REGIONS,
  Confidence: S.CONFIDENCE_LEVELS,
  SourceKind: S.SOURCE_KINDS,
  Freshness: S.FRESHNESS,
  Maturity: S.MATURITY,
  DatePrecision: S.DATE_PRECISION,
  CompetitorCategory: S.COMPETITOR_CATEGORIES,
  CompetitorLayer: S.COMPETITOR_LAYERS,
  SizeClass: S.SIZE_CLASSES,
  RevenueBasis: S.REVENUE_BASIS,
  InvestorFlag: S.INVESTOR_FLAGS,
  FitFlag: S.FIT_FLAGS,
  YesNoUnknown: S.YES_NO_UNKNOWN,
  ResearchTier: S.RESEARCH_TIERS,
  SectorClassifiedBy: S.SECTOR_CLASSIFIED_BY,
  BenchmarkMetric: S.BENCHMARK_METRICS,
  BenchmarkUnit: S.BENCHMARK_UNITS,
  Geography: S.GEOGRAPHIES,
  LegalTopic: S.LEGAL_TOPICS,
  Jurisdiction: S.JURISDICTIONS,
} as const;

/** Nested objects documented once under their own name. */
const NAMED_OBJECTS = new Map<string | undefined, string>([
  [S.Source.description, "Source"],
  [S.InvestorCategory.description, "InvestorCategory"],
  [S.SeedHint.description, "SeedHint"],
]);

const RECORDS: [string, z.ZodType, string][] = [
  ["Investor", S.Investor, "investors.json"],
  ["Partner", S.Partner, "partners.json"],
  ["Fund", S.Fund, "funds.json"],
  ["Company", S.Company, "companies.json"],
  ["Competitor", S.Competitor, "competitors.json"],
  ["Round", S.Round, "rounds.json"],
  ["Benchmark", S.Benchmark, "benchmarks.json"],
  ["LegalNote", S.LegalNote, "legal_notes.json"],
  ["FitFeatures", S.FitFeatures, "fit_features.json"],
  ["Anomaly", S.Anomaly, "anomalies.json"],
  ["Merge", S.Merge, "merges.json"],
];

function typeLabel(s: JsonSchema, sections: Map<string, JsonSchema>, at: string): string {
  if (s.anyOf) {
    const parts = s.anyOf.map((p) => typeLabel(p, sections, at));
    return parts.join(" \\| ");
  }
  if (s.enum) return s.enum.map((v) => `\`${String(v)}\``).join(", ");
  if (s.const !== undefined) return `\`${JSON.stringify(s.const)}\``;
  if (s.type === "array" && s.items) {
    const inner = typeLabel(s.items, sections, `${at}[]`);
    return `array of ${inner}${s.minItems ? ` (min ${s.minItems})` : ""}`;
  }
  if (s.type === "object" && s.properties) {
    const name = NAMED_OBJECTS.get(s.description) ?? at;
    if (!sections.has(name)) sections.set(name, s);
    return `[${name}](#${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")})`;
  }
  if (s.type === "object" && s.propertyNames?.enum) return "map of Sector → number";
  if (s.type === "string" && s.format) return `string (${s.format})`;
  if (s.type === "string" && s.pattern) return "string (pattern)";
  return Array.isArray(s.type) ? s.type.join(" \\| ") : (s.type ?? "any");
}

function tableFor(name: string, s: JsonSchema, sections: Map<string, JsonSchema>): string {
  const required = new Set(s.required ?? []);
  const rows = Object.entries(s.properties ?? {}).map(([field, prop]) => {
    const desc = (
      prop.description ??
      prop.anyOf?.find((p) => p.description)?.description ??
      ""
    ).replace(/\|/g, "\\|");
    return `| \`${field}\` | ${typeLabel(prop, sections, `${name}.${field}`)} | ${required.has(field) ? "yes" : "no"} | ${desc} |`;
  });
  return ["| Field | Type | Required | Description |", "|---|---|---|---|", ...rows].join("\n");
}

function dictionary(): string {
  const out: string[] = [
    "# Data dictionary",
    "",
    "Generated from the Zod schemas in `src/lib/schema/` by `pnpm gen:schema`. Do not edit by hand.",
    "",
    "Every file in `data/processed/` is a dataset: `{ version, generated_at, records: [...] }`.",
    `Current schema version: ${S.SCHEMA_VERSION}. Nullable fields are written as \`null\` when unknown; the UI shows "—".`,
    "",
  ];
  const sections = new Map<string, JsonSchema>();

  for (const [name, schema, file] of RECORDS) {
    const json = toJson(schema);
    out.push(`## ${name}`, "", `File: \`data/processed/${file}\`. ${json.description ?? ""}`, "");
    out.push(tableFor(name, json, sections), "");
  }

  // Nested objects discovered while rendering the records (may discover more).
  const done = new Set<string>();
  while ([...sections.keys()].some((k) => !done.has(k))) {
    for (const [name, json] of [...sections]) {
      if (done.has(name)) continue;
      done.add(name);
      out.push(`## ${name}`, "", json.description ?? "", "", tableFor(name, json, sections), "");
    }
  }

  out.push("## Enums", "");
  for (const [name, values] of Object.entries(ENUMS)) {
    out.push(`- **${name}**: ${values.map((v) => `\`${v}\``).join(", ")}`);
  }
  out.push("");
  return out.join("\n");
}

async function main() {
  await mkdir(SCHEMA_DIR, { recursive: true });

  for (const name of S.DATASET_NAMES) {
    const schema = {
      $id: `capital-atlas/${name}.schema.json`,
      ...toJson(S.datasetOf(S.DATASETS[name])),
    };
    await writeFile(
      path.join(SCHEMA_DIR, `${name}.schema.json`),
      JSON.stringify(schema, null, 2) + "\n",
    );
  }

  const enums = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "capital-atlas/enums.schema.json",
    $defs: Object.fromEntries(Object.entries(ENUMS).map(([k, v]) => [k, { enum: [...v] }])),
  };
  await writeFile(
    path.join(SCHEMA_DIR, "enums.schema.json"),
    JSON.stringify(enums, null, 2) + "\n",
  );

  // Research inputs (data/research/), validated by the pipeline before merging.
  const research: [string, z.ZodType][] = [
    ["research_investor", S.InvestorResearch],
    ["research_competitor", S.CompetitorResearch],
    ["research_round", S.RoundResearch],
    ["research_queue", S.ResearchQueue],
    ["research_benchmarks", z.array(S.Benchmark)],
    ["research_legal_notes", z.array(S.LegalNote)],
  ];
  for (const [name, schema] of research) {
    await writeFile(
      path.join(SCHEMA_DIR, `${name}.schema.json`),
      JSON.stringify({ $id: `capital-atlas/${name}.schema.json`, ...toJson(schema) }, null, 2) +
        "\n",
    );
  }

  await writeFile(path.join(ROOT, "docs", "DATA_DICTIONARY.md"), dictionary());
  console.log(
    `gen:schema wrote ${S.DATASET_NAMES.length + research.length + 1} schemas and docs/DATA_DICTIONARY.md`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
