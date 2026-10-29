import { describe, expect, it } from "vitest";
import { Competitor, Fund, Investor, Round, SCHEMA_VERSION, datasetOf } from "@/lib/schema";
import { competitor, fund, investor, round, source } from "./fixtures";

describe("Investor", () => {
  it("accepts a minimal Phase 0 record", () => {
    expect(Investor.safeParse(investor()).success).toBe(true);
  });

  it("rejects a record with no sources", () => {
    expect(Investor.safeParse(investor({ sources: [] })).success).toBe(false);
  });

  it("rejects a source without retrieved_at", () => {
    const noDate: Partial<typeof source> = { ...source };
    delete noDate.retrieved_at;
    expect(Investor.safeParse(investor({ sources: [noDate as typeof source] })).success).toBe(
      false,
    );
  });

  it("accepts user_supplied pseudo-URLs and http URLs, nothing else", () => {
    const withUrl = (url: string) => investor({ sources: [{ ...source, url }] });
    expect(Investor.safeParse(withUrl("https://example.com/fund-ii")).success).toBe(true);
    expect(Investor.safeParse(withUrl("user_supplied:li_ajvc_post")).success).toBe(true);
    expect(Investor.safeParse(withUrl("www.example.com")).success).toBe(false);
  });

  it("requires sector weights to sum to 1", () => {
    const ok = investor({
      sector_weights: {
        value: { industrial_manufacturing: 0.6, ai_apps_agents: 0.4 },
        method: "stated",
        inputs: ["thesis_text"],
      },
    });
    const bad = investor({
      sector_weights: { value: { industrial_manufacturing: 0.6 }, method: "stated", inputs: [] },
    });
    expect(Investor.safeParse(ok).success).toBe(true);
    expect(Investor.safeParse(bad).success).toBe(false);
  });

  it("rejects sectors outside the taxonomy", () => {
    const bad = investor({
      sector_weights: { value: { biotech: 1 } as never, method: "stated", inputs: [] },
    });
    expect(Investor.safeParse(bad).success).toBe(false);
  });

  it("rejects check_min above check_max", () => {
    const bad = investor({ check_min_usd: 2_000_000, check_max_usd: 500_000 });
    expect(Investor.safeParse(bad).success).toBe(false);
  });

  it("rejects ids without the inv_ prefix and unknown fields", () => {
    expect(Investor.safeParse(investor({ id: "root-ventures" })).success).toBe(false);
    expect(Investor.safeParse({ ...investor(), aum: 1 }).success).toBe(false);
  });
});

describe("Fund", () => {
  it("accepts a fund and checks date precision", () => {
    expect(Fund.safeParse(fund()).success).toBe(true);
    expect(Fund.safeParse(fund({ close_date: "2025-06" })).success).toBe(false);
    expect(
      Fund.safeParse(fund({ close_date: "2025-06", close_date_precision: "month" })).success,
    ).toBe(true);
  });

  it("only accepts Roman fund numbers", () => {
    expect(Fund.safeParse(fund({ number: "4" })).success).toBe(false);
  });
});

describe("Competitor", () => {
  it("allows revenue only when reported", () => {
    expect(Competitor.safeParse(competitor()).success).toBe(true);
    expect(Competitor.safeParse(competitor({ revenue_usd: 5_000_000 })).success).toBe(false);
    expect(
      Competitor.safeParse(competitor({ revenue_usd: 5_000_000, revenue_basis: "reported" }))
        .success,
    ).toBe(true);
  });
});

describe("Round", () => {
  it("rejects an investor holding two roles", () => {
    const bad = round({ lead_investor_ids: ["inv_root-ventures"] });
    expect(Round.safeParse(bad).success).toBe(false);
  });
});

describe("Dataset wrapper", () => {
  it("parses an empty dataset", () => {
    const empty = { version: SCHEMA_VERSION, generated_at: "2026-10-29T00:00:00Z", records: [] };
    expect(datasetOf(Investor).safeParse(empty).success).toBe(true);
  });
});
