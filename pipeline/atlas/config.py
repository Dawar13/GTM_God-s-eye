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
LANDSCAPE_MAP_CSV = SEED_DIR / "physical_ai_market_map_2026-11-01.csv"
LANDSCAPE_YC_CSV = SEED_DIR / "yc_physical_ai_2026-11-01.csv"
LANDSCAPE_SF_CSV = SEED_DIR / "sf_robotics_industrial_ai_2026-11-11.csv"
LANDSCAPE_ROBOTICS_MAP_CSV = SEED_DIR / "robotics_market_map_q4_2026_2026-11-12.csv"
PHYSICAL_AI_CSV = SEED_DIR / "physical_ai_investors_2026-11-01.csv"
VC_INDIA_CSV = SEED_DIR / "vc_investing_in_india_2026-11-12.csv"
# Investor lists received 2026-11-12, transcribed from data/raw/sources by
# atlas.ingest.transcribe_lists into one shared layout (see seeds.LISTED).
NYC_SEED_VC_CSV = SEED_DIR / "nyc_seed_vc_list_2026-11-12.csv"
ESTES_SEED_FUNDS_CSV = SEED_DIR / "estes_750_seed_funds_2026-11-12.csv"
DOCSEND_EARLY_CSV = SEED_DIR / "docsend_early_investors_2026-11-12.csv"
AUSTRALIA_NZ_CSV = SEED_DIR / "australia_nz_investors_2026-11-12.csv"
US_ANGELS_CSV = SEED_DIR / "us_angel_investors_2026-11-12.csv"
CUSTOMERS_DIR = DATA / "raw" / "customers"
# Target-customer workbooks keyed by list: (file, received, ((sheet, archetype fit), ...)).
# Mumbai–Pune and Bengaluru (prepared 2026-10-15) came with the Phase 0 sources and do not
# grade fit. Hyderabad (prepared 2026-11-09) holds the high-fit archetypes on "Targets" and
# the medium and medium-high ones on "Adjacent (medium fit)".
CUSTOMER_WORKBOOKS: dict[str, tuple[str, str, tuple[tuple[str, str | None], ...]]] = {
    "mumbai_pune": ("Industrial_AI_Target_List.xlsx", "2026-10-29", (("Targets", None),)),
    "bengaluru": ("Industrial_AI_Target_List_Bangalore.xlsx", "2026-10-29", (("Targets", None),)),
    "hyderabad": (
        "Industrial_AI_Target_List_Hyderabad.xlsx",
        "2026-11-09",
        (("Targets", "high"), ("Adjacent (medium fit)", "medium")),
    ),
}

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
        # Physical-AI list (2026-11-01): fund arm vs parent, and a fuzzy clash.
        ("bosch", "bosch ventures"),
        ("samsung", "samsung ventures"),
        ("momenta ventures", "moment ventures"),  # industrial-IoT fund vs Moment Ventures (fuzzy)
        # VC investing in India list (2026-11-12).
        ("henkel", "henkel ventures"),  # parent vs its venture arm
        ("super capital", "super ventures"),  # Paris vs the Goldman-list fund
        ("founder partners", "founders fund"),  # fuzzy 93.3 on the shared key
        ("founder partners", "founders capital"),
        (
            "vertex ventures southeast asia & india",
            "vertex ventures",
        ),  # vertexventures.sg vs another Vertex fund
        # Lists received 2026-11-12: different firms (web domain and city differ).
        ("evolution vc partners", "revolution ventures"),  # fuzzy 94.7
        ("inventures", "nventures"),  # inventures.com vs NVIDIA's NVentures
        ("tomorrow ventures", "tomorrow capital"),  # tomorrowvc.com vs tomorrowcapital.in
        ("iseed ventures", "iseed"),  # iseedvc.com vs iseed.vc (New Delhi)
        ("nextwave ventures", "next wave ventures"),  # Carlsbad vs Longmont
        ("nextgen ventures", "nextgen venture partners"),  # Melbourne vs Washington DC
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

# --- Target customers (data/raw/customers) ------------------------------------------
# Enums mirror src/lib/schema/enums.ts (tests/test_config.py checks them).

