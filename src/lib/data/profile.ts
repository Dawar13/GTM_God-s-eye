/**
 * The Inspector's investor profile: everything beyond the header facts, built once on the
 * server from stored fields (nothing is written here, nothing estimated). The pieces that
 * feed charts come from the tested transforms in src/lib/viz/transforms; this file only
 * joins records. Served by /api/entity/[id]/profile.
 */
import { INVESTOR_STAGE_LABELS, SECTOR_LABELS, SEED_LIST_LABELS } from "@/lib/format/labels";
import type { Company, Competitor, FitFeatures, Fund, Investor, Round } from "@/lib/schema";
import type { Confidence } from "@/lib/schema";
import { provenanceOf } from "@/lib/viz/transforms/common";
import { fundsTimeline, type FundsTimeline } from "@/lib/viz/transforms/fundsTimeline";
import { investorDeals, type InvestorDeals } from "@/lib/viz/transforms/investorDeals";
import { sectorBars, type SectorBars } from "@/lib/viz/transforms/sectorBars";
import { sourceDomain } from "./entities";
import { getCompanies, getCompetitors, getFitFeatures, getFunds, getInvestors, getPartners, getRounds } from "./index";

/** What one of the user's lists says about the investor, as written; never verified. */
export type ListedHint = {
  list: string;
  focus: string | null;
  check: string | null;
  notes: string | null;
};

/** Seed hints that say something, in the investor's order, with readable list names. */
export function listedHints(inv: Pick<Investor, "seed_hints">): ListedHint[] {
  return inv.seed_hints
    .filter((h) => h.listed_focus || h.listed_check_or_fund || h.notes)
    .map((h) => ({
      list: SEED_LIST_LABELS[h.source_id] ?? h.source_id,
      focus: h.listed_focus,
      check: h.listed_check_or_fund,
      notes: h.notes,
    }));
}

export type ProfilePartner = {
  id: string;
  name: string;
  title: string | null;
  focusSectors: string[];
  linkedinUrl: string | null;
};

export type InvestorProfile = {
  id: string;
  stages: string[];
  checkMinUsd: number | null;
  checkMaxUsd: number | null;
  leads: boolean | null;
  portfolioCountReported: number | null;
  thesis: { text: string | null; sourceDomain: string | null };
  /** What the user's lists say (focus, check size), unverified. */
  listed: ListedHint[];
  /** Roll-up of the investor's own sources, for tooltips on its marks. */
  provenance: { sourceDomain: string | null; confidence: Confidence | null };
  /**
   * The stored fit record. The Inspector scores it for our round (fitForRound, then
   * fitBreakdown), so the profile stays cacheable for every raise.
   */
  fit: FitFeatures | null;
  sectors: SectorBars;
  funds: FundsTimeline;
  partners: ProfilePartner[];
  deals: InvestorDeals;
};

export type ProfileInputs = {
  investor: Investor;
  investors: readonly Investor[];
  funds: readonly Fund[];
  partners: readonly {
    id: string;
    investor_id: string;
    name: string;
    title: string | null;
    focus_sectors: readonly string[];
    linkedin_url: string | null;
  }[];
  rounds: readonly Round[];
  companies: readonly Company[];
  competitors: readonly Competitor[];
  fit: FitFeatures | null;
};

export function buildInvestorProfile(input: ProfileInputs): InvestorProfile {
  const { investor: inv } = input;
  const thesisIdx = inv.field_sources["thesis_text"]?.[0];
  const thesisSource = thesisIdx === undefined ? undefined : inv.sources[thesisIdx];
  return {
    id: inv.id,
    stages: inv.stages.map((s) => INVESTOR_STAGE_LABELS[s]),
    checkMinUsd: inv.check_min_usd,
    checkMaxUsd: inv.check_max_usd,
    leads: inv.leads,
    portfolioCountReported: inv.portfolio_count_reported,
    thesis: {
      text: inv.thesis_text,
      sourceDomain: thesisSource ? sourceDomain(thesisSource.url) : null,
    },
    listed: listedHints(inv),
    provenance: provenanceOf([inv]),
    fit: input.fit,
    sectors: sectorBars(inv.sector_weights),
    funds: fundsTimeline(input.funds.filter((f) => f.investor_id === inv.id)),
    partners: input.partners
      .filter((p) => p.investor_id === inv.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        focusSectors: p.focus_sectors.map((s) => SECTOR_LABELS[s as keyof typeof SECTOR_LABELS] ?? s),
        linkedinUrl: p.linkedin_url,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    deals: investorDeals(
      inv.id,
      input.rounds,
      new Map(input.companies.map((c) => [c.id, { id: c.id, name: c.name }])),
      new Map(input.competitors.map((c) => [c.id, { id: c.id, name: c.name, layer: c.layer }])),
      new Map(input.investors.map((i) => [i.id, i.name])),
    ),
  };
}

export async function getInvestorProfile(id: string): Promise<InvestorProfile | null> {
  "use cache";
  const investors = await getInvestors();
  const investor = investors.find((i) => i.id === id);
  if (!investor) return null;
  const [funds, partners, rounds, companies, competitors, fits] = await Promise.all([
    getFunds(),
    getPartners(),
    getRounds(),
    getCompanies(),
    getCompetitors(),
    getFitFeatures(),
  ]);
  return buildInvestorProfile({
    investor,
    investors,
    funds,
    partners,
    rounds,
    companies,
    competitors,
    fit: fits.find((f) => f.investor_id === id) ?? null,
  });
}
