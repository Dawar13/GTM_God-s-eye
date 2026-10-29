"""Investor names: cleaning for display, and keys for matching.

Display names keep generic words ("Ventures", "Capital", "Fund"); only the
matching key drops them (PHASE_0 §6.4).
"""

import re
from dataclasses import dataclass

from rapidfuzz import fuzz
from slugify import slugify

from atlas.config import NAME_MATCH_STOPWORDS

# Trailing words that name a vehicle, not the firm: "Sequoia Seed Fund",
# "Greycroft Growth", "BoldStart Ventures Opportunity Fund". Dropped from the
# end of the matching key only.
VEHICLE_QUALIFIERS = frozenset(
    {
        "seed",
        "opportunity",
        "opp",
        "growth",
        "scout",
        "climate",
        "creator",
        "select",
        "early",
        "diversity",
        "hardware",
        "secondary",
    }
)

# A trailing region makes a separate investor with a parent brand, like
# Accel US / Accel India (DECISIONS: Accel split rule).
REGION_QUALIFIERS = {
    "us": "US",
    "usa": "USA",
    "europe": "Europe",
    "india": "India",
    "israel": "Israel",
    "canada": "Canada",
    "uk": "UK",
    "asia": "Asia",
    "africa": "Africa",
    "latam": "LatAm",
    "japan": "Japan",
    "china": "China",
    "korea": "Korea",
    "germany": "Germany",
    "france": "France",
    "nordics": "Nordics",
    "mena": "MENA",
    "australia": "Australia",
    "brazil": "Brazil",
    "mexico": "Mexico",
}

# Generic words a typo is checked against ("Ventrues", "Capial", "Partnes").
TYPO_TARGETS = ("ventures", "capital", "partners", "opportunity")
TYPO_MIN_SCORE = 85
TYPO_MIN_LENGTH = 6


def clean(text: str) -> str:
    """Collapse whitespace and line breaks from PDF cells."""
    return re.sub(r"\s+", " ", text or "").strip()


@dataclass(frozen=True)
class FirmName:
    name: str
    aliases: tuple[str, ...]


def firm_from_fund_name(fund_name: str) -> FirmName:
    """The firm part of a fund name.

    "Union Square Ventures - climate fund"   -> Union Square Ventures
    "Sino Global Capital, Liquid Value Fund" -> Sino Global Capital
    "Viola Ventures (fka Carmel Ventures)"   -> Viola Ventures, alias Carmel Ventures
    "Line (JV with Collaborative Fund)"      -> Line
    """
    name = clean(fund_name)
    aliases: list[str] = []
    for inner in re.findall(r"\(([^)]*)\)", name):
        m = re.match(r"(?i)\s*(?:fka|f/k/a|formerly)\s+(.+)", inner)
        if m:
            aliases.append(clean(m.group(1)))
    name = clean(re.sub(r"\([^)]*\)", "", name))
    name = re.split(r"\s+-\s+", name, maxsplit=1)[0]
    m = re.match(r"(.+?),\s*[^,]*\bfund\b.*$", name, flags=re.IGNORECASE)
    if m:
        name = m.group(1)
    return FirmName(clean(name), tuple(aliases))


def tokens(name: str) -> list[str]:
    return slugify(name.replace("&", " and "), separator=" ").split()


def typo_tokens(name: str) -> list[tuple[str, str]]:
    """(token, likely word) pairs for near-misses of generic words, skipping the first token."""
    found = []
    for tok in tokens(name)[1:]:
        if len(tok) < TYPO_MIN_LENGTH or tok in NAME_MATCH_STOPWORDS:
            continue
        for target in TYPO_TARGETS:
            if tok != target and fuzz.ratio(tok, target) >= TYPO_MIN_SCORE:
                found.append((tok, target))
                break
    return found


def match_tokens(name: str) -> list[str]:
    typos = dict(typo_tokens(name))
    toks = [typos.get(t, t) for t in tokens(name)]
    kept = [t for t in toks if t not in NAME_MATCH_STOPWORDS]
    while len(kept) > 1 and kept[-1] in VEHICLE_QUALIFIERS:
        kept.pop()
    # A name made only of generic words ("Capital Partners") keeps them all.
    return kept or toks


def has_vehicle_words(name: str) -> bool:
    """True for vehicle names: "Sequoia Seed Fund", "Cendana Co-Investment Fund"."""
    if re.search(r"(?i)\bco-?investment\b", name):
        return True
    typos = dict(typo_tokens(name))
    kept = [t for t in (typos.get(t, t) for t in tokens(name)) if t not in NAME_MATCH_STOPWORDS]
    return kept != match_tokens(name)


def match_key(name: str) -> str:
    return " ".join(match_tokens(name))


def parent_brand(display_name: str) -> str | None:
    """'Antler US Fund' -> 'Antler'; None unless the key ends in a region."""
    toks = match_tokens(display_name)
    if len(toks) < 2 or toks[-1] not in REGION_QUALIFIERS:
        return None
    word = REGION_QUALIFIERS[toks[-1]]
    m = re.search(rf"\b{re.escape(word)}\b", display_name, flags=re.IGNORECASE)
    if not m:
        return None
    parent = display_name[: m.start()].strip(" -,")
    return parent or None
