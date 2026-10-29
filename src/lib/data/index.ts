/**
 * Data loaders: the only code that reads data/processed/. Components call
 * these and never import JSON. Today they read files; later they call an API,
 * which is why they are async.
 *
 * Server-only (node:fs). "use cache" lets Cache Components include the result
 * in the static shell; restart `pnpm dev` after re-running the pipeline.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DATASETS,
  datasetOf,
  type Anomaly,
  type Company,
  type Competitor,
  type Dataset,
  type DatasetName,
  type Fund,
  type Investor,
  type Merge,
  type Round,
} from "@/lib/schema";

const DATA_DIR = path.join(process.cwd(), "data", "processed");

async function loadDataset<K extends DatasetName>(name: K): Promise<Dataset<K>> {
  const raw: unknown = JSON.parse(await readFile(path.join(DATA_DIR, `${name}.json`), "utf8"));
  return datasetOf(DATASETS[name]).parse(raw) as Dataset<K>;
}

export async function getInvestors(): Promise<Investor[]> {
  "use cache";
  return (await loadDataset("investors")).records;
}

export async function getFunds(): Promise<Fund[]> {
  "use cache";
  return (await loadDataset("funds")).records;
}

export async function getCompanies(): Promise<Company[]> {
  "use cache";
  return (await loadDataset("companies")).records;
}

export async function getCompetitors(): Promise<Competitor[]> {
  "use cache";
  return (await loadDataset("competitors")).records;
}

export async function getRounds(): Promise<Round[]> {
  "use cache";
  return (await loadDataset("rounds")).records;
}

export async function getAnomalies(): Promise<Anomaly[]> {
  "use cache";
  return (await loadDataset("anomalies")).records;
}

export async function getMerges(): Promise<Merge[]> {
  "use cache";
  return (await loadDataset("merges")).records;
}
