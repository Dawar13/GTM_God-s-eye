import { describe, expect, it } from "vitest";
import {
  filterMatches,
  highlightRanges,
  matchRank,
  matchRecord,
  MATCH_RANK,
  normalizeText,
  rankMatches,
} from "@/lib/search/match";

describe("normalizeText", () => {
  it("folds case, accents and whitespace", () => {
    expect(normalizeText("  Crédit   Agricole ")).toBe("credit agricole");
    expect(normalizeText("ÉCOLE")).toBe("ecole");
  });
});

describe("matchRank", () => {
  it("ranks exact, prefix, word start, substring, all words", () => {
    expect(matchRank("lux capital", "Lux Capital")).toBe(MATCH_RANK.exact);
    expect(matchRank("lux", "Lux Capital")).toBe(MATCH_RANK.prefix);
    expect(matchRank("cap", "Lux Capital")).toBe(MATCH_RANK.wordStart);
    expect(matchRank("apit", "Lux Capital")).toBe(MATCH_RANK.substring);
    expect(matchRank("capital lux", "Lux Capital")).toBe(MATCH_RANK.allWords);
    expect(matchRank("zzz", "Lux Capital")).toBeNull();
  });
  it("is case and accent insensitive both ways", () => {
    expect(matchRank("LUX", "lüx")).toBe(MATCH_RANK.exact);
    expect(matchRank("crédit", "Credit Mutuel")).toBe(MATCH_RANK.prefix);
  });
  it("treats an empty query as no match", () => {
    expect(matchRank("  ", "Lux")).toBeNull();
  });
  it("finds a word start after an earlier mid-word hit", () => {
    // "al" first appears inside "Capital", then at the start of "Alpha".
    expect(matchRank("al", "Capital Alpha")).toBe(MATCH_RANK.wordStart);
  });
});

describe("matchRecord", () => {
  it("matches aliases, ranked just below the name at the same rank", () => {
    const rec = { name: "Andreessen Horowitz", aliases: ["a16z"] };
    expect(matchRecord("a16z", rec)).toBe(MATCH_RANK.exact * 2 + 1);
    expect(matchRecord("andr", rec)).toBe(MATCH_RANK.prefix * 2);
    expect(matchRecord("zzz", rec)).toBeNull();
  });
  it("ignores null aliases", () => {
    expect(matchRecord("x", { name: "Y", aliases: [null, undefined] })).toBeNull();
  });
});

describe("rankMatches and filterMatches", () => {
  const names = ["Capital Lux", "Lux Capital", "Deluxe Fund", "Other", "Luxor"];
  it("ranks prefix over word start over substring, stable on ties", () => {
    const ranked = rankMatches(names, "lux", (n) => n).map((r) => r.item);
    expect(ranked).toEqual(["Lux Capital", "Luxor", "Capital Lux", "Deluxe Fund"]);
  });
  it("filters in input order, and an empty query keeps everything", () => {
    expect(filterMatches(names, "lux", (n) => n)).toEqual([
      "Capital Lux",
      "Lux Capital",
      "Deluxe Fund",
      "Luxor",
    ]);
    expect(filterMatches(names, "", (n) => n)).toBe(names);
    expect(rankMatches(names, "", (n) => n)).toEqual([]);
  });
});

describe("highlightRanges", () => {
  it("maps matches back to the original string through accents and case", () => {
    expect(highlightRanges("Lüx Capital", "lux")).toEqual([[0, 3]]);
    expect(highlightRanges("Crédit Agricole", "credit")).toEqual([[0, 6]]);
  });
  it("marks every occurrence, and each word when the phrase is absent", () => {
    expect(highlightRanges("ab ab", "ab")).toEqual([
      [0, 2],
      [3, 5],
    ]);
    expect(highlightRanges("Lux Capital", "capital lux")).toEqual([
      [0, 3],
      [4, 11],
    ]);
  });
  it("returns nothing for no query or no match", () => {
    expect(highlightRanges("Lux", "")).toEqual([]);
    expect(highlightRanges("Lux", "zz")).toEqual([]);
  });
});
