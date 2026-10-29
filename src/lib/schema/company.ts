import { z } from "zod";
import {
  CompetitorCategory,
  CompetitorLayer,
  RevenueBasis,
  Sector,
  SectorClassifiedBy,
  SizeClass,
} from "./enums";
import {
  CompanyId,
  FieldSources,
  RecordConfidence,
  Source,
  Sources,
  Url,
  Usd,
  Year,
} from "./common";

const companyShape = {
  id: CompanyId,
  name: z.string().min(1),
  website: Url.nullable().describe("Own site; companies are de-duplicated by its domain"),
  hq_country: z.string().nullable().describe("ISO 3166-1 alpha-2"),
  founded_year: Year.nullable(),
  sector: Sector.nullable(),
  sector_classified_by: SectorClassifiedBy.nullable().describe(
    "source: the company's own description says so; model: classified by the researcher",
  ),
  layer: CompetitorLayer.nullable().describe("Only for companies in our space"),
  description_short: z.string().nullable().describe("One line, paraphrased"),
  total_raised_usd: Usd.nullable(),
  sources: Sources,
  field_sources: FieldSources,
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
    size_class: SizeClass.nullable().describe("By total raised"),
    founders: z.array(z.string()),
    named_customers: z.array(z.string()).describe("Customers the company names publicly"),
    headcount_est: z
      .strictObject({ value: z.number().int().positive(), source: Source })
      .nullable()
      .describe("Approximate headcount, only with a source (e.g. LinkedIn page)"),
    revenue_usd: Usd.nullable().describe("Only when publicly reported; never estimated"),
    revenue_basis: RevenueBasis,
    product_summary: z.string().nullable().describe("≤ 50 words"),
    pricing: z.string().nullable().describe("Public pricing, as stated"),
  })
  .refine((c) => (c.revenue_usd === null) === (c.revenue_basis === "none"), {
    message: "revenue_usd needs revenue_basis 'reported'; no revenue means 'none'",
    path: ["revenue_basis"],
  })
  .describe("A company we compete with or benchmark against");
export type Competitor = z.infer<typeof Competitor>;
