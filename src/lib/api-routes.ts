/** The cached JSON route handlers the browser loads data from (see src/lib/client-index.ts). */
export const API = {
  filterIndex: "/api/filter-index",
  directoryRows: "/api/directory-rows",
  strategyRows: "/api/strategy-rows",
  paletteIndex: "/api/palette-index",
  graph: "/api/graph",
} as const;
