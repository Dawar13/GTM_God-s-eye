"""User seed lists (PHASE_0 §7).

seed_investors.csv: names from nine user-supplied lists. Listed focus and
check sizes are hints for Phase 1 to verify, never facts.
seed_rounds.csv: rounds from the robotics (>= $20M) and AI mega-seed lists.
Amounts and dates are low confidence until verified.
"""

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

from atlas.config import (
    AUSTRALIA_NZ_CSV,
    DOCSEND_EARLY_CSV,
    ESTES_SEED_FUNDS_CSV,
    MAP_OF_THE_MONEY_CSV,
    NYC_SEED_VC_CSV,
    PHYSICAL_AI_CSV,
    SEED_INVESTORS_CSV,
    SEED_ROUNDS_CSV,
    US_ANGELS_CSV,
    VC_INDIA_CSV,
)
from atlas.geo import region_for_country, region_for_location
from atlas.names import clean, investing_name

FRONTIER_LIST = "multiples_frontier_lab_investors_2026-10-28"

# Lists whose own scope fixes the region of every name on them.
REGION_SCOPED_LISTS = {"li_20_b2b_ai_funds_2026": "western"}  # "US/UK/EU funds"

# Type guesses for the frontier-labs list (PHASE_0 §7.3). Guesses, not facts:
# these investors stay confidence "low" until Phase 1 verifies them.
FRONTIER_TYPE_GUESSES = {
    "NVIDIA": "strategic",
    "Andreessen Horowitz": "vc",
    "Sequoia Capital": "vc",
    "Lightspeed Venture Partners": "vc",
    "BlackRock": "asset_manager",
    "Fidelity Investments": "asset_manager",
    "Microsoft": "strategic",
    "MGX": "sovereign",
    "Founders Fund": "vc",
    "Coatue": "asset_manager",
    "TPG": "asset_manager",
    "DST Global": "vc",
    "Cisco Investments": "cvc",
    "Cisco": "strategic",
    "Accel": "vc",
    "Conviction": "vc",
    "Jane Street": "strategic",
    "ServiceNow": "strategic",
    "Square Peg": "vc",
    "AMD Ventures": "cvc",
    "Alphabet": "strategic",
    "GV": "cvc",
    "Greenoaks": "vc",
    "NFDG Ventures": "vc",
    "General Catalyst": "vc",
    "Salesforce Ventures": "cvc",
    "Qatar Investment Authority": "sovereign",
    "Manhattan Venture Partners": "vc",
    "Valor Equity Partners": "asset_manager",
    "T. Rowe Price": "asset_manager",
    "Blackstone": "asset_manager",
    "IDG Capital": "vc",
    "Tencent": "strategic",
    "Legend Capital": "vc",
    "JD.com": "strategic",
    "Boyu Capital": "asset_manager",
    "Meituan": "strategic",
    "NetEase Games": "strategic",
    "CATL": "strategic",
    "Geely": "strategic",
    "Liang Wenfeng": "individual",
}

ROBOTICS_LIST = "startupriders_robotics_20m_plus_2026"
MEGASEED_LIST = "freesbee_ai_megaseeds_2026"

# The robotics list is about robotics companies; the mega-seed list gives no sector.
LIST_SECTOR = {ROBOTICS_LIST: "robotics_physical_ai"}


@dataclass
class SeedInvestorRow:
    name: str
    source_id: str
    listed_focus: str | None
    listed_check_or_fund: str | None
    notes: str | None


@dataclass
class SeedRound:
    company: str
    source_id: str
    amount_usd: int | None
    stage: str
    stage_raw: str
    description: str | None
    leads: list[str] = field(default_factory=list)
    participants: list[str] = field(default_factory=list)
    unspecified: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _blank_to_none(value: str | None) -> str | None:
    value = clean(value or "")
    return value or None


