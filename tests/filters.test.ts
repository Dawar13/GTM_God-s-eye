import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTER_STATE,
  FILTER_DEFS,
  applyFilters,
  facetCounts,
  isDefaultState,
  summarizeFilters,
  type FilterState,
  type FilterableInvestor,
} from "@/lib/filters";
import { parseFilters, serializeFilters } from "@/lib/filters/url";
import { toDirectoryRows, toFilterable } from "@/lib/data/directory";
import { investor } from "./fixtures";

const none: FilterState = {
  region: [],
  stage: [],
  type: [],
  freshness: [],
  maturity: [],
  sector: [],
  tier: [],
  tag: [],
};

function row(id: string, over: Partial<FilterableInvestor> = {}): FilterableInvestor {
  return {
    id,
    region: "western",
    stages: [],
    type: "vc",
    freshness: null,
    maturity: null,
    sectors: [],
    tier: null,
    tags: [],
    ...over,
  };
}

const ROWS: FilterableInvestor[] = [
  row("a", { stages: ["seed", "series_a"], freshness: "fresh", maturity: "established", tier: "A", sectors: ["ai_infra"] }),
  row("b", { stages: ["seed"], type: "cvc", freshness: "older", tier: "B" }),
  row("c", { region: "india", stages: ["pre_seed", "seed"], freshness: "fresh", tier: "B", sectors: ["ai_infra", "fintech"] }),
  row("d", { region: null, type: null, stages: [] }),
  row("e", { type: "accelerator", stages: ["pre_seed"], freshness: "fresh", maturity: "debut" }),
];

