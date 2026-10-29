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

GOLDMAN_PDF = RAW_SOURCES / "goldman_sub200m_funds.pdf"
SEED_INVESTORS_CSV = SEED_DIR / "seed_investors.csv"
SEED_ROUNDS_CSV = SEED_DIR / "seed_rounds.csv"

SCHEMA_VERSION = 1

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
