/**
 * Find-box matching, shared by every table and chart. Pure and DOM-free.
 * Case- and accent-insensitive; a record can carry aliases. Ranks: exact, prefix, word start,
 * substring, then "every word appears somewhere". A name hit beats an alias hit of the same rank.
 */

const DIACRITICS = /[̀-ͯ]/g;

/** Lower case, accents stripped, runs of whitespace collapsed, trimmed. */
export function normalizeText(s: string): string {
  return s.normalize("NFKD").replace(DIACRITICS, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export const MATCH_RANK = {
  exact: 0,
  prefix: 1,
  wordStart: 2,
  substring: 3,
  allWords: 4,
} as const;

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** Rank of `query` (already normalised, non-empty) in `text`, lower is better; null if none. */
function rankNormalized(q: string, text: string): number | null {
  const t = normalizeText(text);
  if (!t) return null;
  if (t === q) return MATCH_RANK.exact;
  if (t.startsWith(q)) return MATCH_RANK.prefix;
  let from = 0;
  let found = false;
  for (;;) {
    const at = t.indexOf(q, from);
    if (at < 0) break;
    found = true;
    if (!isWordChar(t[at - 1])) return MATCH_RANK.wordStart;
    from = at + 1;
  }
  if (found) return MATCH_RANK.substring;
  const words = q.split(" ");
  if (words.length > 1 && words.every((w) => t.includes(w))) return MATCH_RANK.allWords;
  return null;
}

/** Rank of a query against one string, lower is better; null when it does not match. */
export function matchRank(query: string, text: string): number | null {
  const q = normalizeText(query);
  if (!q) return null;
  return rankNormalized(q, text);
}

/** What a record is matched on: its name, then any aliases. */
export type Searchable = string | { name: string; aliases?: readonly (string | null | undefined)[] | null };

/**
 * Score of a record: rank × 2, plus 1 when only an alias matched. Lower is better; null when
 * neither name nor alias matches.
 */
export function matchRecord(query: string, record: Searchable): number | null {
  const q = normalizeText(query);
  if (!q) return null;
  const name = typeof record === "string" ? record : record.name;
  const own = rankNormalized(q, name);
  if (own !== null && own <= MATCH_RANK.substring) return own * 2;
  let best = own === null ? null : own * 2;
  if (typeof record !== "string" && record.aliases) {
    for (const a of record.aliases) {
      if (!a) continue;
      const r = rankNormalized(q, a);
      if (r !== null && (best === null || r * 2 + 1 < best)) best = r * 2 + 1;
    }
  }
  return best;
}

export type Ranked<T> = { item: T; score: number; index: number };

/** Matching items, best first; ties keep their input order. Empty query: none. */
export function rankMatches<T>(
  items: readonly T[],
  query: string,
  toSearchable: (item: T) => Searchable,
): Ranked<T>[] {
  if (!normalizeText(query)) return [];
  const out: Ranked<T>[] = [];
  items.forEach((item, index) => {
    const score = matchRecord(query, toSearchable(item));
    if (score !== null) out.push({ item, score, index });
  });
  return out.sort((a, b) => a.score - b.score || a.index - b.index);
}

/** Matching items in their input order (for tables that keep their own sort). Empty query: all. */
export function filterMatches<T>(
  items: readonly T[],
  query: string,
  toSearchable: (item: T) => Searchable,
): readonly T[] {
  if (!normalizeText(query)) return items;
  return items.filter((item) => matchRecord(query, toSearchable(item)) !== null);
}

/**
 * Where the query appears in `text`, as [start, end) ranges of the original string, for
 * highlighting. Works through accents and case: "lux" marks "Lüx". Phrase first, else each word.
 */
export function highlightRanges(text: string, query: string): [number, number][] {
  const q = normalizeText(query);
  if (!q || !text) return [];
  // Normalise char by char so each normalised position maps back to an original index.
  let norm = "";
  const back: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < text.length; i++) {
    const piece = text[i]!.normalize("NFKD").replace(DIACRITICS, "").toLowerCase();
    for (const ch of piece) {
      const space = /\s/.test(ch);
      if (space && prevSpace) continue;
      norm += space ? " " : ch;
      back.push(i);
      prevSpace = space;
    }
  }
  const find = (needle: string): [number, number][] => {
    const ranges: [number, number][] = [];
    let from = 0;
    for (;;) {
      const at = norm.indexOf(needle, from);
      if (at < 0 || !needle) break;
      const end = at + needle.length - 1;
      ranges.push([back[at]!, back[end]! + 1]);
      from = at + needle.length;
    }
    return ranges;
  };
  const phrase = find(q);
  if (phrase.length) return phrase;
  const words = q.split(" ").filter(Boolean);
  if (words.length < 2) return [];
  const all = words.flatMap(find).sort((a, b) => a[0] - b[0]);
  // Merge overlaps.
  const merged: [number, number][] = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}