describe("applyFilters", () => {
  it("returns everything when no filter is set", () => {
    expect(applyFilters(ROWS, none)).toHaveLength(5);
  });

  it("ORs values within a filter and ANDs across filters", () => {
    const both = applyFilters(ROWS, { ...none, region: ["western", "india"] });
    expect(both.map((r) => r.id)).toEqual(["a", "b", "c", "e"]);
    const narrowed = applyFilters(ROWS, { ...none, region: ["western", "india"], stage: ["seed"] });
    expect(narrowed.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("never matches an unknown value against an active filter", () => {
    expect(applyFilters(ROWS, { ...none, region: ["western"] }).map((r) => r.id)).not.toContain("d");
    expect(applyFilters(ROWS, { ...none, type: ["vc"] }).map((r) => r.id)).not.toContain("d");
  });

  it("matches a multi-valued attribute on any of its values", () => {
    expect(applyFilters(ROWS, { ...none, sector: ["fintech"] }).map((r) => r.id)).toEqual(["c"]);
  });

  it("can skip one key", () => {
    const state = { ...none, region: ["india" as const], stage: ["seed" as const] };
    expect(applyFilters(ROWS, state, "region").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("facetCounts", () => {
  const states: FilterState[] = [
    none,
    DEFAULT_FILTER_STATE,
    { ...none, stage: ["seed"], freshness: ["fresh"] },
    { ...none, region: ["western", "india"], type: ["vc", "accelerator"], tier: ["B"] },
  ];

  it("gives every option the count the list shows when that option alone is selected", () => {
    for (const state of states) {
      const counts = facetCounts(ROWS, state);
      for (const def of FILTER_DEFS) {
        for (const o of def.options) {
          const shown = applyFilters(ROWS, { ...state, [def.key]: [o.value] } as FilterState);
          expect(counts[def.key][o.value], `${def.key}=${o.value}`).toBe(shown.length);
        }
      }
    }
  });

  it("reports zero for an option no record has (incubator)", () => {
    expect(facetCounts(ROWS, none).type.incubator).toBe(0);
  });

  it("counts a row once per option even when it lists a value twice", () => {
    const dup = [row("x", { stages: ["seed", "seed"] })];
    expect(facetCounts(dup, none).stage.seed).toBe(1);
  });
});

describe("the Directory and the filter bar agree", () => {
  it("toDirectoryRows and toFilterable give the same filtered ids", () => {
    const investors = [
      investor({ id: "inv_one", name: "One", stages: ["seed"], region: "western", type: "vc" }),
      investor({ id: "inv_two", name: "Two", stages: ["series_b"], region: "india", type: "cvc" }),
      investor({ id: "inv_three", name: "Three", stages: ["seed"], region: "western", type: "cvc" }),
    ];
    const state: FilterState = { ...none, stage: ["seed"], region: ["western"] };
    const directory = applyFilters(toDirectoryRows(investors, []), state).map((r) => r.id);
    const bar = applyFilters(investors.map(toFilterable), state).map((r) => r.id);
    expect(directory).toEqual(bar);
    expect(facetCounts(investors.map(toFilterable), { ...none, region: ["western"] }).stage.seed).toBe(
      applyFilters(toDirectoryRows(investors, []), { ...none, region: ["western"], stage: ["seed"] }).length,
    );
  });
});

describe("tag filter", () => {
  const tagged = [
    row("t1", { tags: ["Big names"] }),
    row("t2", { tags: ["Strategic and corporate", "Big names"] }),
    row("t3", { tags: [] }),
  ];

  it("keeps rows with any selected tag and drops untagged rows", () => {
    expect(applyFilters(tagged, { ...none, tag: ["Big names"] }).map((r) => r.id)).toEqual(["t1", "t2"]);
    expect(applyFilters(tagged, { ...none, tag: ["Strategic and corporate"] }).map((r) => r.id)).toEqual(["t2"]);
  });

  it("counts tags in the facets and parses them from the URL", () => {
    const counts = facetCounts(tagged, none).tag;
    expect(counts["Big names"]).toBe(2);
    expect(counts["Robotics and hard-tech"]).toBe(0);
    expect(parseFilters("region=&tag=Big names,Nope").tag).toEqual(["Big names"]);
    expect(summarizeFilters({ ...none, tag: ["Big names"] })).toBe("Big names");
  });
});

describe("summarizeFilters", () => {
  it("lists up to three active filters then counts the rest", () => {
    const state: FilterState = {
      ...none,
      region: ["western"],
      stage: ["seed", "series_a"],
      freshness: ["fresh"],
      maturity: ["debut"],
      tier: ["A"],
      sector: ["fintech"],
    };
    expect(summarizeFilters(state)).toBe("Western · Seed–A · Fresh funds · 3 more");
  });

  it("describes none and the default", () => {
    expect(summarizeFilters(none)).toBe("All investors");
    expect(summarizeFilters(DEFAULT_FILTER_STATE)).toBe("Western");
  });

  it("falls back to a count for non-contiguous stages", () => {
    expect(summarizeFilters({ ...none, stage: ["seed", "growth"] })).toBe("2 stages");
  });
});

describe("URL filters", () => {
  it("parses the default from an empty query", () => {
    expect(parseFilters("")).toEqual(DEFAULT_FILTER_STATE);
    expect(isDefaultState(parseFilters(""))).toBe(true);
  });

  it("parses comma lists and drops unknown values", () => {
    const state = parseFilters("region=western,india&stage=seed,series_a&type=incubator&tier=Z");
    expect(state.region).toEqual(["western", "india"]);
    expect(state.stage).toEqual(["seed", "series_a"]);
    expect(state.type).toEqual(["incubator"]);
    expect(state.tier).toEqual([]);
  });

  it("leaves the default out of the URL", () => {
    expect(serializeFilters(DEFAULT_FILTER_STATE)).toBe("");
  });

  it("round-trips a state", () => {
    const state: FilterState = {
      region: ["india"],
      stage: ["pre_seed", "seed"],
      type: ["vc", "incubator"],
      freshness: ["fresh"],
      maturity: ["debut"],
      sector: ["ai_infra", "fintech"],
      tier: ["A", "B"],
      tag: ["Big names", "Strategic and corporate"],
    };
    expect(parseFilters(serializeFilters(state))).toEqual(state);
  });

  it("round-trips 'all regions' (an empty region list)", () => {
    const state: FilterState = { ...none };
    const query = serializeFilters(state);
    expect(parseFilters(query).region).toEqual([]);
  });
});
