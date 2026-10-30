/**
 * Self-audit (PHASE_1 §9.2): sample 30 researched facts with a fixed seed,
 * have each re-checked against its source, and record precision in
 * docs/COVERAGE.md.
 *
 *   pnpm self-audit sample   writes data/research/audit/sample.json (verdicts empty)
 *   pnpm self-audit score    reads the filled-in sample, writes the COVERAGE.md section
 *
 * A checker re-opens each fact's sources and sets `verdict` to correct | wrong |
 * unverifiable (no source loads) with a short `note`. Precision is
 * correct / (correct + wrong); unverifiable facts are reported, not counted.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getBenchmarks,
  getCompanies,
  getCompetitors,
  getFunds,
  getInvestors,
  getLegalNotes,
  getPartners,
  getRounds,
} from "../src/lib/data/index";
import { mulberry32 } from "../src/lib/finance";
import type { FieldSources, Source } from "../src/lib/schema";

const SEED = 20261030;
const SAMPLE = path.join(process.cwd(), "data", "research", "audit", "sample.json");
const COVERAGE = path.join(process.cwd(), "docs", "COVERAGE.md");
const AUDIT_START = "<!-- self-audit -->";
const TARGET_PRECISION = 0.95;

/** Facts per record type; 30 in all. */
const STRATA = {
  round: 9,
  investor: 7,
  fund: 5,
  partner: 3,
  company: 3,
  benchmark: 2,
  legal_note: 1,
} as const;
type Kind = keyof typeof STRATA;

type Verdict = "correct" | "wrong" | "unverifiable";

interface Fact {
  n: number;
  kind: Kind;
  record_id: string;
  record_name: string;
  field: string;
  value: unknown;
  sources: { url: string; title: string | null }[];
  verdict: Verdict | null;
  note: string | null;
}

type Candidate = Omit<Fact, "n" | "verdict" | "note">;

interface Sourced {
  sources: Source[];
  field_sources?: FieldSources;
}

/** The web sources behind a field: its cited sources, else every web source on the record. */
function webSources(record: Sourced, field: string): Candidate["sources"] {
  const cited = record.field_sources?.[field];
  const pool = cited?.length ? cited.map((i) => record.sources[i]!) : record.sources;
  return pool
    .filter((s) => s.kind !== "user_supplied" && s.url.startsWith("http"))
    .map((s) => ({ url: s.url, title: s.title }));
}

const present = (v: unknown) =>
  v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);

function facts(
  kind: Kind,
  record: Sourced & { id: string },
  name: string,
  fields: [field: string, value: unknown, citedAs?: string][],
): Candidate[] {
  return fields
    .filter(([, value]) => present(value))
    .map(([field, value, citedAs]) => ({
      kind,
      record_id: record.id,
      record_name: name,
      field,
      value,
      sources: webSources(record, citedAs ?? field),
    }))
    .filter((f) => f.sources.length > 0);
}

async function candidates(): Promise<Record<Kind, Candidate[]>> {
  const [investors, funds, rounds, partners, companies, competitors, benchmarks, legal] =
    await Promise.all([
      getInvestors(),
      getFunds(),
      getRounds(),
      getPartners(),
      getCompanies(),
      getCompetitors(),
      getBenchmarks(),
      getLegalNotes(),
    ]);
  const investorName = new Map(investors.map((i) => [i.id, i.name]));
  const companyName = new Map([...companies, ...competitors].map((c) => [c.id, c.name]));

  return {
    investor: investors.flatMap((i) =>
      facts("investor", i, i.name, [
        ["type", i.type],
        ["website", i.website],
        ["hq_city", i.hq_city],
        ["hq_country", i.hq_country],
        ["stages", i.stages],
        ["check_min_usd", i.check_min_usd],
        ["check_max_usd", i.check_max_usd],
        ["leads", i.leads],
        ["portfolio_count_reported", i.portfolio_count_reported],
      ]),
    ),
    fund: funds.flatMap((f) =>
      facts("fund", f, `${investorName.get(f.investor_id) ?? f.investor_id} — ${f.name}`, [
        [
          "size",
          f.size_original === null ? null : `${f.size_original} ${f.currency_original}`,
          "size_usd",
        ],
        ["close_date", f.close_date],
      ]),
    ),
    round: rounds.flatMap((r) =>
      facts(
        "round",
        r,
        `${companyName.get(r.company_id) ?? r.company_id} ${r.stage} ${r.date ?? ""}`.trim(),
        [
          [
            "amount",
            r.amount_original === null ? null : `${r.amount_original} ${r.currency_original}`,
            "amount_usd",
          ],
          ["date", r.date],
          [
            "lead investors",
            r.lead_investor_ids.map((id) => investorName.get(id) ?? id),
            "investors",
          ],
        ],
      ),
    ),
    partner: partners.flatMap((p) =>
      facts("partner", p, `${p.name} (${investorName.get(p.investor_id) ?? p.investor_id})`, [
        ["title", p.title],
      ]),
    ),
    company: [...companies, ...competitors].flatMap((c) =>
      facts("company", c, c.name, [
        ["website", c.website],
        ["hq_country", c.hq_country],
        ["founded_year", c.founded_year],
      ]),
    ),
    benchmark: benchmarks.flatMap((b) =>
      facts("benchmark", b, b.id, [["value", `${b.value} ${b.unit} (${b.metric}, ${b.period})`]]),
    ),
    legal_note: legal.flatMap((l) =>
      facts("legal_note", l, l.title ?? l.id, [
        ["summary", l.summary],
        ["effective_date", l.effective_date],
      ]),
    ),
  };
}

