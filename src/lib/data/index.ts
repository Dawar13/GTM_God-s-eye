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
import type { z } from "zod";
import {
  DATASETS,
  DOCUMENTS,
  datasetOf,
  type CompetitorOverlapDocument,
  type DatasetRecord,
  type DocumentName,
  type GraphDocument,
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

export async function getPartners(): Promise<DatasetRecord<"partners">[]> {
  "use cache";
  return (await loadDataset("partners")).records;
}

export async function getBenchmarks(): Promise<DatasetRecord<"benchmarks">[]> {
  "use cache";
  return (await loadDataset("benchmarks")).records;
}

export async function getLegalNotes(): Promise<DatasetRecord<"legal_notes">[]> {
  "use cache";
  return (await loadDataset("legal_notes")).records;
}

export async function getFitFeatures(): Promise<DatasetRecord<"fit_features">[]> {
  "use cache";
  return (await loadDataset("fit_features")).records;
}

export async function getThesisLayout(): Promise<DatasetRecord<"layout_thesis">[]> {
  "use cache";
  return (await loadDataset("layout_thesis")).records;
}

export async function getClusters(): Promise<DatasetRecord<"clusters">[]> {
  "use cache";
  return (await loadDataset("clusters")).records;
}

export async function getBubbleLayout(): Promise<DatasetRecord<"layout_bubbles">[]> {
  "use cache";
  return (await loadDataset("layout_bubbles")).records;
}

async function loadDocument<K extends DocumentName>(name: K): Promise<z.infer<(typeof DOCUMENTS)[K]>> {
  const raw: unknown = JSON.parse(await readFile(path.join(DATA_DIR, `${name}.json`), "utf8"));
  return DOCUMENTS[name].parse(raw) as z.infer<(typeof DOCUMENTS)[K]>;
}

export async function getGraph(): Promise<GraphDocument> {
  "use cache";
  return loadDocument("graph");
}

export async function getCompetitorOverlap(): Promise<CompetitorOverlapDocument> {
  "use cache";
  return loadDocument("competitor_overlap");
}
