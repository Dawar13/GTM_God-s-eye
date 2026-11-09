import type { CompetitorOverlapDocument, DocumentName, GraphDocument } from "./analytics";
import type { DatasetName, DatasetRecord } from "./datasets";

export type IntegrityIssue = { dataset: DatasetName | DocumentName; id: string; message: string };

export type AllRecords = { [K in DatasetName]: DatasetRecord<K>[] };

/**
 * Cross-file checks Zod can't express per record: unique ids, and every id a
 * record points to exists (and points back, for investor ↔ fund).
 */
export function checkIntegrity(data: AllRecords): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const add = (dataset: DatasetName, id: string, message: string) =>
    issues.push({ dataset, id, message });

  const indexById = <K extends DatasetName>(name: K) => {
    const map = new Map<string, DatasetRecord<K>>();
    for (const record of data[name]) {
      if (map.has(record.id)) add(name, record.id, "duplicate id");
      map.set(record.id, record);
    }
    return map;
  };

  const investors = indexById("investors");
  const funds = indexById("funds");
  const companies = indexById("companies");
  const competitors = indexById("competitors");
  indexById("rounds");
  indexById("anomalies");
  indexById("merges");
  const partners = indexById("partners");
  indexById("benchmarks");
  indexById("legal_notes");
  indexById("fit_features");

  // field_sources must point at sources the record actually has.
  const withFieldSources = ["investors", "funds", "companies", "competitors", "rounds"] as const;
  for (const name of withFieldSources) {
    for (const record of data[name]) {
      for (const [field, indexes] of Object.entries(record.field_sources)) {
        if (indexes.some((i) => i >= record.sources.length))
          add(name, record.id, `field_sources.${field} points past the last source`);
      }
    }
  }

  for (const partner of data.partners) {
    const owner = investors.get(partner.investor_id);
    if (!owner) add("partners", partner.id, `investor_id ${partner.investor_id} does not exist`);
    else if (!owner.partners.includes(partner.id))
      add("partners", partner.id, `investor ${owner.id} does not list this partner`);
  }
  for (const investor of data.investors) {
    for (const pid of investor.partners) {
      if (!partners.has(pid)) add("investors", investor.id, `partner ${pid} does not exist`);
    }
  }

  for (const name of ["layout_thesis", "layout_bubbles"] as const) {
    for (const p of data[name]) {
      if (!investors.has(p.id)) add(name, p.id, "investor does not exist");
    }
  }

  for (const fit of data.fit_features) {
    if (!investors.has(fit.investor_id))
      add("fit_features", fit.id, `investor_id ${fit.investor_id} does not exist`);
  }

  indexById("accelerator_programs");
  for (const prog of data.accelerator_programs) {
    if (prog.investor_id !== null && !investors.has(prog.investor_id))
      add("accelerator_programs", prog.id, `investor_id ${prog.investor_id} does not exist`);
  }

  indexById("landscape_companies");
  for (const co of data.landscape_companies) {
    if (co.matched_id !== null && !companies.has(co.matched_id) && !competitors.has(co.matched_id))
      add("landscape_companies", co.id, `matched_id ${co.matched_id} does not exist`);
  }

  const customers = indexById("target_customers");
  for (const cust of data.target_customers) {
    for (const id of cust.also_listed_ids)
      if (!customers.has(id))
        add("target_customers", cust.id, `also_listed_ids ${id} does not exist`);
    for (const id of cust.competitor_ids)
      if (!competitors.has(id))
        add("target_customers", cust.id, `competitor_ids ${id} does not exist`);
  }

  for (const id of companies.keys()) {
    if (competitors.has(id)) add("competitors", id, "id is also used in companies.json");
  }
  const companyExists = (id: string) => companies.has(id) || competitors.has(id);

  for (const fund of data.funds) {
    const owner = investors.get(fund.investor_id);
    if (!owner) add("funds", fund.id, `investor_id ${fund.investor_id} does not exist`);
    else if (!owner.funds.includes(fund.id))
      add("funds", fund.id, `investor ${owner.id} does not list this fund`);
  }

  for (const investor of data.investors) {
    for (const fundId of investor.funds) {
      const fund = funds.get(fundId);
      if (!fund) add("investors", investor.id, `fund ${fundId} does not exist`);
      else if (fund.investor_id !== investor.id)
        add("investors", investor.id, `fund ${fundId} belongs to ${fund.investor_id}`);
    }
  }

  for (const round of data.rounds) {
    if (!companyExists(round.company_id))
      add("rounds", round.id, `company_id ${round.company_id} does not exist`);
    const roles = [
      ["lead", round.lead_investor_ids],
      ["participant", round.participant_investor_ids],
      ["unspecified", round.unspecified_investor_ids],
    ] as const;
    for (const [role, ids] of roles) {
      for (const id of ids) {
        if (!investors.has(id)) add("rounds", round.id, `${role} investor ${id} does not exist`);
      }
    }
  }

  for (const merge of data.merges) {
    if (!investors.has(merge.investor_id))
      add("merges", merge.id, `investor_id ${merge.investor_id} does not exist`);
  }

  return issues;
}

/** Analytics documents must point at records that exist. */
export function checkDocuments(data: AllRecords, docs: Record<string, unknown>): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const investors = new Set(data.investors.map((i) => i.id));
  const companies = new Set([...data.companies, ...data.competitors].map((c) => c.id));
  const rounds = new Set(data.rounds.map((r) => r.id));
  const graph = docs.graph as GraphDocument | undefined;
  if (graph) {
    const nodes = new Set(graph.nodes.map((n) => n.id));
    for (const n of graph.nodes) {
      const known = n.kind === "investor" ? investors.has(n.id) : companies.has(n.id);
      if (!known) issues.push({ dataset: "graph", id: n.id, message: "node has no record" });
    }
    for (const e of [...graph.edges, ...graph.coinvest_edges]) {
      if (!nodes.has(e.source) || !nodes.has(e.target))
        issues.push({
          dataset: "graph",
          id: `${e.source}→${e.target}`,
          message: "edge end is not a node",
        });
    }
    for (const e of graph.edges) {
      if (!rounds.has(e.round_id))
        issues.push({ dataset: "graph", id: e.round_id, message: "edge round does not exist" });
    }
  }
  const overlap = docs.competitor_overlap as CompetitorOverlapDocument | undefined;
  if (overlap) {
    for (const row of overlap.rows) {
      if (!investors.has(row.investor_id))
        issues.push({
          dataset: "competitor_overlap",
          id: row.investor_id,
          message: "investor does not exist",
        });
      for (const c of row.competitor_ids)
        if (!companies.has(c))
          issues.push({
            dataset: "competitor_overlap",
            id: c,
            message: "competitor does not exist",
          });
    }
  }
  return issues;
}
