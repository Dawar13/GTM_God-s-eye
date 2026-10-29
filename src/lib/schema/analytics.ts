import { z } from "zod";
import { RoundStage, Sector } from "./enums";
import { CompanyId, InvestorId, RoundId, Usd } from "./common";
import { SCHEMA_VERSION } from "./version";

/** Analytics outputs written by pipeline/atlas/analyze/ (PHASE_1 §8). */

export const ThesisPoint = z
  .strictObject({
    id: InvestorId,
    x: z.number(),
    y: z.number(),
    cluster_id: z.number().int().nonnegative().nullable(),
    is_generalist: z.boolean(),
  })
  .describe("Thesis map position (UMAP, PCA fallback) and cluster");
export type ThesisPoint = z.infer<typeof ThesisPoint>;

export const Cluster = z
  .strictObject({
    id: z.string().regex(/^cl_\d+$/),
    index: z.number().int().nonnegative(),
    name: z.string().describe("From the centroid's top three sectors"),
    size: z.number().int().nonnegative(),
    top_sectors: z.array(z.strictObject({ sector: Sector, weight: z.number() })),
  })
  .describe("A k-means thesis cluster");
export type Cluster = z.infer<typeof Cluster>;

export const BubblePoint = z
  .strictObject({
    id: InvestorId,
    typical_check_usd: Usd.nullable().describe("Geometric mean of check min and max"),
    stage_earliness: z.number().min(0).max(1).nullable(),
    industrial_affinity: z.number().min(0).max(1).nullable(),
    latest_fund_usd: Usd.nullable(),
    colour_key: z.string().nullable().describe("Cluster id"),
  })
  .describe("Capital bubbles axes: x = check (log), y = earliness, z = affinity, size = fund");
export type BubblePoint = z.infer<typeof BubblePoint>;

const NodeId = z.union([InvestorId, CompanyId]);

export const GraphDocument = z
  .strictObject({
    version: z.literal(SCHEMA_VERSION),
    generated_at: z.iso.datetime({ offset: true }),
    layout: z
      .strictObject({
        algorithm: z.string(),
        iterations: z.number().int().nonnegative(),
        seed: z.number().int(),
      })
      .nullable()
      .describe("Set by scripts/layout-graph.ts"),
    nodes: z.array(
      z.strictObject({
        id: NodeId,
        kind: z.enum(["investor", "company"]),
        label: z.string(),
        is_competitor: z.boolean(),
        x: z.number().nullable(),
        y: z.number().nullable(),
        degree: z.number().int().nonnegative(),
        weighted_degree: z.number().nonnegative(),
        betweenness: z.number().min(0).max(1),
      }),
    ),
    edges: z.array(
      z.strictObject({
        source: InvestorId,
        target: CompanyId,
        round_id: RoundId,
        role: z.enum(["lead", "participant", "unspecified"]),
        stage: RoundStage,
        amount_usd: Usd.nullable(),
        date: z.string().nullable(),
      }),
    ),
    coinvest_edges: z.array(
      z.strictObject({
        source: InvestorId,
        target: InvestorId,
        weight: z.number().int().min(2).describe("Shared rounds"),
        round_ids: z.array(RoundId),
      }),
    ),
  })
  .describe("Investor ↔ company graph with metrics and precomputed layout");
export type GraphDocument = z.infer<typeof GraphDocument>;

export const CompetitorOverlapDocument = z
  .strictObject({
    version: z.literal(SCHEMA_VERSION),
    generated_at: z.iso.datetime({ offset: true }),
    competitor_ids: z.array(CompanyId),
    rows: z.array(
      z.strictObject({
        investor_id: InvestorId,
        competitor_ids: z.array(CompanyId).min(1),
        round_ids: z.array(RoundId),
        latest_date: z.string().nullable(),
      }),
    ),
  })
  .describe("Which investors back which competitors");
export type CompetitorOverlapDocument = z.infer<typeof CompetitorOverlapDocument>;

/** Analytics files that aren't record datasets, by file name. */
export const DOCUMENTS = {
  graph: GraphDocument,
  competitor_overlap: CompetitorOverlapDocument,
} as const;
export type DocumentName = keyof typeof DOCUMENTS;
export const DOCUMENT_NAMES = Object.keys(DOCUMENTS) as DocumentName[];