CUSTOMER_LISTS = ("mumbai_pune", "bengaluru", "hyderabad")
CUSTOMER_FITS = ("high", "medium")
CUSTOMER_REVENUE_BANDS = ("lt_100", "100_500", "500_2000", "2000_10000", "10000_50000", "gt_50000")
CUSTOMER_TEAM_BANDS = ("lt_500", "500_2000", "2000_10000", "10000_50000", "gt_50000")
CUSTOMER_SECTORS = (
    "defence_aerospace",
    "automotive",
    "ev_batteries",
    "metals_machining",
    "machinery",
    "electrical_electronics",
    "hardware_devices",
    "appliances_durables",
    "chemicals",
    "pharma_life_sciences",
    "packaging_plastics",
    "cement_building",
    "food_fmcg",
    "textiles",
    "power_utilities",
    "contract_manufacturing",
)
CUSTOMER_AREAS = (
    "mumbai",
    "navi_mumbai",
    "thane",
    "palghar",
    "raigad",
    "pune",
    "satara",
    "nashik",
    "ahmednagar",
    "aurangabad",
    "kolhapur",
    "sangli",
    "solapur",
    "ratnagiri",
    "bengaluru_metro",
    "tumakuru",
    "mysuru",
    "hassan",
    "kolar",
    "hosur",
    "krishnagiri",
    "hyderabad_metro",
    "telangana_outer",
    "andhra_pradesh",
    "gujarat",
)

# Each list category (lower case, as worded) -> industry groups. The lists word categories
# differently, and some combine two industries, so a category can map to two groups.
CUSTOMER_CATEGORY_SECTORS: dict[str, tuple[str, ...]] = {
    "drones, defence, aerospace and space": ("defence_aerospace",),
    "defence and aerospace": ("defence_aerospace",),
    "defence and aerospace psus": ("defence_aerospace",),
    "aerospace and precision engineering": ("defence_aerospace",),
    "ev and new mobility": ("ev_batteries",),
    "ev and powertrain": ("ev_batteries",),
    "ev and batteries": ("ev_batteries",),
    "auto components and vehicles": ("automotive",),
    "auto components": ("automotive",),
    "auto components and tyres (mnc/large)": ("automotive",),
    "automotive oems": ("automotive",),
    "castings, forgings, stampings and machining": ("metals_machining",),
    "metals, castings and steel": ("metals_machining",),
    "metals and materials": ("metals_machining",),
    "steel, metals and petrochemicals": ("metals_machining", "chemicals"),
    "industrial equipment and machinery": ("machinery",),
    "machine tools and industrial equipment": ("machinery",),
    "electrical, electronics, instruments and machinery": ("electrical_electronics", "machinery"),
    "engineering and electrical conglomerates": ("electrical_electronics", "machinery"),
    "electrical and engineering": ("electrical_electronics", "machinery"),
    "electrical, cables and appliances": ("electrical_electronics", "appliances_durables"),
    "electronics, ems and medical devices": ("electrical_electronics",),
    "electronics and telecom": ("electrical_electronics",),
    "electronics manufacturing": ("electrical_electronics",),
    "consumer durables": ("appliances_durables",),
    "consumer goods and precision": ("appliances_durables",),
    "specialty chemicals and pharma": ("chemicals", "pharma_life_sciences"),
    "chemicals and paints": ("chemicals",),
    "pharma": ("pharma_life_sciences",),
    "pharma and vaccines": ("pharma_life_sciences",),
    "pharma and biotech": ("pharma_life_sciences",),
    "pharma, biotech and nutraceuticals": ("pharma_life_sciences",),
    "medical devices and pharma (mnc)": ("pharma_life_sciences",),
    "packaging, plastics and materials": ("packaging_plastics",),
    "plastics and packaging": ("packaging_plastics",),
    "packaging and plastics": ("packaging_plastics",),
    "food, dairy and consumer": ("food_fmcg",),
    "food and beverages": ("food_fmcg",),
    "food and dairy": ("food_fmcg",),
    "food, beverages and fmcg": ("food_fmcg",),
    "food, beverages and dairy": ("food_fmcg",),
    "textiles and apparel": ("textiles",),
    "power and utilities": ("power_utilities",),
    "contract manufacturing": ("contract_manufacturing",),
    # Hyderabad list: archetype names (the Adjacent sheet's leading number is dropped).
    "auto and ev components and vehicles": ("automotive", "ev_batteries"),
    "precision engineering, aerospace and defence suppliers": (
        "defence_aerospace",
        "metals_machining",
    ),
    "foundries and forgings": ("metals_machining",),
    "electronics manufacturing (ems, defence, power, solar, batteries)": (
        "electrical_electronics",
    ),
    "specialty and batch chemicals (incl. api intermediates)": (
        "chemicals",
        "pharma_life_sciences",
    ),
    "hardware oems (drones, space, medical devices)": ("hardware_devices",),
    "cement and building materials": ("cement_building",),
    "fmcg, food and beverage": ("food_fmcg",),
    "pharma formulations, injectables, biologics": ("pharma_life_sciences",),
    "plastics, rubber and packaging": ("packaging_plastics",),
    "steel and metals processing": ("metals_machining",),
}