def read_seed_investors(path: Path = SEED_INVESTORS_CSV) -> list[SeedInvestorRow]:
    with path.open(encoding="utf-8", newline="") as fh:
        return [
            SeedInvestorRow(
                name=clean(row["name_as_listed"]),
                source_id=clean(row["source_id"]),
                listed_focus=_blank_to_none(row["listed_focus"]),
                listed_check_or_fund=_blank_to_none(row["listed_check_or_fund"]),
                notes=_blank_to_none(row["notes"]),
            )
            for row in csv.DictReader(fh)
            if clean(row["name_as_listed"])
        ]


# --- Physical-AI investor list (user, 2026-11-01) ------------------------------------------

PHYSICAL_AI_LIST = "physical_ai_investor_list_2026_11_01"
PHYSICAL_AI_RETRIEVED = "2026-11-01"
VC_INDIA_LIST = "vc_investing_in_india_list_2026_11_12"
VC_INDIA_RETRIEVED = "2026-11-12"
# When a list was received, if not the Phase 0 date (see atlas.model.user_source).
LIST_RETRIEVED = {PHYSICAL_AI_LIST: PHYSICAL_AI_RETRIEVED, VC_INDIA_LIST: VC_INDIA_RETRIEVED}
# The list's four groups, kept as `user_tags` (short, sentence case).
PHYSICAL_AI_TAGS = (
    "Robotics and hard-tech",
    "Emerging and specialist",
    "Big names",
    "Strategic and corporate",
)
# Names written with a note that the generic bracket rule would not turn into the firm.
PHYSICAL_AI_NAMES = {
    "MISUMI Americas (the new MISUMI Ventures fund)": "MISUMI Ventures",  # the fund, not MISUMI
}


@dataclass
class PhysicalAiRow:
    name_as_listed: str
    name: str  # the investing firm, as fed to the resolver
    tag: str


def physical_ai_name(raw: str) -> str:
    """'SOSV / SOSV HAX' -> SOSV; "M12 (Microsoft's venture fund)" -> M12."""
    raw = clean(raw)
    if raw in PHYSICAL_AI_NAMES:
        return PHYSICAL_AI_NAMES[raw]
    return investing_name(raw.split(" / ")[0]).name


def read_physical_ai(path: Path = PHYSICAL_AI_CSV) -> list[PhysicalAiRow]:
    with path.open(encoding="utf-8", newline="") as fh:
        rows = [
            PhysicalAiRow(clean(r["name"]), physical_ai_name(r["name"]), clean(r["group"]))
            for r in csv.DictReader(fh)
            if clean(r["name"])
        ]
    for r in rows:
        if r.tag not in PHYSICAL_AI_TAGS:
            raise ValueError(f"unknown group {r.tag!r} for {r.name_as_listed!r}")
    return rows


# --- "VC investing in India" list (user, 2026-11-12) ---------------------------------------

# The list has no name column: names are read from each web address (see the CSV notes).
VC_INDIA_TAG = "VC investing in India"


@dataclass
class VcIndiaRow:
    name: str
    url: str | None  # the firm's site, or a LinkedIn company page
    location: str | None
    focus: str | None
    about: str | None
    check: str | None
    note: str | None

    @property
    def link_field(self) -> str | None:
        """Investor field the listed URL fills: a LinkedIn page is not a website."""
        if not self.url:
            return None
        return "linkedin" if "linkedin.com/" in self.url else "website"

    def hint(self) -> dict:
        notes = [
            self.about if self.focus else None,
            f"Address as listed: {self.location}" if self.location else None,
            f"Web address as listed: {self.url}" if self.url else None,
            self.note,
        ]
        low, high = parse_check_range(self.check) or (None, None)
        return with_numbers(
            {
                "source_id": VC_INDIA_LIST,
                "listed_focus": self.focus or self.about,
                "listed_check_or_fund": self.check,
                "notes": "; ".join(n for n in notes if n) or None,
            },
            {"min": low, "p25": None, "p75": None, "max": high},
            None,
        )


