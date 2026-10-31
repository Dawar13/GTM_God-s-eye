/**
 * Lean, serialisable views of the data for client features that must not ship
 * whole datasets in page HTML: the palette name index, the filter index, the Directory
 * and Strategy rows and the inspector header. Served by cached route handlers under /api
 * (prerendered at build time, since none reads the request).
 */
import { formatCountry } from "@/lib/format";
import { COMPETITOR_CATEGORY_LABELS, INVESTOR_TYPE_LABELS, LAYER_LABELS } from "@/lib/format/labels";
import { roundInvestorIds, roundList, type RoundListItem } from "@/lib/viz/transforms/competitors";
import type { FilterableInvestor } from "@/lib/filters";
import { toStrategyRows, type StrategyRow } from "@/lib/viz/transforms/strategy";
import type { Source } from "@/lib/schema";
import {
  getCompanies,
  getCompetitors,
  getFitFeatures,
  getFunds,
  getInvestors,
  getRounds,
} from "./index";
import { toDirectoryRows, toFilterable, type DirectoryRow } from "./directory";

export type EntityKind = "investor" | "company" | "competitor";

export type PaletteEntry = { id: string; name: string; kind: EntityKind };

export async function getPaletteIndex(): Promise<PaletteEntry[]> {
  "use cache";
  const [investors, companies, competitors] = await Promise.all([
    getInvestors(),
    getCompanies(),
    getCompetitors(),
  ]);
  const competitorIds = new Set(competitors.map((c) => c.id));
  return [
    ...investors.map((i) => ({ id: i.id, name: i.name, kind: "investor" as const })),
    ...competitors.map((c) => ({ id: c.id, name: c.name, kind: "competitor" as const })),
    ...companies
      .filter((c) => !competitorIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, kind: "company" as const })),
  ];
}

export async function getFilterIndex(): Promise<FilterableInvestor[]> {
  "use cache";
  return (await getInvestors()).map(toFilterable);
}

/** Directory rows for every investor (the table filters them in the browser). */
export async function getDirectoryRows(): Promise<DirectoryRow[]> {
  "use cache";
  const [investors, funds, fits] = await Promise.all([getInvestors(), getFunds(), getFitFeatures()]);
  return toDirectoryRows(investors, funds, fits);
}

/** Strategy rows for every investor (ranking and tiers run in the browser). */
export async function getStrategyRows(): Promise<StrategyRow[]> {
  "use cache";
  const [investors, fits] = await Promise.all([getInvestors(), getFitFeatures()]);
  return toStrategyRows(investors, fits);
}

export type EntitySource = { url: string; domain: string; kind: Source["kind"]; retrievedAt: string };

/** What the Inspector adds for a competitor (S8): the stored facts and its rounds. */
export type CompetitorDetail = {
  layer: string;
  category: string;
  foundedYear: number | null;
  totalRaisedUsd: number | null;
  /** Approximate headcount as stored. */
  headcount: number | null;
  /** Reported revenue in USD, as stored. */
  revenueUsd: number | null;
  rounds: RoundListItem[];
};

export type EntityHeader = {
  id: string;
  kind: EntityKind;
  name: string;
  typeLabel: string | null;
  hq: string | null;
  website: string | null;
  confidence: "high" | "medium" | "low" | null;
  sources: EntitySource[];
  /** Investors in this company's rounds (companies and competitors only). */
  backers?: { total: number; list: { id: string; name: string }[] };
  competitor?: CompetitorDetail;
};

const country = (code: string | null) => (code ? formatCountry(code) : null);

export function sourceDomain(url: string): string {
  if (url.startsWith("user_supplied:")) return "Your list";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function toSources(sources: readonly Source[]): EntitySource[] {
  return sources.map((s) => ({
    url: s.url,
    domain: sourceDomain(s.url),
    kind: s.kind,
    retrievedAt: s.retrieved_at,
  }));
}

const BACKER_LIMIT = 12;

export async function getEntityHeader(id: string): Promise<EntityHeader | null> {
  if (id.startsWith("inv_")) {
    const inv = (await getInvestors()).find((i) => i.id === id);
    if (!inv) return null;
    return {
      id,
      kind: "investor",
      name: inv.name,
      typeLabel: inv.type ? INVESTOR_TYPE_LABELS[inv.type] : null,
      hq: [inv.hq_city, country(inv.hq_country)].filter(Boolean).join(", ") || null,
      website: inv.website,
      confidence: inv.confidence,
      sources: toSources(inv.sources),
    };
  }
  if (id.startsWith("co_")) {
    const [competitors, companies] = await Promise.all([getCompetitors(), getCompanies()]);
    const competitor = competitors.find((c) => c.id === id);
    const company = competitor ?? companies.find((c) => c.id === id);
    if (!company) return null;
    const [rounds, investors] = await Promise.all([getRounds(), getInvestors()]);
    const backerIds = new Set<string>();
    for (const r of rounds) {
      if (r.company_id !== id) continue;
      // Every role counts, as in the Competitors table and the overlap matrix.
      for (const b of roundInvestorIds(r)) backerIds.add(b);
    }
    const names = new Map(investors.map((i) => [i.id, i.name]));
    const list = [...backerIds]
      .map((b) => ({ id: b, name: names.get(b) ?? null }))
      .filter((b): b is { id: string; name: string } => b.name !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      id,
      kind: competitor ? "competitor" : "company",
      name: company.name,
      typeLabel: competitor ? "Competitor" : "Company",
      hq: country(company.hq_country),
      website: company.website,
      confidence: company.confidence,
      sources: toSources(company.sources),
      backers: { total: list.length, list: competitor ? list : list.slice(0, BACKER_LIMIT) },
      competitor: competitor
        ? {
            layer: LAYER_LABELS[competitor.layer],
            category: COMPETITOR_CATEGORY_LABELS[competitor.category],
            foundedYear: competitor.founded_year,
            totalRaisedUsd: competitor.total_raised_usd,
            headcount: competitor.headcount_est?.value ?? null,
            revenueUsd: competitor.revenue_usd,
            rounds: roundList(id, rounds, names),
          }
        : undefined,
    };
  }
  return null;
}
