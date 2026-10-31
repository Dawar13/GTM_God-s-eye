"""Paths, cutoffs and the shared taxonomy.

The taxonomy and other enums must match src/lib/schema/enums.ts; tests/test_config.py
checks them against the generated data/schemas/enums.schema.json.
"""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

DATA = REPO_ROOT / "data"
RAW_SOURCES = DATA / "raw" / "sources"
SEED_DIR = DATA / "seed"
INTERIM = DATA / "interim"
PROCESSED = DATA / "processed"
SCHEMAS = DATA / "schemas"
RESEARCH = DATA / "research"
RESEARCH_CACHE = RESEARCH / "cache"
# Resolver source id for names that come from research files (not a user list).
RESEARCH_SOURCE_ID = "research"
# Other domains of one company, each stated in a research file's identity check.
# Companies match by domain first, and a different domain otherwise blocks a name match.
COMPANY_DOMAIN_ALIASES = {
    "tandemai.io": "tandem.inc",  # Tandem's product domain (cache/tandem.json)
}

GOLDMAN_PDF = RAW_SOURCES / "goldman_sub200m_funds.pdf"
SEED_INVESTORS_CSV = SEED_DIR / "seed_investors.csv"
SEED_ROUNDS_CSV = SEED_DIR / "seed_rounds.csv"
ACCELERATORS_CSV = SEED_DIR / "accelerators_2026.csv"

SCHEMA_VERSION = 2

# A fund is "fresh" if it closed on or after this date (24 months before 2026-10-29).
FRESHNESS_CUTOFF = "2024-10-29"

# The user handed over the Phase 0 source files on this date. It is stamped as
# retrieved_at on user-supplied sources, so re-running the pipeline later does
# not rewrite every record.
USER_SOURCES_RECEIVED = "2026-10-29"

# rapidfuzz token_sort_ratio on normalised names; at or above this, names merge.
NAME_MATCH_THRESHOLD = 92

# Words dropped from names for matching only, never for display.
NAME_MATCH_STOPWORDS = frozenset(
    {
        "the",
        "ventures",
        "venture",
        "capital",
        "partners",
        "partner",
        "vc",
        "fund",
        "funds",
        "management",
        "investments",
        "investment",
        "group",
        "llc",
        "lp",
        "inc",
        "co",
        "and",
    }
)