def read_vc_india(path: Path = VC_INDIA_CSV) -> list[VcIndiaRow]:
    with path.open(encoding="utf-8", newline="") as fh:
        return [
            VcIndiaRow(
                name=clean(r["name"]),
                url=_blank_to_none(r["website"]),
                location=_blank_to_none(r["location_as_listed"]),
                focus=_blank_to_none(r["focus_as_listed"]),
                about=_blank_to_none(r["about_as_listed"]),
                check=_blank_to_none(r["check_as_listed"]),
                note=_blank_to_none(r["note"]),
            )
            for r in csv.DictReader(fh)
            if clean(r["name"])
        ]


# --- Investor lists of 2026-11-12 in one shared layout (atlas.ingest.transcribe_lists) ----


@dataclass(frozen=True)
class ListSpec:
    source_id: str
    path: Path
    tag: str  # every name on the list gets this tag
    retrieved: str
    # The investor type of every name on the list, when the list is all of one kind.
    default_type: str | None = None


LISTED = (
    ListSpec("nyc_seed_vc_list_2026_11_12", NYC_SEED_VC_CSV, "New York seed funds", "2026-11-12"),
    ListSpec(
        "estes_750_seed_funds_list_2026_11_12",
        ESTES_SEED_FUNDS_CSV,
        "750+ seed funds list",
        "2026-11-12",
    ),
    ListSpec(
        "docsend_early_investors_list_2026_11_12",
        DOCSEND_EARLY_CSV,
        "DocSend early-stage list",
        "2026-11-12",
    ),
    ListSpec(
        "australia_nz_investors_list_2026_11_12",
        AUSTRALIA_NZ_CSV,
        "Australia and New Zealand",
        "2026-11-12",
    ),
    # A list of people; the user describes it as angel investors.
    ListSpec(
        "us_angel_investors_list_2026_11_12",
        US_ANGELS_CSV,
        "US angels",
        "2026-11-12",
        default_type="angel",
    ),
    # Its cheque figures are first cheques in US$ (the map's own axis title).
    ListSpec(
        "map_of_the_money_singapore_list_2026_11_13",
        MAP_OF_THE_MONEY_CSV,
        "Singapore (Map of the Money)",
        "2026-11-13",
    ),
)
LIST_RETRIEVED.update({spec.source_id: spec.retrieved for spec in LISTED})
# Tags a row carries when the list's own words state a founder focus.
FOUNDER_FOCUS_TAGS = ("Female founders focus", "Minority founders focus")
# A list's type words -> InvestorType. Other words stay in the hint only.
LISTED_TYPES = {
    "vc": "vc",
    "angel": "angel",
    "cvc": "cvc",
    "corporate vc": "cvc",
    "super angel": "angel",
    "corporate accelerator": "accelerator",
    "family office": "family_office",
    "accelerator": "accelerator",
    "incubator": "incubator",
    "syndicate": "syndicate",
}


@dataclass
class ListedInvestor:
    source_id: str
    name: str
    name_as_listed: str | None
    type: str | None  # InvestorType: the list's own word for it, or the list's kind
    type_as_listed: str | None
    stages: str | None
    location: str | None
    focus: str | None
    check: str | None
    about: str | None
    website: str | None
    linkedin: str | None
    note: str | None
    tags: list[str] = field(default_factory=list)
    # The listed check range ({min, p25, p75, max}) and fund size, whole US$; still hints.
    check_usd: dict[str, int | None] | None = None
    fund_size_usd: int | None = None

    @property
    def links(self) -> dict[str, str]:
        return {k: v for k, v in (("website", self.website), ("linkedin", self.linkedin)) if v}

    def hint(self) -> dict:
        # `about` is never the focus: on the angel list it is the person's day job.
        notes = [
            self.about,
            f"Stages as listed: {self.stages}" if self.stages else None,
            # A type word that became the type field is not repeated.
            f"Type as listed: {self.type_as_listed}"
            if self.type_as_listed and self.type_as_listed.lower() not in LISTED_TYPES
            else None,
            f"Location as listed: {self.location}" if self.location else None,
            f"Listed as: {self.name_as_listed}" if self.name_as_listed else None,
            self.note,
        ]
        return with_numbers(
            {
                "source_id": self.source_id,
                "listed_focus": self.focus,
                "listed_check_or_fund": self.check,
                "notes": "; ".join(n for n in notes if n) or None,
            },
            self.check_usd,
            self.fund_size_usd,
        )


