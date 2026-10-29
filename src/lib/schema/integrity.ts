import type { DatasetName, DatasetRecord } from "./datasets";

export type IntegrityIssue = { dataset: DatasetName; id: string; message: string };

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
