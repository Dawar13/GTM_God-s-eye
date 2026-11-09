import { z } from "zod";
import { CompanyId, idOf, RecordConfidence, Sources } from "./common";
import {
  CustomerArea,
  CustomerFit,
  CustomerList,
  CustomerRevenueBand,
  CustomerSector,
  CustomerTeamBand,
} from "./enums";

export const CustomerId = idOf("cust");

export const TargetCustomer = z
  .strictObject({
    id: CustomerId,
    name: z.string().min(1).describe("Company name exactly as the list gives it"),
    list: CustomerList.describe("The workbook (region) the row comes from"),
    tier: z
      .number()
      .int()
      .min(1)
      .max(3)
      .describe(
        "The list's tier: 1 most feasible (startups, promoter-led mid-size), 3 OEMs, MNCs and PSUs",
      ),
    category: z.string().min(1).describe("Category exactly as the list words it"),
    sectors: z
      .array(CustomerSector)
      .min(1)
      .describe("Industry groups the category maps to, for filtering across both lists"),
    revenue_band: CustomerRevenueBand.nullable().describe(
      "Revenue band in ₹ crore a year as listed; the list says approximate, not looked up per company",
    ),
    team_band: CustomerTeamBand.nullable().describe(
      "Employee band as listed; approximate, and group-wide for large groups",
    ),
    revenue_as_listed: z
      .string()
      .nullable()
      .describe(
        "The revenue cell as written, with its qualifier, e.g. '500–2,000 (₹603 Cr FY26)' or 'Not public'",
      ),
    team_as_listed: z
      .string()
      .nullable()
      .describe("The team-size cell as written, with its qualifier"),
    size_basis: z
      .string()
      .nullable()
      .describe(
        "Where the size figures come from, as the list says (e.g. 'Est. (private)'); null if not given",
      ),
    archetype: z
      .string()
      .regex(/^\d{2}$/)
      .nullable()
      .describe(
        "Archetype number from the Customer Archetypes & ROI Map, where the list gives one",
      ),
    archetype_fit: CustomerFit.nullable().describe(
      "high: the list's Targets sheet; medium: its Adjacent sheet; null where the list does not grade fit",
    ),
    sub_segment: z.string().nullable().describe("Sub-segment as listed"),
    what_they_make: z.string().nullable().describe("What the company makes, as listed"),
    why_fit: z
      .string()
      .nullable()
      .describe("The list's reason it fits and the first wedge to pitch, as written"),
    address: z
      .string()
      .nullable()
      .describe("HQ and main plant area, as listed; not a street address"),
    areas: z
      .array(CustomerArea)
      .describe(
        "Areas the address names, from a fixed place list; empty when it names none we map",
      ),
    also_listed_ids: z
      .array(CustomerId)
      .describe("The same company on the other list (another region's plant), by exact name key"),
    competitor_ids: z
      .array(CompanyId)
      .describe(
        "Competitors that publicly name this company (or its group, e.g. Bosch) as a customer, by exact name key",
      ),
    sources: Sources,
    confidence: RecordConfidence,
  })
  .describe("A target customer from the user's lists: an industrial company we might sell to");
export type TargetCustomer = z.infer<typeof TargetCustomer>;