def with_numbers(
    hint: dict, check_usd: dict[str, int | None] | None, fund_size_usd: int | None
) -> dict:
    """Add the listed figures to a hint only when there are some (both keys are optional)."""
    if check_usd and any(v is not None for v in check_usd.values()):
        hint["listed_check_usd"] = check_usd
    if fund_size_usd:
        hint["listed_fund_size_usd"] = fund_size_usd
    return hint


def _whole(value: str) -> int | None:
    return int(value) if clean(value) else None


def read_listed(spec: ListSpec) -> list[ListedInvestor]:
    rows = []
    with spec.path.open(encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            name = clean(r["name"])
            if not name:
                continue
            tags = [t for t in (clean(x) for x in r["tags"].split(";")) if t]
            if unknown := set(tags) - set(FOUNDER_FOCUS_TAGS):
                raise ValueError(f"unknown tags {sorted(unknown)} for {name!r}")
            type_raw = _blank_to_none(r["type_as_listed"])
            rows.append(
                ListedInvestor(
                    source_id=spec.source_id,
                    name=name,
                    name_as_listed=_blank_to_none(r["name_as_listed"]),
                    type=LISTED_TYPES.get(type_raw.lower()) if type_raw else spec.default_type,
                    type_as_listed=type_raw,
                    stages=_blank_to_none(r["stages_as_listed"]),
                    location=_blank_to_none(r["location_as_listed"]),
                    focus=_blank_to_none(r["focus_as_listed"]),
                    check=_blank_to_none(r["check_as_listed"]),
                    about=_blank_to_none(r["about_as_listed"]),
                    website=_blank_to_none(r["website"]),
                    linkedin=_blank_to_none(r["linkedin"]),
                    note=_blank_to_none(r["note"]),
                    tags=tags,
                    check_usd={
                        k: _whole(r[f"check_{k}_usd"]) for k in ("min", "p25", "p75", "max")
                    },
                    fund_size_usd=_whole(r["fund_size_usd"]),
                )
            )
    return rows


# Country codes that end an address on the list. US state codes ("NY", "MA") look the
# same, so only these are read as countries.
ADDRESS_COUNTRY_CODES = {"US", "GB", "CA", "AU", "LU", "DE", "IN", "SG", "AE", "QA"}


def region_from_address(address: str | None) -> str | None:
    """Region of the places a street address names, when they agree.

    Street parts and postcodes match no place and are skipped; a trailing two-letter
    part is a country code ("..., Mumbai, IN"). Places in several regions give None.
    """
    parts = [re.sub(r"[\d#]+", " ", p).strip(" -.") for p in (address or "").split(",")]
    regions = set()
    for i, part in enumerate(parts):
        if i == len(parts) - 1 and part in ADDRESS_COUNTRY_CODES:
            regions.add(region_for_country(part))
            continue
        # "London W S HR" (postcode letters), "California US", "Ontario M B B".
        part = re.sub(r"(\s+[A-Z]{1,3})+$", "", part)
        if region := region_for_location(part) or region_for_location(
            part.replace("United Kingdom", "UK")
        ):
            regions.add(region)
    return regions.pop() if len(regions) == 1 else None


# --- Check ranges as numbers (still hints) --------------------------------------------------

_UNITS = {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000}
_AMOUNT = r"\$\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*([kmb])?"


def _usd(number: str, unit: str | None) -> float:
    return float(number.replace(",", "")) * _UNITS.get((unit or "").lower(), 1)


def parse_check_range(text: str | None) -> tuple[int | None, int | None] | None:
    """A listed US$ check range as (smallest, largest); None when the text is not clearly one.

    "$100K-$5M", "$1M-2.5M", "$100,000 to $300,000" -> both ends; "$5M-$10M+" -> the
    largest as written; "$10M+" and "from $5,000,000 …" -> smallest only; "up to $1M" ->
    largest only. A bare first figure takes the second's unit only if that keeps the range
    in order ("$50-500K" -> $50K-$500K; "$50-$5M" is $50K or $50M, so skipped). Single
    figures, other currencies and several ranges are skipped.
    """
    t = clean(text or "").lower()
    if not t.startswith(("$", "from $", "up to $")):
        return None  # other currencies, or no figure
    if m := re.fullmatch(rf"from {_AMOUNT}(?: \(.*\))?", t):
        return round(_usd(*m.groups())), None
    if m := re.fullmatch(rf"up to {_AMOUNT}", t):
        return None, round(_usd(*m.groups()))
    if m := re.fullmatch(rf"{_AMOUNT}\s*\+", t):
        return round(_usd(*m.groups())), None
    second = _AMOUNT.replace(r"\$", r"\$?")  # "$1M-2.5M": the second "$" may be left out
    m = re.fullmatch(rf"{_AMOUNT}\s*(?:-|–|to)\s*{second}\s*\+?", t)
    if not m:
        return None
    a_num, a_unit, b_num, b_unit = m.groups()
    if a_unit is None and b_unit is not None:
        a_unit = b_unit  # "$1-3M"; checked against the order below
    elif a_unit is not None and b_unit is None:
        return None
    low, high = round(_usd(a_num, a_unit)), round(_usd(b_num, b_unit))
    return (low, high) if 0 < low <= high else None


def parse_amount(raw: str) -> int | None:
    """'1.7B' -> 1_700_000_000, '52M' -> 52_000_000."""
    m = re.fullmatch(r"\$?\s*([\d.]+)\s*([MB])", clean(raw), flags=re.IGNORECASE)
    if not m:
        return None
    scale = 1_000_000_000 if m.group(2).upper() == "B" else 1_000_000
    return round(float(m.group(1)) * scale)


def parse_names(raw: str) -> tuple[list[str], list[str]]:
    """Semicolon-separated investor names, plus notes for text that isn't a name."""
    names, notes = [], []
    for part in (clean(p) for p in (raw or "").split(";")):
        if not part:
            continue
        if part.lower() == "undisclosed":
            notes.append("lead not disclosed in the list")
            continue
        m = re.fullmatch(r"(.+?)\s*\((\+\d+ co-leads?)\)", part)
        if m:
            names.append(m.group(1))
            notes.append(f"{m.group(2)} not named in the list")
            continue
        names.append(part)
    return names, notes


def stage_from_label(label: str) -> str:
    return "seed" if re.search(r"(?i)\bseed\b", label) else "undisclosed"


def read_seed_rounds(path: Path = SEED_ROUNDS_CSV) -> list[SeedRound]:
    rounds = []
    with path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            source_id = clean(row["source_id"])
            first, first_notes = parse_names(row["lead_or_investors"])
            co, co_notes = parse_names(row["co_investors"])
            r = SeedRound(
                company=clean(row["company"]),
                source_id=source_id,
                amount_usd=parse_amount(row["amount_usd_as_listed"]),
                stage=stage_from_label(row["round_as_listed"]),
                stage_raw=clean(row["round_as_listed"]),
                description=_blank_to_none(row["description"]),
                notes=first_notes + co_notes,
            )
            # The mega-seed list names leads, then strategic co-investors. The
            # robotics list names investors without saying who led.
            if source_id == MEGASEED_LIST:
                r.leads, r.participants = first, co
            else:
                r.unspecified = first + co
            if not first and not co and not r.notes:
                r.notes.append("no investors listed")
            rounds.append(r)
    return rounds
