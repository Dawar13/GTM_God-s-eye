import { describe, expect, it } from "vitest";
import { checkIntegrity, type AllRecords } from "@/lib/schema";
import {
  company,
  competitor,
  fund,
  investor,
  landscapeCompany,
  program,
  round,
  targetCustomer,
} from "./fixtures";

function data(overrides: Partial<AllRecords> = {}): AllRecords {
  return {
    investors: [investor()],
    funds: [fund()],
    companies: [company()],
    competitors: [competitor()],
    rounds: [round()],
    anomalies: [],
    merges: [],
    partners: [],
    benchmarks: [],
    legal_notes: [],
    accelerator_programs: [],
    landscape_companies: [],
    target_customers: [],
    fit_features: [],
    layout_thesis: [],
    clusters: [],
    layout_bubbles: [],
    ...overrides,
  };
}

const messages = (d: AllRecords) => checkIntegrity(d).map((i) => `${i.id}: ${i.message}`);

describe("checkIntegrity", () => {
  it("flags a target customer whose competitor or twin does not exist", () => {
    const bad = targetCustomer({ competitor_ids: ["co_ghost"], also_listed_ids: ["cust_ghost"] });
    const ok = targetCustomer({ id: "cust_blr-ok", competitor_ids: [competitor().id] });
    expect(messages(data({ target_customers: [bad, ok] }))).toEqual([
      "cust_mp-bosch-ltd: also_listed_ids cust_ghost does not exist",
      "cust_mp-bosch-ltd: competitor_ids co_ghost does not exist",
    ]);
  });

  it("flags a programme whose firm does not exist, and allows an unlinked one", () => {
    const linked = program({ investor_id: "inv_ghost" });
    const unlinked = program({ id: "prog_unlinked", investor_id: null });
    expect(messages(data({ accelerator_programs: [linked, unlinked] }))).toEqual([
      "prog_y-combinator: investor_id inv_ghost does not exist",
    ]);
  });

  it("flags a landscape company whose match does not exist", () => {
    const bad = landscapeCompany({ matched_id: "co_ghost" });
    const ok = landscapeCompany({ id: "land_ok", matched_id: competitor().id });
    expect(messages(data({ landscape_companies: [bad, ok] }))).toEqual([
      "land_ati-robotics: matched_id co_ghost does not exist",
    ]);
  });

  it("passes a consistent dataset", () => {
    expect(messages(data())).toEqual([]);
  });

  it("flags duplicate ids", () => {
    expect(messages(data({ investors: [investor(), investor()] }))).toContain(
      "inv_root-ventures: duplicate id",
    );
  });

  it("flags a fund whose investor does not exist", () => {
    const orphan = fund({ id: "fund_ghost_i", investor_id: "inv_ghost" });
    expect(messages(data({ funds: [fund(), orphan] }))).toContain(
      "fund_ghost_i: investor_id inv_ghost does not exist",
    );
  });

  it("flags an investor listing a missing fund", () => {
    expect(messages(data({ funds: [] }))).toContain(
      "inv_root-ventures: fund fund_root-ventures_iv does not exist",
    );
  });

  it("flags rounds pointing at missing companies or investors", () => {
    const bad = round({ company_id: "co_ghost", unspecified_investor_ids: ["inv_ghost"] });
    const found = messages(data({ rounds: [bad] }));
    expect(found).toContain(
      "rnd_machina-labs_2026_undisclosed: company_id co_ghost does not exist",
    );
    expect(found).toContain(
      "rnd_machina-labs_2026_undisclosed: unspecified investor inv_ghost does not exist",
    );
  });

  it("accepts rounds of competitors", () => {
    const r = round({ company_id: "co_tandem" });
    expect(messages(data({ rounds: [r] }))).toEqual([]);
  });

  it("flags an id used in both companies and competitors", () => {
    const clash = competitor({ id: "co_machina-labs" });
    expect(messages(data({ competitors: [clash] }))).toContain(
      "co_machina-labs: id is also used in companies.json",
    );
  });
});