# Names (lower-case, as written in a source) that normalise alike but are
# different firms. Checked before every merge, exact or fuzzy. Each pair was
# found reviewing data/processed/merges.json; see docs/DECISIONS.md.
DO_NOT_MERGE: frozenset[frozenset[str]] = frozenset(
    frozenset(pair)
    for pair in [
        ("collide capital", "collider ventures"),  # NYC fintech vs Israel
        ("corigin ventures", "origin ventures"),  # NYC vs Chicago
        ("house capital", "the house fund"),  # Launch House vs Berkeley
        ("house capital", "house fund"),
        ("amplify ventures", "amplify partners"),  # Amplify.LA vs Bay Area
        ("atx seed ventrues", "atx ventures"),  # ATX Seed Ventures vs ATX Venture Partners
        ("idg capital", "idg ventures"),  # China vs Bay Area
        ("idg capital", "idg"),
        ("bain capital", "bain capital ventures"),  # parent firm vs its venture arm
        ("atomic", "atomico"),  # SF startup studio vs London VC
        ("cleo capital", "cleo ventures"),  # Bay Area (USD) vs EUR fund
        ("human ventures", "human capital"),  # NYC venture studio vs SF growth fund
        ("founders fund", "founders capital"),  # different firms
        ("eqt", "eqt ventures"),  # PE parent vs its venture arm
        ("b capital", "capital 2b"),  # different firms (fuzzy 94.7)
        ("the veteran fund", "veteran ventures capital"),  # different firms
        ("anterra capital", "vanterra"),  # different firms (fuzzy 93.3)
        ("capital f", "tf capital"),  # different firms (fuzzy 94.7)
        ("intel", "intel capital"),  # parent company vs its venture arm
        ("intel", "intel capital diversity fund"),  # the fund is Intel Capital's
        ("f2 venture capital", "ff venture capital"),  # different firms (fuzzy 94.4)
        ("capital-a", "a.capital"),  # different firms (fuzzy 100 on reordered words)
        ("capital factory", "factory"),  # Austin accelerator vs another firm
        ("mozilla", "mozilla ventures"),  # parent vs its venture arm
        # A bare "Amplify" in a release can be either firm; it stays its own record.
        ("amplify ventures", "amplify"),
        ("amplify partners", "amplify"),
        ("mercato partners", "mercator partners"),  # different firms (fuzzy 93.3)
        ("shasta ventures", "shastra vc"),  # different firms (fuzzy 92.3)
        ("space vc", "space capital"),  # different firms
        # Parent company vs its venture arm.
        ("toyota", "toyota ventures"),
        ("rtx", "rtx ventures"),
        ("point72", "point72 ventures"),
        ("ms&ad", "ms&ad ventures"),
        # Bare names that fit more than one firm (SBI Investment / State Bank of India;
        # NGP Capital / NGP Energy; several Ascends).
        ("sbi", "sbi ventures"),
        ("ngp", "ngp capital"),
        ("ascend", "ascend venture capital"),
        # Batch 7: parent vs venture arm, and stopword collisions between different firms.
        ("google", "google ventures"),
        ("coreweave", "coreweave ventures"),
        ("scale capital", "scale venture partners"),
        ("better capital", "better ventures"),
        ("pioneer capital", "pioneer fund"),
        # Batch 8.
        ("define ventures", "defined capital"),  # different firms (fuzzy 92.3)
        ("s ventures", "s3 ventures"),  # short keys collide (fuzzy 95.2)
        ("s ventures", "se ventures"),
        ("s3 ventures", "se ventures"),
        ("trinity capital", "trinity ventures"),  # venture lender vs VC firm
        ("cerberus ventures", "cerberus capital management"),  # VC vs PE firm
        ("two sigma", "two sigma ventures"),  # parent vs venture arm
        ("valor", "valor ventures"),  # bare "Valor" fits several firms
        # Batch 9.
        ("revolution ventures", "evolution ventures"),  # fuzzy 94.7
        ("inventure", "inventures"),  # fuzzy 94.7
        ("marathon venture capital", "marathon fund"),
        ("together fund", "ventures together"),
        ("fusion fund", "fusion vc"),
        ("tower research capital", "tower research ventures"),  # parent vs venture arm
        # Final batch: different firms that share a key or match fuzzily.
        ("creator ventures", "the creator fund"),
        ("kindred ventures", "kindred capital"),
        ("swell vc", "swell partners"),
        ("january ventures", "january capital"),
        ("longevity fund", "longevity venture partners"),
        ("origin ventures", "origins fund"),
        ("spartan", "sparta group llc"),
        ("flourish ventures", "1flourish"),
        ("future fund", "future ventures"),
        ("latitude", "latitud ventures"),
        ("shaper capital", "shapers"),
        ("newark venture partners", "newmark"),
        ("advantage capital", "advantage vc"),
        ("neon fund", "neon ventures"),
        ("outset capital", "outset ventures"),
        # Parent vs venture arm.
        ("maverick ventures", "maverick capital"),
        ("galaxy ventures", "galaxy"),
        ("obos", "obos ventures"),
        # Bare or near names that fit more than one firm.
        ("neo", "neo ventures"),
        ("gsr ventures", "gsr"),
        ("valkyrie", "valkyrie ventures"),
        ("daybreak", "daybreak ventures"),  # research ruled out a Hague "Daybreak Ventures"
    ]
)

SECTORS = (
    "ai_infra",
    "ai_apps_agents",
    "industrial_manufacturing",
    "robotics_physical_ai",
    "defense_dual_use",
    "hardware_deeptech",
    "space",
    "climate_energy",
    "mobility_ev",
    "supply_chain_logistics",
    "enterprise_saas",
    "dev_tools",
    "fintech",
    "health_bio",
    "consumer",
    "crypto_web3",
)

