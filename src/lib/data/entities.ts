/**
 * Lean, serialisable views of the data for client features that must not ship
 * whole datasets in page HTML: the palette name index, the filter index and the
 * inspector header. Served by cached route handlers under /api.
 */
import { INVESTOR_TYPE_LABELS } from "@/lib/format/labels";
import type { FilterableInvestor } from "@/lib/filters";
import type { Source } from "@/lib/schema";
import { getCompanies, getCompetitors, getInvestors, getRounds } from "./index";
import { toFilterable } from "./directory";

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

export type EntitySource = { url: string; domain: string; kind: Source["kind"]; retrievedAt: string };

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
};

const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });

function country(code: string | null): string | null {
  if (!code) return null;
  try {
    return COUNTRY.of(code) ?? code;
  } catch {
    return code;
  }
}

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
      for (const b of [...r.lead_investor_ids, ...r.participant_investor_ids]) backerIds.add(b);
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
      backers: { total: list.length, list: list.slice(0, BACKER_LIMIT) },
    };
  }
  return null;
}