/** Fisher–Yates with the seeded generator, so the sample is reproducible. */
function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

async function sample() {
  const pools = await candidates();
  const rand = mulberry32(SEED);
  const picked: Fact[] = [];
  for (const kind of Object.keys(STRATA) as Kind[]) {
    // One fact per record, so a single well-researched firm can't fill a stratum.
    const seen = new Set<string>();
    for (const c of shuffle(pools[kind], rand)) {
      if (seen.size === STRATA[kind]) break;
      if (seen.has(c.record_id)) continue;
      seen.add(c.record_id);
      picked.push({ ...c, n: picked.length + 1, verdict: null, note: null });
    }
  }
  await mkdir(path.dirname(SAMPLE), { recursive: true });
  const doc = { seed: SEED, generated_at: new Date().toISOString().slice(0, 10), facts: picked };
  await writeFile(SAMPLE, JSON.stringify(doc, null, 2) + "\n");
  console.log(
    `self-audit: sampled ${picked.length} facts → ${path.relative(process.cwd(), SAMPLE)}`,
  );
}

const show = (v: unknown) =>
  (Array.isArray(v) ? v.join(", ") : String(v)).replaceAll("|", "\\|").replaceAll("\n", " ");

async function score() {
  const doc = JSON.parse(await readFile(SAMPLE, "utf8")) as {
    seed: number;
    generated_at: string;
    checked_at?: string;
    facts: Fact[];
  };
  const missing = doc.facts.filter((f) => f.verdict === null).map((f) => f.n);
  if (missing.length) throw new Error(`facts without a verdict: ${missing.join(", ")}`);
  const count = (v: Verdict) => doc.facts.filter((f) => f.verdict === v).length;
  const [correct, wrong, unverifiable] = [count("correct"), count("wrong"), count("unverifiable")];
  const precision = correct / (correct + wrong);
  const lines = [
    AUDIT_START,
    "## Self-audit",
    "",
    `${doc.facts.length} facts sampled with seed ${doc.seed} on ${doc.generated_at}` +
      (doc.checked_at ? `, re-checked against their sources on ${doc.checked_at}` : "") +
      ` (\`data/research/audit/sample.json\`).`,
    "",
    `**Precision ${(100 * precision).toFixed(1)}%** (${correct} correct, ${wrong} wrong; ` +
      `${unverifiable} unverifiable, not counted). Target ≥ ${100 * TARGET_PRECISION}%: ` +
      (precision >= TARGET_PRECISION ? "met." : "**not met**."),
    "",
    "| # | Type | Record | Field | Value | Verdict | Note |",
    "|---|---|---|---|---|---|---|",
    ...doc.facts.map(
      (f) =>
        `| ${f.n} | ${f.kind} | ${show(f.record_name)} | ${f.field} | ${show(f.value).slice(0, 120)} | ${f.verdict} | ${show(f.note ?? "")} |`,
    ),
    "",
  ];
  const previous = await readFile(COVERAGE, "utf8");
  const at = previous.indexOf(AUDIT_START);
  const head = at >= 0 ? previous.slice(0, at) : previous + "\n";
  await writeFile(COVERAGE, head + lines.join("\n"));
  console.log(`self-audit: precision ${(100 * precision).toFixed(1)}% → docs/COVERAGE.md`);
}

const mode = process.argv[2];
(mode === "sample"
  ? sample()
  : mode === "score"
    ? score()
    : Promise.reject(new Error("usage: self-audit sample|score"))
).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
