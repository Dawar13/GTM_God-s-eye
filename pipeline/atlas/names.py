"""Investor names: cleaning for display, and keys for matching.

Display names keep generic words ("Ventures", "Capital", "Fund"); only the
matching key drops them (PHASE_0 §6.4).
"""

import re
from dataclasses import dataclass

from rapidfuzz import fuzz
from slugify import slugify

from atlas.config import NAME_MATCH_STOPWORDS
from atlas.geo import region_for_location

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


def _abbreviates(short: str, long: str) -> bool:
    """'IQT' abbreviates 'In-Q-Tel', 'SKTVC' 'SK Telecom Venture Capital': an
    all-caps token whose letters appear in order in the longer name, first letter first."""
    if not re.fullmatch(r"[A-Z0-9]{2,6}", short) or len(short) >= len(long.replace(" ", "")):
        return False
    rest = long.lower()
    if not rest.startswith(short[0].lower()):
        return False
    for ch in short.lower():
        at = rest.find(ch)
        if at < 0:
            return False
        rest = rest[at + 1 :]
    return True


def investing_name(name: str) -> FirmName:
    """The investor a round names, without a note in brackets.

    "Jeff Bezos (through Bezos Expeditions)" -> Bezos Expeditions (the vehicle invested)
    "In-Q-Tel (IQT)"                         -> In-Q-Tel, alias IQT
    "GV (Google Ventures)"                   -> GV, alias Google Ventures
    "Range Ventures (Chris Erickson)"        -> Range Ventures
    "Accel (India)", "Seed Capital (Denmark)" -> unchanged: the place tells firms apart
    "EQT VIII"                               -> EQT (a numbered fund is the firm's vehicle)
    """
    name = clean(name)
    m = re.match(r"(?i)^.+?\((?:through|via)\s+([^)]+)\)$", name)
    if m:
        return FirmName(clean(m.group(1)), ())
    # Two or more numeral letters only, so "Accel X" or "Fund I"-less names survive.
    numbered = re.match(r"^(.+?)\s+(?:Fund\s+)?[IVX]{2,5}$", name)
    if numbered:
        return FirmName(clean(numbered.group(1)), ())
    m = re.match(r"^(.+?)\s*\(([^)]+)\)$", name)
    if not m or region_words(name) or region_for_location(m.group(2)):
        return FirmName(name, ())
    outer, inner = clean(m.group(1)), clean(m.group(2))
    same = _abbreviates(inner, outer) or _abbreviates(outer, inner)
    return FirmName(outer, (inner,) if same else ())


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


# Keys shorter than this are too generic to match on ("AI Seed" -> "ai",
# "Capital F" -> "f"); stripping stops before a key gets that short.
MIN_KEY_CHARS = 3
MIN_KEY_CHARS_AFTER_VEHICLE = 3


def _key_len(toks: list[str]) -> int:
    return len(" ".join(toks))


def _without_stopwords(toks: list[str]) -> list[str]:
    return [t for t in toks if t not in NAME_MATCH_STOPWORDS]


def match_tokens(name: str) -> list[str]:
    typos = dict(typo_tokens(name))
    toks = [typos.get(t, t) for t in tokens(name)]
    # A name made (almost) only of generic words ("Capital Partners", "Capital F") keeps them all.
    if _key_len(_without_stopwords(toks)) < MIN_KEY_CHARS:
        return toks
    # Vehicle words count only at the very end of the written name, optionally
    # followed by "Fund": "Sequoia Capital Seed Fund", "Greycroft Growth" — but
    # not "Spark Growth Ventures", where Growth is part of the firm's name.
    tail = list(toks)
    while tail and tail[-1] in ("fund", "funds"):
        tail.pop()
    while (
        len(tail) > 1
        and tail[-1] in VEHICLE_QUALIFIERS
        and _key_len(_without_stopwords(tail[:-1])) >= MIN_KEY_CHARS_AFTER_VEHICLE
    ):
        tail.pop()
    return _without_stopwords(tail) or toks


def has_vehicle_words(name: str) -> bool:
    """True for vehicle names: "Sequoia Seed Fund", "Cendana Co-Investment Fund"."""
    if re.search(r"(?i)\bco-?investment\b", name):
        return True
    typos = dict(typo_tokens(name))
    return _without_stopwords([typos.get(t, t) for t in tokens(name)]) != match_tokens(name)


def region_words(display_name: str) -> list[str]:
    """Trailing region words: 'Accel (Europe & Israel)' -> ['Europe', 'Israel']."""
    toks = match_tokens(display_name)
    out = []
    while len(toks) > 1 and toks[-1] in REGION_QUALIFIERS:
        out.insert(0, REGION_QUALIFIERS[toks.pop()])
    return out


def match_key(name: str) -> str:
    return " ".join(match_tokens(name))


def parent_brand(display_name: str) -> str | None:
    """'Antler US Fund' -> 'Antler', 'Accel (Europe & Israel)' -> 'Accel'.

    None unless the key ends in region words; the parent is the text before the
    first of them.
    """
    toks = match_tokens(display_name)
    i = len(toks)
    while i > 1 and toks[i - 1] in REGION_QUALIFIERS:
        i -= 1
    if i == len(toks):
        return None
    word = REGION_QUALIFIERS[toks[i]]
    m = re.search(rf"\b{re.escape(word)}\b", display_name, flags=re.IGNORECASE)
    if not m:
        return None
    parent = display_name[: m.start()].strip(" -,(&")
    return parent or None
