import { z } from "zod";
import { Company, Competitor } from "./company";
import { Fund } from "./fund";
import { Investor } from "./investor";
import { Anomaly, Merge } from "./review";
import { Round } from "./round";

/** Bump when a processed file's shape changes in a way old files won't parse. */
export const SCHEMA_VERSION = 1;

export function datasetOf<T extends z.ZodType>(record: T) {
  return z.strictObject({
    version: z.literal(SCHEMA_VERSION),
    generated_at: z.iso.datetime({ offset: true }).describe("When the pipeline wrote the file"),
    records: z.array(record),
  });
}

/** Every file in data/processed/ and the record schema it holds. */
export const DATASETS = {
  investors: Investor,
  funds: Fund,
  companies: Company,
  competitors: Competitor,
  rounds: Round,
  anomalies: Anomaly,
  merges: Merge,
} as const;

export type DatasetName = keyof typeof DATASETS;
export const DATASET_NAMES = Object.keys(DATASETS) as DatasetName[];

export type DatasetRecord<K extends DatasetName> = z.infer<(typeof DATASETS)[K]>;
export type Dataset<K extends DatasetName> = {
  version: typeof SCHEMA_VERSION;
  generated_at: string;
  records: DatasetRecord<K>[];
};