REGIONS = ("western", "india", "other")
INVESTOR_TYPES = (
    "vc",
    "cvc",
    "angel",
    "syndicate",
    "family_office",
    "sovereign",
    "asset_manager",
    "accelerator",
    "incubator",
    "strategic",
    "individual",
)
ROUND_STAGES = (
    "pre_seed",
    "seed",
    "series_a",
    "series_b",
    "series_c_plus",
    "growth",
    "strategic",
    "undisclosed",
)
SOURCE_KINDS = ("primary", "secondary", "user_supplied")

# --- Phase 1 analytics (PHASE_1 §8, PROJECT_CONTEXT §4) -------------------------

RANDOM_STATE = 42
REFERENCE_DATE = "2026-10-30"

# Our planned round. Unknown (PROJECT_CONTEXT §1): the default is an assumption.
RAISE_SIZE_USD = 1_000_000

STAGE_SCORES = {
    "pre_seed": 1.0,
    "seed": 0.8,
    "series_a": 0.6,
    "series_b": 0.4,
    "series_c_plus": 0.2,
    "growth": 0.1,
}

GENERALIST_ENTROPY = 0.85
# Rounds with a known company sector a portfolio needs before it shapes a thesis vector.
MIN_PORTFOLIO_ROUNDS = 3
CLUSTER_K_RANGE = (4, 10)

# Layers that count as "our space" for portfolio adjacency.
OUR_LAYERS = frozenset({"design_intent", "process_planning", "plant_ops", "quality_vision"})
NEIGHBOUR_LAYERS = frozenset({"autonomy_tooling", "robotics", "full_stack_factory"})

# Keyword map for the stated-thesis vector: sector -> phrases (lower case).
# Matched against thesis text and listed focus; every hit is logged in `inputs`.
THESIS_KEYWORDS: dict[str, tuple[str, ...]] = {
    "ai_infra": (
        "ai infrastructure",
        "infra software",
        "compute",
        "model infrastructure",
        "data infrastructure",
    ),
    "ai_apps_agents": (
        "applied ai",
        "ai-native",
        "ai native",
        "vertical ai",
        "ai agents",
        "agentic",
        "ai-first",
        "generative ai",
        "ai apps",
    ),
    "industrial_manufacturing": (
        "manufactur",
        "industrial",
        "factory",
        "factories",
        "industry 4.0",
    ),
    "robotics_physical_ai": (
        "robot",
        "physical ai",
        "embodied",
        "autonomous systems",
        "automation",
    ),
    "defense_dual_use": ("defense", "defence", "dual-use", "dual use", "national security"),
    "hardware_deeptech": (
        "hardware",
        "deep tech",
        "deeptech",
        "hard tech",
        "semiconductor",
        "frontier tech",
    ),
    "space": ("space", "aerospace", "satellite"),
    "climate_energy": ("climate", "energy", "decarbon", "sustainab", "cleantech"),
    "mobility_ev": ("mobility", "electric vehicle", " ev ", "automotive", "transportation"),
    "supply_chain_logistics": ("supply chain", "logistics", "procurement", "freight"),
    "enterprise_saas": (
        "saas",
        "b2b software",
        "enterprise software",
        "enterprise",
        "future of work",
    ),
    "dev_tools": ("developer", "dev tools", "devtools", "open source"),
    "fintech": ("fintech", "financial services", "payments", "insurtech"),
    "health_bio": ("health", "bio", "medical", "life science", "pharma"),
    "consumer": ("consumer", "d2c", "brands", "gaming", "media", "edtech"),
    "crypto_web3": ("crypto", "web3", "blockchain", "defi"),
}
AGNOSTIC_PHRASES = (
    "sector-agnostic",
    "sector agnostic",
    "generalist",
    "industry-agnostic",
    "agnostic",
)