# Place names the address column uses -> area. Only unambiguous names are listed (Khandala,
# for one, is both a Satara MIDC and a Pune hill town, so it maps to nothing). Longer names
# win, so "Navi Mumbai" is not also read as "Mumbai". HQs outside the lists' regions (Chennai,
# Kolkata, Noida, Faridabad, Goa) are left out: the lists are about plants to visit.
# The Bengaluru list's notes count Bidadi, Hoskote, Devanahalli, Doddaballapur and
# Narasapura as Bengaluru metro. The Hyderabad list's notes name Hyderabad metro's
# industrial belt (Balanagar to Medchal) and the Telangana sites within about 150 km
# (Choutuppal to the Suryapet cement belt); those two groups are its areas, plus Andhra
# Pradesh. District names that span both (Sangareddy, Rangareddy) and names with a
# namesake elsewhere (Ibrahimpatnam, Gandhinagar) map to nothing.
CUSTOMER_PLACES: dict[str, str] = {
    # Mumbai–Pune list
    "mumbai": "mumbai",
    "vikhroli": "mumbai",
    "powai": "mumbai",
    "kandivali": "mumbai",
    "trombay": "mumbai",
    "navi mumbai": "navi_mumbai",
    "mahape": "navi_mumbai",
    "nerul": "navi_mumbai",
    "rabale": "navi_mumbai",
    "airoli": "navi_mumbai",
    "taloja": "navi_mumbai",
    "thane": "thane",
    "ambernath": "thane",
    "dombivli": "thane",
    "mumbra": "thane",
    "kalwa": "thane",
    "vasind": "thane",
    "palghar": "palghar",
    "tarapur": "palghar",
    "boisar": "palghar",
    "wada": "palghar",
    "raigad": "raigad",
    "patalganga": "raigad",
    "roha": "raigad",
    "mahad": "raigad",
    "nagothane": "raigad",
    "khopoli": "raigad",
    "dolvi": "raigad",
    "amdoshi": "raigad",
    "pune": "pune",
    "chakan": "pune",
    "talegaon": "pune",
    "ranjangaon": "pune",
    "shikrapur": "pune",
    "hinjewadi": "pune",
    "pimpri": "pune",
    "chinchwad": "pune",
    "akurdi": "pune",
    "bhosari": "pune",
    "hadapsar": "pune",
    "mundhwa": "pune",
    "kothrud": "pune",
    "dapodi": "pune",
    "sanaswadi": "pune",
    "manjari": "pune",
    "kurkumbh": "pune",
    "urse": "pune",
    "baramati": "pune",
    "manchar": "pune",
    "walchandnagar": "pune",
    "satara": "satara",
    "wai": "satara",
    "phaltan": "satara",
    "shirwal": "satara",
    "nashik": "nashik",
    "ojhar": "nashik",
    "ahmednagar": "ahmednagar",
    "aurangabad": "aurangabad",
    "waluj": "aurangabad",
    "kolhapur": "kolhapur",
    "kagal": "kolhapur",
    "sangli": "sangli",
    "kirloskarvadi": "sangli",
    "bhilawadi": "sangli",
    "solapur": "solapur",
    "ratnagiri": "ratnagiri",
    "lote": "ratnagiri",
    "kandla": "gujarat",
    "hazira": "gujarat",
    # Bengaluru list
    "bengaluru": "bengaluru_metro",
    "peenya": "bengaluru_metro",
    "bommasandra": "bengaluru_metro",
    "electronic city": "bengaluru_metro",
    "whitefield": "bengaluru_metro",
    "jalahalli": "bengaluru_metro",
    "kr puram": "bengaluru_metro",
    "rajajinagar": "bengaluru_metro",
    "yelahanka": "bengaluru_metro",
    "sompura": "bengaluru_metro",
    "nelamangala": "bengaluru_metro",
    "naganathapura": "bengaluru_metro",
    "makali": "bengaluru_metro",
    "harohalli": "bengaluru_metro",
    "tumakuru road": "bengaluru_metro",
    "bidadi": "bengaluru_metro",
    "hoskote": "bengaluru_metro",
    "devanahalli": "bengaluru_metro",
    "doddaballapur": "bengaluru_metro",
    "narasapura": "bengaluru_metro",
    "biocon park": "bengaluru_metro",
    "tumakuru": "tumakuru",
    "tiptur": "tumakuru",
    "mysuru": "mysuru",
    "nanjangud": "mysuru",
    "hassan": "hassan",
    "kgf": "kolar",
    "hosur": "hosur",
    "shoolagiri": "hosur",
    "krishnagiri": "krishnagiri",
    # Hyderabad list: the city and its industrial belt
    "hyderabad": "hyderabad_metro",
    "secunderabad": "hyderabad_metro",
    "begumpet": "hyderabad_metro",
    "gachibowli": "hyderabad_metro",
    "raidurg": "hyderabad_metro",
    "kondapur": "hyderabad_metro",
    "banjara hills": "hyderabad_metro",
    "jubilee hills": "hyderabad_metro",
    "somajiguda": "hyderabad_metro",
    "red hills": "hyderabad_metro",
    "kavuri hills": "hyderabad_metro",
    "kukatpally": "hyderabad_metro",
    "balanagar": "hyderabad_metro",
    "sanathnagar": "hyderabad_metro",
    "azamabad": "hyderabad_metro",
    "kanchanbagh": "hyderabad_metro",
    "lalapet": "hyderabad_metro",
    "moula ali": "hyderabad_metro",
    "kushaiguda": "hyderabad_metro",
    "ecil": "hyderabad_metro",
    "nacharam": "hyderabad_metro",
    "mallapur": "hyderabad_metro",
    "uppal": "hyderabad_metro",
    "cherlapally": "hyderabad_metro",
    "jeedimetla": "hyderabad_metro",
    "quthbullapur": "hyderabad_metro",
    "petbasheerabad": "hyderabad_metro",
    "bahadurpally": "hyderabad_metro",
    "dundigal": "hyderabad_metro",
    "bachupally": "hyderabad_metro",
    "gagillapur": "hyderabad_metro",
    "medchal": "hyderabad_metro",
    "genome valley": "hyderabad_metro",
    "turkapally": "hyderabad_metro",
    "bollaram": "hyderabad_metro",
    "jinnaram": "hyderabad_metro",
    "kazipally": "hyderabad_metro",
    "gaddapotharam": "hyderabad_metro",
    "bonthapally": "hyderabad_metro",
    "gummadidala": "hyderabad_metro",
    "pashamylaram": "hyderabad_metro",
    "patancheru": "hyderabad_metro",
    "isnapur": "hyderabad_metro",
    "rudraram": "hyderabad_metro",
    "ameenpur": "hyderabad_metro",
    "sultanpur": "hyderabad_metro",
    "shamshabad": "hyderabad_metro",
    "mamidipally": "hyderabad_metro",
    "adibatla": "hyderabad_metro",
    "kongara kalan": "hyderabad_metro",
    "maheshwaram": "hyderabad_metro",
    "mankhal": "hyderabad_metro",
    "raviryal": "hyderabad_metro",
    "fab city": "hyderabad_metro",
    "hardware park": "hyderabad_metro",
    "ramachandrapuram": "hyderabad_metro",  # BHEL township; the only one in the list
    # Hyderabad list: Telangana sites within about 150 km, and their districts
    "choutuppal": "telangana_outer",
    "bibinagar": "telangana_outer",
    "pochampally": "telangana_outer",
    "bommalaramaram": "telangana_outer",
    "yadagirigutta": "telangana_outer",
    "yadadri": "telangana_outer",
    "chityal": "telangana_outer",
    "nalgonda": "telangana_outer",
    "suryapet": "telangana_outer",
    "mellacheruvu": "telangana_outer",
    "sadasivpet": "telangana_outer",
    "zaheerabad": "telangana_outer",
    "hathnoor": "telangana_outer",
    "digwal": "telangana_outer",
    "kandi": "telangana_outer",
    "yeddumailaram": "telangana_outer",
    "toopran": "telangana_outer",
    "kothur": "telangana_outer",
    "mekaguda": "telangana_outer",
    "shadnagar": "telangana_outer",
    "divitipally": "telangana_outer",
    "mahabubnagar": "telangana_outer",
    "siddipet": "telangana_outer",
    "medak": "telangana_outer",
    "kamareddy": "telangana_outer",
    "vikarabad": "telangana_outer",
    "tandur": "telangana_outer",
    "mancherial": "telangana_outer",
    "peddapalli": "telangana_outer",
    "ramagundam": "telangana_outer",
    "paloncha": "telangana_outer",
    "nandigama": "telangana_outer",  # Rangareddy, as the list says; not the Andhra town
    # Hyderabad list: Andhra Pradesh plants of Hyderabad firms
    "ap": "andhra_pradesh",
    "andhra pradesh": "andhra_pradesh",
    "visakhapatnam": "andhra_pradesh",
    "srikakulam": "andhra_pradesh",
    "ongole": "andhra_pradesh",
    "kurnool": "andhra_pradesh",
    "tuni": "andhra_pradesh",
    "gujarat": "gujarat",
    "ankleshwar": "gujarat",
}
