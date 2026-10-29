import { z } from "zod";
import { InvestorId, idOf } from "./common";

/** A source row the pipeline flagged instead of silently fixing. */
export const Anomaly = z
  .strictObject({
    id: idOf("anom"),
    source_id: z.string().describe("Source list, e.g. goldman_sub200m_funds"),
    row_ref: z.string().describe("Row index or name in the source"),
    field: z.string().describe("Column the problem is in"),
    raw_value: z.string().nullable(),
    reason: z.string().describe("What looks wrong"),
    resolution: z.string().nullable().describe("What the pipeline did instead, if anything"),
  })
  .describe("Flagged problem in a source; for human review");
export type Anomaly = z.infer<typeof Anomaly>;

export const MERGE_METHODS = ["normalised_name", "fuzzy", "alias"] as const;

/** Two differently written names the pipeline treated as one investor. */
export const Merge = z
  .strictObject({
    id: idOf("merge"),
    investor_id: InvestorId,
    kept_name: z.string(),
    merged_name: z.string(),
    method: z.enum(MERGE_METHODS),
    score: z.number().min(0).max(100).nullable().describe("rapidfuzz score for fuzzy merges"),
    source_ids: z.array(z.string()).describe("Lists the merged name came from"),
  })
  .describe("Name merge; every one is logged for review");
export type Merge = z.infer<typeof Merge>;
