import { z } from "zod";
import { CompetitorCategory, CompetitorLayer, RevenueBasis, Sector, SizeClass } from "./enums";
import { CompanyId, RecordConfidence, Source, Sources, Usd, Year } from "./common";

const companyShape = {
  id: CompanyId,
  name: z.string().min(1),
  hq_country: z.string().nullable().describe("ISO 3166-1 alpha-2"),
  founded_year: Year.nullable(),
  sector: Sector.nullable(),
  description_short: z.string().nullable().describe("One line, paraphrased"),
  total_raised_usd: Usd.nullable(),
  sources: Sources,
  confidence: RecordConfidence,
};

export const Company = z
  .strictObject({
    ...companyShape,
    is_competitor: z.literal(false).describe("Competitors live in competitors.json"),
  })
  .describe("A portfolio company that is not one of our competitors");
export type Company = z.infer<typeof Company>;

export const Competitor = z
  .strictObject({
    ...companyShape,
    is_competitor: z.literal(true),
    category: CompetitorCategory,
    layer: CompetitorLayer.describe("Position on the layer map (PROJECT_CONTEXT §2)"),
    layer_detail: z
      .string()
      .nullable()
      .describe("Finer layer, e.g. maintenance / condition monitoring"),
    size_class: SizeClass.nullable(),
    headcount_est: z
      .strictObject({ value: z.number().int().positive(), source: Source })
      .nullable()
      .describe("Headcount estimate, only with a source (e.g. LinkedIn page)"),
    revenue_usd: Usd.nullable().describe("Only when publicly reported; never estimated"),
    revenue_basis: RevenueBasis,
    product_summary: z.string().nullable(),
    pricing: z.string().nullable().describe("Public pricing, as stated"),
  })
  .refine((c) => (c.revenue_usd === null) === (c.revenue_basis === "none"), {
    message: "revenue_usd needs revenue_basis 'reported'; no revenue means 'none'",
    path: ["revenue_basis"],
  })
  .describe("A company we compete with or benchmark against");
export type Competitor = z.infer<typeof Competitor>;
