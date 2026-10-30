/**
 * Route registry for the shell. Pages use it for generateStaticParams and
 * sub-tab navigation; the left rail uses the section list.
 */

export type SubView = {
  slug: string;
  label: string;
  /** One sentence on what this view will show. Used by empty states. */
  summary: string;
  /** Which phase fills it. */
  phaseNote: string;
};

const CALCULATOR_PHASES = "Phase 1 builds and tests the math; Phase 2 builds the calculator.";

export const VC_MATH_TOOLS = [
  {
    slug: "round-builder",
    label: "Round builder",
    summary: "Set pre- or post-money and new money to see ownership bars and price per share.",
    phaseNote: CALCULATOR_PHASES,
  },
  {
    slug: "cap-table",
    label: "Cap table",
    summary: "Model founders, option pool and rounds one to n, and see founder ownership at exit.",
    phaseNote: CALCULATOR_PHASES,
  },
  {
    slug: "option-pool",
    label: "Option pool shuffle",
    summary:
      "Compare the headline pre-money with the effective pre-money once the pool is carved out.",
    phaseNote: CALCULATOR_PHASES,
  },
  {
    slug: "safe",
    label: "SAFE",
    summary:
      "Convert post-money and pre-money SAFEs into a priced round, side by side, with a dilution waterfall.",
    phaseNote: CALCULATOR_PHASES,
  },
  {
    slug: "convertible-note",
    label: "Convertible note",
    summary:
      "Accrue interest on a note and see how many shares it converts into at the next round.",
    phaseNote: CALCULATOR_PHASES,
  },
  {
    slug: "liquidation",
    label: "Liquidation waterfall",
    summary:
      "See who gets what at every exit value across preference multiples, participation and seniority.",
    phaseNote: CALCULATOR_PHASES,
  },
  {
    slug: "vc-method",
    label: "VC method",
    summary: "Work back from a target exit and return multiple to an implied post- and pre-money.",
    phaseNote: CALCULATOR_PHASES,
  },
  {
    slug: "fund-math",
    label: "Fund math",
    summary:
      "Check whether one company can return the fund, and why a $50M fund and a $1B fund want different outcomes.",
    phaseNote: CALCULATOR_PHASES,
  },
  {
    slug: "power-law",
    label: "Power law",
    summary: "Simulate a portfolio thousands of times and see the spread of fund multiples.",
    phaseNote: CALCULATOR_PHASES,
  },
  {
    slug: "india-instruments",
    label: "India instruments",
    summary:
      "CCPS, CCD and iSAFE basics, with a check against the FEMA pricing floor for non-resident investment.",
    phaseNote:
      "Phase 1 verifies the current rules, including angel tax; Phase 2 builds the explainer.",
  },
] as const satisfies readonly SubView[];

export const INVESTOR_VIEWS = [
  {
    slug: "directory",
    label: "Directory",
    summary:
      "Every tracked investor in one sortable table, with chips for region, fund freshness, maturity, stage and type.",
    phaseNote: "Phase 0 lists raw rows; Phase 2 builds the full table.",
  },
  {
    slug: "thesis-map",
    label: "Thesis map",
    summary:
      "Investors placed by what they back and clustered by thesis, with a fit view for industrial and physical AI.",
    phaseNote: "Phase 1 computes clusters and layout; Phase 2 draws the map.",
  },
  {
    slug: "capital",
    label: "Capital bubbles",
    summary: "Check size, stage and industrial affinity in 3D, with bubbles sized by latest fund.",
    phaseNote: "Phase 1 computes the axes; Phase 2 draws the chart.",
  },
  {
    slug: "network",
    label: "Network",
    summary:
      "Investors linked to the companies they backed, with ego, co-investment and competitor views.",
    phaseNote: "Phase 1 builds the graph and its metrics; Phase 2 draws it.",
  },
  {
    slug: "accelerators",
    label: "Accelerators",
    summary:
      "Accelerator and residency programmes with their headline terms, linked to the firms that run them.",
    phaseNote: "Phase 1 lists the programmes and terms; Phase 2 adds filters and term comparison.",
  },
] as const satisfies readonly SubView[];

export function findSubView<T extends SubView>(views: readonly T[], slug: string): T | undefined {
  return views.find((v) => v.slug === slug);
}

export const SECTIONS = [
  { key: "command", label: "Command", href: "/", prefix: null },
  { key: "vc-math", label: "VC math", href: "/vc-math/round-builder", prefix: "/vc-math" },
  { key: "investors", label: "Investors", href: "/investors/directory", prefix: "/investors" },
  { key: "competitors", label: "Competitors", href: "/competitors", prefix: "/competitors" },
  { key: "strategy", label: "Strategy", href: "/strategy", prefix: "/strategy" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

export function isSectionActive(section: (typeof SECTIONS)[number], pathname: string): boolean {
  return section.prefix === null ? pathname === "/" : pathname.startsWith(section.prefix);
}
