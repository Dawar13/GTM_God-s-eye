"""Region from a free-text location (PROJECT_CONTEXT §3).

Only unambiguous locations get a region: every place named must be in the
table below and all must agree. "Bay Area, Israel" -> western;
"Bay Area, China" -> None; anything unlisted -> None. Misspellings seen in the
Goldman list are listed explicitly so the table stays reviewable.
"""

import re

WESTERN = "western"
INDIA = "india"
OTHER = "other"

US_PLACES = {
    # country
    "us",
    "usa",
    "united states",
    "midwest",
    # California
    "bay area",
    "bay are",
    "sf",
    "san francisco",
    "palo alto",
    "berkeley",
    "california",
    "ca",
    "sacramento",
    "san diego",
    "los angeles",
    "la",
    # North-east
    "nyc",
    "ny",
    "new york",
    "newyork",
    "boston",
    "bosto",
    "cambridge",
    "ma",
    "philly",
    "philadelphia",
    "phiiladelphia",
    "pa",
    "conshohocken",
    "connecticut",
    "conneticut",
    "manchester",
    "nh",
    "maryland",
    # South and DC
    "washington dc",
    "washington d c",
    "dc",
    "virginia",
    "richmond",
    "atlanta",
    "ga",
    "miami",
    "florida",
    "fl",
    "s florida",
    "palm beach",
    "west palm beach",
    "austin",
    "texas",
    "tx",
    "dallas",
    "san antonio",
    "durham",
    "durahm",
    "north carolina",
    "south carolina",
    "nashville",
    "tennessee",
    "chattanooga",
    # Midwest and West
    "chicago",
    "chicaog",
    "illinois",
    "ohio",
    "columbus",
    "cincinnati",
    "oho",
    "detroit",
    "michigan",
    "mi",
    "grand rapids",
    "ann arbor",
    "indiana",
    "kansas",
    "kansas city",
    "missouri",
    "mo",
    "ks",
    "wichita",
    "omaha",
    "nebraska",
    "minneapolis",
    "mn",
    "minnesota",
    "north dakota",
    "milwaukee",
    "wi",
    "wisconsin",
    "seattle",
    "washington",
    "wa",
    "oregon",
    "utah",
    "slc",
    "salt lake city",
    "boulder",
    "colorado",
    "co",
    "denver",
    "new mexico",
    "las vegas",
    "nevada",
}

WESTERN_NON_US = {
    "israel",
    "israe",
    "tel aviv",
    "uk",
    "london",
    "england",
    "ireland",
    "dublin",
    "germany",
    "berlin",
    "netherlands",
    "amsterdam",
    "amsterdan",
    "france",
    "paris",
    "spain",
    "madrid",
    "madrin",
    "italy",
    "greece",
    "luxembourg",
    "switzerland",
    "finland",
    "sweden",
    "norway",
    "iceland",
    "canada",
    "toronto",
    "vancouver",
    "vancover",
    "montreal",
    "quebec",
    "ontario",
    "australia",
    "new zealand",
    "denmark",
    # regions named by regional arms ("Accel Europe & Israel")
    "europe",
    "nordics",
}

OTHER_PLACES = {
    "china",
    "hong kong",
    "singapore",
    "japan",
    "tokyo",
    "korea",
    "south korea",
    "taiwan",
    "taiwanese",
    "indonesia",
    "vietnam",
    "turkey",
    "istanbul",
    "dubai",
    "abu dhabi",
    "egypt",
    "kenya",
    "nairobi",
    "south africa",
    "tanzania",
    "brazil",
    "argentina",
    "chile",
    "mexico",
    "mexico city",
    "buenos aires",
    # regions named by regional arms ("Partech Africa")
    "africa",
    "asia",
    "latam",
    "mena",
}

INDIA_PLACES = {"india", "bangalore", "bengaluru", "mumbai", "delhi", "new delhi", "pune"}

PLACE_REGION: dict[str, str] = {
    **{p: WESTERN for p in US_PLACES | WESTERN_NON_US},
    **{p: OTHER for p in OTHER_PLACES},
    **{p: INDIA for p in INDIA_PLACES},
}


# ISO 3166-1 alpha-2 -> region (PROJECT_CONTEXT §3): US, Canada, UK, EU,
# Switzerland, Nordics, Israel, Australia/NZ are western; India is india.
WESTERN_COUNTRIES = {
    "US",
    "CA",
    "GB",
    "IE",
    "CH",
    "IL",
    "AU",
    "NZ",
    "NO",
    "IS",
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "ES",
    "SE",
}


def region_for_country(code: str | None) -> str | None:
    if not code:
        return None
    code = code.upper()
    if code in WESTERN_COUNTRIES:
        return WESTERN
    if code == "IN":
        return INDIA
    return OTHER


def _normalise(part: str) -> str:
    part = re.sub(r"[.()]", " ", part.lower())
    part = re.sub(r"\bhq\b", " ", part)
    return re.sub(r"\s+", " ", part).strip()


def split_places(location: str) -> list[str]:
    parts = re.split(r",|/|;|\(|\)|\band\b", location or "")
    return [p for p in (_normalise(x) for x in parts) if p]


def region_for_location(location: str | None) -> str | None:
    """western / india / other when every place is known and agrees; otherwise None."""
    places = split_places(location or "")
    if not places:
        return None
    regions = {PLACE_REGION.get(p) for p in places}
    if None in regions or len(regions) != 1:
        return None
    return regions.pop()
