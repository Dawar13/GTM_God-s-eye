import { describe, expect, it } from "vitest";
import { parseCustomerUrl, toCustomerFilters, customerHref } from "@/lib/customers/url";
import { matchRecord } from "@/lib/search/match";
import {
  customerFacetCounts,
  customerSearchText,
  filterCustomers,
  hasCustomerFilters,
  NO_CUSTOMER_FILTERS,
  toCustomerRows,
  type CustomerFilters,
} from "@/lib/viz/transforms/customers";
import { competitor, targetCustomer } from "./fixtures";

const comp = competitor({ id: "co_tractian", name: "Tractian" });
const records = [
  targetCustomer({
    id: "cust_mp-bosch-ltd",
    also_listed_ids: ["cust_blr-bosch-ltd"],
    competitor_ids: ["co_tractian"],
  }),
  targetCustomer({
    id: "cust_blr-bosch-ltd",
    list: "bengaluru",
    address: "Bengaluru HQ; Bidadi and Naganathapura plants",
    areas: ["bengaluru_metro"],
    also_listed_ids: ["cust_mp-bosch-ltd"],
    competitor_ids: ["co_tractian"],
  }),
  targetCustomer({
    id: "cust_mp-sagar-defence-engineering",
    name: "Sagar Defence Engineering",
    tier: 1,
    category: "Drones, defence, aerospace and space",
    sectors: ["defence_aerospace"],
    revenue_band: "lt_100",
    team_band: "lt_500",
    address: "Pune",
    areas: ["pune"],
  }),
  targetCustomer({
    id: "cust_mp-galaxy-surfactants",
    name: "Galaxy Surfactants",
    tier: 1,
    category: "Specialty chemicals and pharma",
    sectors: ["chemicals", "pharma_life_sciences"],
    revenue_band: "2000_10000",
    team_band: "500_2000",
    address: "Navi Mumbai; Taloja and Tarapur plants",
    areas: ["navi_mumbai", "palghar"],
  }),
];
const rows = toCustomerRows(records, [comp]);
const names = (f: Partial<CustomerFilters>) =>
  filterCustomers(rows, { ...NO_CUSTOMER_FILTERS, ...f }).map((r) => r.id);

describe("toCustomerRows", () => {
  it("names competitors and the twin on the other list", () => {
    const bosch = rows[0]!;
    expect(bosch.tier).toBe("3");
    expect(bosch.competitors).toEqual([{ id: "co_tractian", name: "Tractian" }]);
    expect(bosch.alsoListed).toEqual([{ id: "cust_blr-bosch-ltd", list: "bengaluru" }]);
  });
});

describe("filterCustomers", () => {
  it("shows everything with no filters", () => {
    expect(names({})).toHaveLength(4);
    expect(hasCustomerFilters(NO_CUSTOMER_FILTERS)).toBe(false);
  });

  it("ORs within a filter and ANDs across filters", () => {
    expect(names({ tier: ["1"] })).toEqual([
      "cust_mp-sagar-defence-engineering",
      "cust_mp-galaxy-surfactants",
    ]);
    expect(names({ tier: ["1"], area: ["pune", "palghar"] })).toHaveLength(2);
    expect(names({ tier: ["1"], area: ["pune"] })).toEqual(["cust_mp-sagar-defence-engineering"]);
    expect(names({ list: "bengaluru" })).toEqual(["cust_blr-bosch-ltd"]);
  });

  it("matches any of a company's areas and industries", () => {
    expect(names({ sector: ["pharma_life_sciences"] })).toEqual(["cust_mp-galaxy-surfactants"]);
    expect(names({ area: ["palghar"] })).toEqual(["cust_mp-galaxy-surfactants"]);
  });

  it("keeps only companies a competitor already names", () => {
    expect(names({ rivals: true })).toEqual(["cust_mp-bosch-ltd", "cust_blr-bosch-ltd"]);
  });
});

describe("customerFacetCounts", () => {
  it("counts each option as if it alone were picked in its own filter", () => {
    const f = { ...NO_CUSTOMER_FILTERS, tier: ["1"] as const, list: "mumbai_pune" as const };
    const c = customerFacetCounts(rows, f);
    // Tier ignores its own selection: every Mumbai–Pune row counts.
    expect(c.tier).toEqual({ "1": 2, "2": 0, "3": 1 });
    // Areas honour the tier filter; a company in two areas counts in both.
    expect(c.area.navi_mumbai).toBe(1);
    expect(c.area.palghar).toBe(1);
    expect(c.area.nashik).toBe(0);
    expect(c.list).toEqual({ all: 2, mumbai_pune: 2, bengaluru: 0 });
    expect(c.rivals).toBe(0);
  });
});

describe("find", () => {
  it("matches the name first, then category, address and competitor names", () => {
    const sagar = rows[2]!;
    expect(matchRecord("sagar", customerSearchText(sagar))).not.toBeNull();
    expect(matchRecord("tractian", customerSearchText(rows[0]!))).not.toBeNull();
    expect(matchRecord("taloja", customerSearchText(rows[3]!))).not.toBeNull();
  });
});

describe("customer URL", () => {
  it("parses filters and drops unknown values", () => {
    const s = parseCustomerUrl(
      "?c_list=bengaluru&c_tier=1,9&c_area=pune,mars&c_rival=true&q=Bosch",
    );
    expect(toCustomerFilters(s)).toEqual({
      ...NO_CUSTOMER_FILTERS,
      list: "bengaluru",
      tier: ["1"],
      area: ["pune"],
      rivals: true,
    });
    expect(s.q).toBe("Bosch");
  });

  it("builds a link that opens the page on a company", () => {
    expect(customerHref("Larsen & Toubro")).toBe("/customers?q=Larsen%20%26%20Toubro");
  });
});

describe("carryInto", () => {
  it("adds filters after an existing query and before a hash", async () => {
    const { carryInto } = await import("@/lib/hooks/useCarryQuery");
    const carry = carryInto("region=india");
    expect(carry("/customers?q=Bosch%20Ltd")).toBe("/customers?q=Bosch%20Ltd&region=india");
    expect(carry("/competitors#landscape-title")).toBe("/competitors?region=india#landscape-title");
    expect(carry("/strategy")).toBe("/strategy?region=india");
    expect(carryInto("")("/strategy")).toBe("/strategy");
  });
});
